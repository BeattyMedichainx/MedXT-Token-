import { MedXToken } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployMedXToken, ZERO_ADDRESS } from "@test-utils";
import assert from "assert";
import { expect } from "chai";
import { ContractTransactionReceipt } from "ethers";
import { ethers } from "hardhat";

describe("Method: toggleFee", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let contract: MedXToken;
  before(async () => {
    [deployer, owner, admin] = await ethers.getSigners();
    contract = await deployMedXToken(deployer, owner, deployer);
    await contract.updateAdmin(admin);
  });

  describe("When called not from owner nor admin", () => {
    it("should revert with OwnerOrAdminUnauthorizedAccount", async () => {
      await expect(contract.toggleFee(false))
        .revertedWithCustomError(contract, "OwnerOrAdminUnauthorizedAccount")
        .withArgs(deployer);
    });
  });

  describe("When called from owner", () => {
    after(async () => contract.connect(owner).toggleFee(true));
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(owner).toggleFee(false);
      receipt = await response.wait();
      assert(receipt);
    });
    it("should toggle fee feature", async () => {
      const feeEnabled = await contract.feeEnabled();
      assert.strictEqual(feeEnabled, false);
    });
    it("should emit FeeToggled event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).emit(contract, "FeeToggled").withArgs(false);
    });
  });

  describe("When called from admin", () => {
    after(async () => contract.connect(owner).toggleFee(true));
    it("should succeed", async () => contract.connect(admin).toggleFee(false));
  });

  describe("When changing to current value", () => {
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(owner).toggleFee(true);
      receipt = await response.wait();
      assert(receipt);
    });
    it("should not emit FeeToggled event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).not.emit(contract, "FeeToggled");
    });
  });

  describe("When fee receiver is zero address", () => {
    before(async () => {
      await contract.connect(owner).toggleFee(false);
      await contract.connect(owner).updateFeeReceiver(ZERO_ADDRESS);
    });
    after(async () => {
      await contract.connect(owner).updateFeeReceiver(deployer);
      await contract.connect(owner).toggleFee(true);
    });
    it("should revert with InvalidFeeReceiver", async () => {
      await expect(contract.connect(owner).toggleFee(true))
        .revertedWithCustomError(contract, "InvalidFeeReceiver")
        .withArgs();
    });
  });

  describe("When disabling disabled fee when fee receiver is zero address", () => {
    before(async () => {
      await contract.connect(owner).toggleFee(false);
      await contract.connect(owner).updateFeeReceiver(ZERO_ADDRESS);
    });
    after(async () => {
      await contract.connect(owner).updateFeeReceiver(deployer);
      await contract.connect(owner).toggleFee(true);
    });
    it("should succeed", async () => contract.connect(owner).toggleFee(false));
  });
});
