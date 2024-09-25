import { MedXToken } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployMedXToken, ONE_ETHER, ZERO_ADDRESS } from "@test-utils";
import assert from "assert";
import { expect } from "chai";
import { ContractTransactionReceipt } from "ethers";
import { ethers } from "hardhat";

describe("Method: burn", () => {
  let deployer: HardhatEthersSigner;
  let burner: HardhatEthersSigner;
  let contract: MedXToken;
  before(async () => {
    [deployer, burner] = await ethers.getSigners();
    contract = await deployMedXToken(deployer, deployer, deployer);
    await contract.updateBurnersList([], [burner]);
  });

  describe("When called not from burner", () => {
    it("should revert with BurnerUnauthorizedAccount", async () => {
      await expect(contract.burn(123n))
        .revertedWithCustomError(contract, "BurnerUnauthorizedAccount")
        .withArgs(deployer);
    });
  });

  describe("When not enough balance", () => {
    const EXPECTED_BALANCE = 123n * ONE_ETHER;
    const BURN_AMOUNT = 234n * ONE_ETHER;
    before(async () => {
      assert(BURN_AMOUNT > EXPECTED_BALANCE);
      const balance = await contract.balanceOf(burner);
      if (balance < EXPECTED_BALANCE) await contract.transfer(burner, EXPECTED_BALANCE - balance);
      else if (balance > EXPECTED_BALANCE) {
        await contract.connect(burner).transfer(deployer, balance - EXPECTED_BALANCE);
      }
      const newBalance = await contract.balanceOf(burner);
      assert.strictEqual(newBalance, EXPECTED_BALANCE);
    });
    it("should revert with ERC20InsufficientBalance", async () => {
      await expect(contract.connect(burner).burn(BURN_AMOUNT))
        .revertedWithCustomError(contract, "ERC20InsufficientBalance")
        .withArgs(burner, EXPECTED_BALANCE, BURN_AMOUNT);
    });
  });

  describe("When called from burner and balance is sufficient", () => {
    const START_BALANCE = 234n * ONE_ETHER;
    const BURN_AMOUNT = 123n * ONE_ETHER;
    let startTotalSupply: bigint;
    let receipt: ContractTransactionReceipt | null = null;
    before(async () => {
      assert(START_BALANCE > BURN_AMOUNT);
      const balance = await contract.balanceOf(burner);
      if (balance < START_BALANCE) await contract.transfer(burner, START_BALANCE - balance);
      else if (balance > START_BALANCE) await contract.connect(burner).transfer(deployer, balance - START_BALANCE);
      const newBalance = await contract.balanceOf(burner);
      assert.strictEqual(newBalance, START_BALANCE);
      startTotalSupply = await contract.totalSupply();
    });
    it("should succeed", async () => {
      const response = await contract.connect(burner).burn(BURN_AMOUNT);
      receipt = await response.wait();
      assert(receipt);
    });
    it("burner balance should decrease by burn amount", async () => {
      const balance = await contract.balanceOf(burner);
      const expectedBalance = START_BALANCE - BURN_AMOUNT;
      assert.strictEqual(balance, expectedBalance);
    });
    it("total supply should decrease by burn amount", async () => {
      const totalSupply = await contract.totalSupply();
      const expectedTotalSupply = startTotalSupply - BURN_AMOUNT;
      assert.strictEqual(totalSupply, expectedTotalSupply);
    });
    it("should emit transfer event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).emit(contract, "Transfer").withArgs(burner, ZERO_ADDRESS, BURN_AMOUNT);
    });
  });
});
