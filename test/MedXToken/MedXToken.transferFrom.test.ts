import { MedXToken } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployMedXToken, ONE_ETHER } from "@test-utils";
import assert from "assert";
import { expect } from "chai";
import { ContractTransactionReceipt } from "ethers";
import { ethers } from "hardhat";

describe("Method: transferFrom", () => {
  const TRANSFER_AMOUNT = 123n * ONE_ETHER;
  const START_ALLOWANCE = 234n * ONE_ETHER;
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let contract: MedXToken;
  before(async () => {
    [deployer, user] = await ethers.getSigners();
    contract = await deployMedXToken(deployer, deployer, deployer);
    await contract.transfer(user, TRANSFER_AMOUNT);
    await contract.connect(user).approve(deployer, START_ALLOWANCE);
  });
  let receipt: ContractTransactionReceipt | null = null;
  it("should succeed", async () => {
    const response = await contract.transferFrom(user, deployer, TRANSFER_AMOUNT);
    receipt = await response.wait();
    assert(receipt);
  });
  it("should emit Approval event", async function () {
    if (!receipt) this.skip();
    const expectedAllowance = START_ALLOWANCE - TRANSFER_AMOUNT;
    await expect(receipt).emit(contract, "Approval").withArgs(user, deployer, expectedAllowance);
  });
});
