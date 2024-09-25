import { MedXToken } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployMedXToken, ZERO_ADDRESS } from "@test-utils";
import assert from "assert";
import { expect } from "chai";
import { ContractTransactionReceipt } from "ethers";
import { ethers } from "hardhat";

describe("Method: updateFeeReceiver", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let feeReceiver: HardhatEthersSigner;
  let newFeeReceiver: HardhatEthersSigner;
  let contract: MedXToken;
  before(async () => {
    [deployer, owner, admin, feeReceiver, newFeeReceiver] = await ethers.getSigners();
    contract = await deployMedXToken(deployer, owner, feeReceiver);
    await contract.updateAdmin(admin);
  });

  describe("When called not from owner nor admin", () => {
    it("should revert with OwnerOrAdminUnauthorizedAccount", async () => {
      await expect(contract.updateFeeReceiver(newFeeReceiver))
        .revertedWithCustomError(contract, "OwnerOrAdminUnauthorizedAccount")
        .withArgs(deployer);
    });
  });

  describe("When called from owner", () => {
    after(async () => await contract.connect(owner).updateFeeReceiver(feeReceiver));
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(owner).updateFeeReceiver(newFeeReceiver);
      receipt = await response.wait();
      assert(receipt);
    });
    it("fee receiver should be updated", async () => {
      const actualFeeReceiver = await contract.feeReceiver();
      assert.strictEqual(actualFeeReceiver.toLowerCase(), newFeeReceiver.address.toLowerCase());
    });
    it("should emit FeeReceiverUpdated event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).emit(contract, "FeeReceiverUpdated").withArgs(feeReceiver, newFeeReceiver);
    });
  });

  describe("When called from admin", () => {
    after(async () => await contract.connect(owner).updateFeeReceiver(feeReceiver));
    it("should succeed", async () => await contract.connect(admin).updateFeeReceiver(newFeeReceiver));
  });

  describe("When new fee receiver equals previous fee receiver", () => {
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(owner).updateFeeReceiver(feeReceiver);
      receipt = await response.wait();
      assert(receipt);
    });
    it("should not emit FeeReceiverUpdated event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).not.emit(contract, "FeeReceiverUpdated");
    });
  });

  describe("When new fee receiver is zero address", () => {
    it("should revert with InvalidFeeReceiver", async () => {
      await expect(contract.connect(owner).updateFeeReceiver(ZERO_ADDRESS))
        .revertedWithCustomError(contract, "InvalidFeeReceiver")
        .withArgs();
    });
  });

  describe("When new fee receiver is zero address and fee feature is disabled", () => {
    before(async () => contract.connect(owner).toggleFee(false));
    after(async () => {
      await contract.connect(owner).updateFeeReceiver(feeReceiver);
      await contract.connect(owner).toggleFee(true);
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(owner).updateFeeReceiver(ZERO_ADDRESS);
      receipt = await response.wait();
      assert(receipt);
    });
    it("new fee receiver should equals zero address", async () => {
      const actualFeeReceiver = await contract.feeReceiver();
      assert.strictEqual(actualFeeReceiver, ZERO_ADDRESS);
    });
    it("should emit FeeReceiverUpdated event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).emit(contract, "FeeReceiverUpdated").withArgs(feeReceiver, ZERO_ADDRESS);
    });
  });
});
