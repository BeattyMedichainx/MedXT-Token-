import { CliffAndVesting, CliffAndVesting__factory, ERC20Mock } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ONE_ETHER } from "@test-utils";
import assert from "assert";
import { expect } from "chai";
import { ContractTransactionReceipt } from "ethers";
import { ethers } from "hardhat";

describe("Method: start", () => {
  const VESTING_NAME = "Test Vesting";
  const VESTING_ID = Buffer.from([
    VESTING_NAME.length,
    ...Buffer.from(Buffer.from(VESTING_NAME).toString("hex").padEnd(0x3e, "0"), "hex"),
  ]);
  const PERIOD_SIZE = 30 * 24 * 60 * 60;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let token: ERC20Mock;
  let factory: CliffAndVesting__factory;
  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    token = await ethers.getContractFactory("ERC20Mock").then((f) => f.deploy("ERC20 Mocked", "ERC20M"));
    factory = await ethers.getContractFactory("CliffAndVesting");
  });

  describe("When called not from owner", () => {
    let contract: CliffAndVesting;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
    });
    it("should revert with OwnableUnauthorizedAccount", async () => {
      await expect(contract.connect(user1).start())
        .revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(user1);
    });
  });

  describe("When vesting already started", () => {
    let contract: CliffAndVesting;
    before(async () => {
      const RESERVE_AMOUNT = 123n * ONE_ETHER;
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
      await contract.reserve([{ account: user1, amount: RESERVE_AMOUNT }]);
      await token.mint(owner, RESERVE_AMOUNT);
      await token.approve(contract, RESERVE_AMOUNT);
      await contract.start();
    });
    it("should revert with AlreadyStarted", async () => {
      await expect(contract.start()).revertedWithCustomError(contract, "AlreadyStarted").withArgs();
    });
  });

  describe("When not reserved amounts", () => {
    let contract: CliffAndVesting;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
    });
    it("should revert with InvalidConfig", async () => {
      await expect(contract.start()).revertedWithCustomError(contract, "InvalidConfig").withArgs();
    });
  });

  describe("When no token approval", () => {
    const ALLOWANCE = 123n * ONE_ETHER;
    const RESERVE_1 = 234n * ONE_ETHER;
    let contract: CliffAndVesting;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
      await contract.reserve([{ account: user1, amount: RESERVE_1 }]);
      await token.approve(contract, ALLOWANCE);
    });
    it("should revert with ERC20InsufficientAllowance", async () => {
      await expect(contract.start())
        .revertedWithCustomError(token, "ERC20InsufficientAllowance")
        .withArgs(contract, ALLOWANCE, RESERVE_1);
    });
  });

  describe("When not enough balance", () => {
    const BALANCE = 123n * ONE_ETHER;
    const RESERVE_1 = 234n * ONE_ETHER;
    let contract: CliffAndVesting;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
      await contract.reserve([{ account: user1, amount: RESERVE_1 }]);
      const balance = await token.balanceOf(owner);
      if (balance > BALANCE) await token.burn(balance - BALANCE);
      else if (balance < BALANCE) await token.mint(owner, BALANCE - balance);
      await token.approve(contract, RESERVE_1);
    });
    it("should revert with ERC20InsufficientBalance", async () => {
      await expect(contract.start())
        .revertedWithCustomError(token, "ERC20InsufficientBalance")
        .withArgs(owner, BALANCE, RESERVE_1);
    });
  });

  describe("When has reserves", () => {
    const RESERVE_1 = 123n * ONE_ETHER;
    const RESERVE_2 = 234n * ONE_ETHER;
    const ALLOWANCE = 456n * ONE_ETHER;
    const BALANCE = 567n * ONE_ETHER;
    let contract: CliffAndVesting;
    let totalSupply: bigint;
    before(async () => {
      const balance = await token.balanceOf(owner);
      if (balance < BALANCE) await token.mint(owner, BALANCE - balance);
      else if (balance > BALANCE) await token.burn(balance - BALANCE);
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
      await contract.reserve([
        { account: user1, amount: RESERVE_1 },
        { account: user2, amount: RESERVE_2 },
      ]);
      await token.approve(contract, ALLOWANCE);
      totalSupply = await token.totalSupply();
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.start();
      receipt = await response.wait();
      assert(receipt);
    });
    it("owner balance should decrease by total reserves", async () => {
      const actual = await token.balanceOf(owner);
      const expected = BALANCE - (RESERVE_1 + RESERVE_2);
      assert.strictEqual(actual, expected);
    });
    it("owner allowance should decrease by total reserves", async () => {
      const actual = await token.allowance(owner, contract);
      const expected = ALLOWANCE - (RESERVE_1 + RESERVE_2);
      assert.strictEqual(actual, expected);
    });
    it("contract balance should increase by total reserves", async () => {
      const actual = await token.balanceOf(contract);
      const expected = RESERVE_1 + RESERVE_2;
      assert.strictEqual(actual, expected);
    });
    it("token total supply should not change", async () => {
      const actual = await token.totalSupply();
      assert.strictEqual(actual, totalSupply);
    });
    it("vesting should be started", async () => {
      const actual = await contract.started();
      assert.strictEqual(actual, true);
    });
    it("starting timestamp should be saved", async function () {
      if (!receipt) this.skip();
      const actual = await contract.startedAt();
      const startBlock = await ethers.provider.getBlock(receipt.blockNumber);
      assert(startBlock);
      assert.strictEqual(actual, BigInt(startBlock.timestamp));
    });
    it("should emit VestingStarted event", async function () {
      if (!receipt) this.skip();
      const startBlock = await ethers.provider.getBlock(receipt.blockNumber);
      assert(startBlock);
      await expect(receipt)
        .emit(contract, "VestingStarted")
        .withArgs(RESERVE_1 + RESERVE_2, startBlock.timestamp);
    });
  });
});
