import { MedXToken } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployMedXToken } from "@test-utils";
import assert from "assert";
import { expect } from "chai";
import { ContractTransactionReceipt } from "ethers";
import { ethers } from "hardhat";

describe("Method: updateAdmin", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let newAdmin: HardhatEthersSigner;
  let contract: MedXToken;
  before(async () => {
    [deployer, owner, admin, newAdmin] = await ethers.getSigners();
    contract = await deployMedXToken(deployer, owner, deployer);
    await contract.updateAdmin(admin);
  });

  describe("When called not from owner nor admin", () => {
    it("should revert with OwnerOrAdminUnauthorizedAccount", async () => {
      await expect(contract.updateAdmin(newAdmin))
        .revertedWithCustomError(contract, "OwnerOrAdminUnauthorizedAccount")
        .withArgs(deployer);
    });
  });

  describe("When called from owner", () => {
    after(async () => contract.connect(owner).updateAdmin(admin));
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(owner).updateAdmin(newAdmin);
      receipt = await response.wait();
      assert(receipt);
    });
    it("should update admin", async () => {
      const actualAdmin = await contract.admin();
      assert.strictEqual(actualAdmin.toLowerCase(), newAdmin.address.toLowerCase());
    });
    it("should emit AdminUpdated event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).emit(contract, "AdminUpdated").withArgs(admin, newAdmin);
    });
  });

  describe("When called from previous admin", () => {
    after(async () => contract.connect(owner).updateAdmin(admin));
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(admin).updateAdmin(newAdmin);
      receipt = await response.wait();
      assert(receipt);
    });
    it("should update admin", async () => {
      const actualAdmin = await contract.admin();
      assert.strictEqual(actualAdmin.toLowerCase(), newAdmin.address.toLowerCase());
    });
    it("should emit AdminUpdated event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).emit(contract, "AdminUpdated").withArgs(admin, newAdmin);
    });
  });

  describe("When new admin equals previous admin", () => {
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(admin).updateAdmin(admin);
      receipt = await response.wait();
      assert(receipt);
    });
    it("should not emit AdminUpdate event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).not.emit(contract, "AdminUpdated");
    });
  });
});
