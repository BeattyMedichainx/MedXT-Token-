import { MedXToken } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployMedXToken, ONE_ETHER, ZERO_ADDRESS } from "@test-utils";
import assert from "assert";
import { expect } from "chai";
import { ContractTransactionReceipt, MaxUint256 } from "ethers";
import { ethers } from "hardhat";

describe("Method: burnFrom", () => {
  let deployer: HardhatEthersSigner;
  let burner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let contract: MedXToken;
  before(async () => {
    [deployer, burner, user] = await ethers.getSigners();
    contract = await deployMedXToken(deployer, deployer, deployer);
    await contract.updateBurnersList([], [burner]);
  });

  describe("When called not from burner", () => {
    it("should revert with BurnerUnauthorizedAccount", async () => {
      await expect(contract.burnFrom(user, 123n))
        .revertedWithCustomError(contract, "BurnerUnauthorizedAccount")
        .withArgs(deployer);
    });
  });

  describe("When not enough allowance", () => {
    const ALLOWANCE = 123n * ONE_ETHER;
    const BURN_AMOUNT = 234n * ONE_ETHER;
    before(async () => {
      const balance = await contract.balanceOf(user);
      if (balance < BURN_AMOUNT) await contract.transfer(user, BURN_AMOUNT - balance);
      await contract.connect(user).approve(burner, ALLOWANCE);
    });
    it("should revert with ERC20InsufficientAllowance", async () => {
      await expect(contract.connect(burner).burnFrom(user, BURN_AMOUNT))
        .revertedWithCustomError(contract, "ERC20InsufficientAllowance")
        .withArgs(burner, ALLOWANCE, BURN_AMOUNT);
    });
  });

  describe("When not enough balance", () => {
    const EXPECTED_BALANCE = 123n * ONE_ETHER;
    const BURN_AMOUNT = 234n * ONE_ETHER;
    before(async () => {
      const balance = await contract.balanceOf(user);
      if (balance < EXPECTED_BALANCE) await contract.transfer(user, EXPECTED_BALANCE - balance);
      else if (balance > EXPECTED_BALANCE) await contract.connect(user).transfer(deployer, balance - EXPECTED_BALANCE);
      await contract.connect(user).approve(burner, BURN_AMOUNT);
    });
    it("should revert with ERC20InsufficientBalance", async () => {
      await expect(contract.connect(burner).burnFrom(user, BURN_AMOUNT))
        .revertedWithCustomError(contract, "ERC20InsufficientBalance")
        .withArgs(user, EXPECTED_BALANCE, BURN_AMOUNT);
    });
  });

  describe("When called from burner, balance and approve are sufficient", () => {
    const BURN_AMOUNT = 123n * ONE_ETHER;
    const START_ALLOWANCE = 234n * ONE_ETHER;
    const START_BALANCE = 333n * ONE_ETHER;
    const EXPECTED_ALLOWANCE = START_ALLOWANCE - BURN_AMOUNT;
    let startTotalSupply: bigint;
    let startBurnerBalance: bigint;
    let receipt: ContractTransactionReceipt | null = null;
    before(async () => {
      const balance = await contract.balanceOf(user);
      if (balance < START_BALANCE) await contract.transfer(user, START_BALANCE - balance);
      else if (balance > START_BALANCE) await contract.connect(user).transfer(deployer, balance - START_BALANCE);
      await contract.connect(user).approve(burner, START_ALLOWANCE);
      startTotalSupply = await contract.totalSupply();
      startBurnerBalance = await contract.balanceOf(burner);
    });
    it("should succeed", async () => {
      const response = await contract.connect(burner).burnFrom(user, BURN_AMOUNT);
      receipt = await response.wait();
      assert(receipt);
    });
    it("user balance should decrease by burn amount", async () => {
      const balance = await contract.balanceOf(user);
      const expectedBalance = START_BALANCE - BURN_AMOUNT;
      assert.strictEqual(balance, expectedBalance);
    });
    it("total supply should decrease by burn amount", async () => {
      const totalSupply = await contract.totalSupply();
      const expectedTotalSupply = startTotalSupply - BURN_AMOUNT;
      assert.strictEqual(totalSupply, expectedTotalSupply);
    });
    it("burner balance should not change", async () => {
      const balance = await contract.balanceOf(burner);
      assert.strictEqual(balance, startBurnerBalance);
    });
    it("allowance should decrease by burn amount", async () => {
      const allowance = await contract.allowance(user, burner);
      assert.strictEqual(allowance, EXPECTED_ALLOWANCE);
    });
    it("should emit Approval event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).emit(contract, "Approval").withArgs(user, burner, EXPECTED_ALLOWANCE);
    });
    it("should emit Transfer event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).emit(contract, "Transfer").withArgs(user, ZERO_ADDRESS, BURN_AMOUNT);
    });
  });

  describe("When unlimited allowance is used", () => {
    const BURN_AMOUNT = 123n * ONE_ETHER;
    before(async () => {
      const balance = await contract.balanceOf(user);
      if (balance < BURN_AMOUNT) await contract.transfer(user, BURN_AMOUNT - balance);
      await contract.connect(user).approve(burner, MaxUint256);
    });
    it("should succeed", async () => {
      await contract.connect(burner).burnFrom(user, BURN_AMOUNT);
    });
    it("allowance should not change", async () => {
      const allowance = await contract.allowance(user, burner);
      assert.strictEqual(allowance, MaxUint256);
    });
  });
});
