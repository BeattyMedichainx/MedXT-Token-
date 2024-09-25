import { CliffAndVesting, CliffAndVesting__factory, ERC20Mock } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ONE_ETHER } from "@test-utils";
import { ethers } from "hardhat";
import { time as hreTime } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import assert from "assert";
import { ContractTransactionReceipt } from "ethers";

describe("Method: claimBatch", () => {
  const VESTING_NAME = "Test Vesting";
  const VESTING_ID = Buffer.from([
    VESTING_NAME.length,
    ...Buffer.from(Buffer.from(VESTING_NAME).toString("hex").padEnd(0x3e, "0"), "hex"),
  ]);
  const PERIOD_SIZE = 30 * 24 * 60 * 60;
  const RESERVE_1 = 123n * ONE_ETHER;
  const RESERVE_2 = 234n * ONE_ETHER;
  const RESERVE_3 = 345n * ONE_ETHER;
  const INITIAL_RELEASE_X18 = (45n * ONE_ETHER) / 100n;
  const CLIFFS = 3;
  const VESTINGS = 12n;
  const PASSED_VESTINGS = 5;

  const TOTAL_RESERVE_AMOUNT = RESERVE_1 + RESERVE_2 + RESERVE_3;

  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let token: ERC20Mock;
  let factory: CliffAndVesting__factory;
  let contract: CliffAndVesting;

  before(async () => {
    [owner, user1, user2, user3] = await ethers.getSigners();
    token = await ethers.getContractFactory("ERC20Mock").then((f) => f.deploy("ERC20 Mocked", "ERC20M"));
    factory = await ethers.getContractFactory("CliffAndVesting");
  });

  describe("When called not from owner", () => {
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, CLIFFS, VESTINGS, INITIAL_RELEASE_X18, token);
      await contract.reserve([
        { account: user1, amount: RESERVE_1 },
        { account: user2, amount: RESERVE_2 },
        { account: user3, amount: RESERVE_3 },
      ]);
      await token.mint(owner, TOTAL_RESERVE_AMOUNT);
      await token.approve(contract, TOTAL_RESERVE_AMOUNT);
      await contract.start();
      await hreTime.increase(PERIOD_SIZE * (CLIFFS + PASSED_VESTINGS));
    });
    it("should revert with OwnableUnauthorizedAccount", async () => {
      await expect(contract.connect(user1).claimBatch([user1, user2]))
        .revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(user1);
    });
  });

  describe("When vesting is not started", () => {
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, CLIFFS, VESTINGS, INITIAL_RELEASE_X18, token);
      await contract.reserve([
        { account: user1, amount: RESERVE_1 },
        { account: user2, amount: RESERVE_2 },
        { account: user3, amount: RESERVE_3 },
      ]);
    });
    it("should revert with NotStarted", async () => {
      await expect(contract.claimBatch([user1, user2]))
        .revertedWithCustomError(contract, "NotStarted")
        .withArgs();
    });
  });

  describe("When called from owner", () => {
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, CLIFFS, VESTINGS, INITIAL_RELEASE_X18, token);
      await contract.reserve([
        { account: user1, amount: RESERVE_1 },
        { account: user2, amount: RESERVE_2 },
        { account: user3, amount: RESERVE_3 },
      ]);
      await token.mint(owner, TOTAL_RESERVE_AMOUNT);
      await token.approve(contract, TOTAL_RESERVE_AMOUNT);
      await contract.start();
      await hreTime.increase(PERIOD_SIZE * (CLIFFS + PASSED_VESTINGS));
    });
    const INITIAL_RELEASE_AMOUNT_1 = (RESERVE_1 * INITIAL_RELEASE_X18) / ONE_ETHER;
    const VESTING_AMOUNT_1 = RESERVE_1 - INITIAL_RELEASE_AMOUNT_1;
    const EXPECTED_CLAIM_AMOUNT_1 = INITIAL_RELEASE_AMOUNT_1 + (VESTING_AMOUNT_1 * BigInt(PASSED_VESTINGS)) / VESTINGS;
    const INITIAL_RELEASE_AMOUNT_2 = (RESERVE_2 * INITIAL_RELEASE_X18) / ONE_ETHER;
    const VESTING_AMOUNT_2 = RESERVE_2 - INITIAL_RELEASE_AMOUNT_2;
    const EXPECTED_CLAIM_AMOUNT_2 = INITIAL_RELEASE_AMOUNT_2 + (VESTING_AMOUNT_2 * BigInt(PASSED_VESTINGS)) / VESTINGS;
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.claimBatch([user1, user2]);
      receipt = await response.wait();
      assert(receipt);
    });
    it("should increase balance of provided accounts by claimable amount", async () => {
      const balance1 = await token.balanceOf(user1);
      assert.strictEqual(balance1, EXPECTED_CLAIM_AMOUNT_1);
      const balance2 = await token.balanceOf(user2);
      assert.strictEqual(balance2, EXPECTED_CLAIM_AMOUNT_2);
    });
    it("should not increase balance of not provided accounts", async () => {
      const actual = await token.balanceOf(user3);
      assert.strictEqual(actual, 0n);
    });
    it("should save claimed amount of provided accounts", async () => {
      const actual1 = await contract.accountReserve(user1).then((res) => res.claimedAmount);
      assert.strictEqual(actual1, EXPECTED_CLAIM_AMOUNT_1);
      const actual2 = await contract.accountReserve(user2).then((res) => res.claimedAmount);
      assert.strictEqual(actual2, EXPECTED_CLAIM_AMOUNT_2);
    });
    it("should not change claimed amount of not provided accounts", async () => {
      const actual = await contract.accountReserve(user3).then((res) => res.claimedAmount);
      assert.strictEqual(actual, 0n);
    });
    it("should decrease contract balance by total claim amount of provided accounts", async () => {
      const actual = await token.balanceOf(contract);
      assert.strictEqual(actual, TOTAL_RESERVE_AMOUNT - (EXPECTED_CLAIM_AMOUNT_1 + EXPECTED_CLAIM_AMOUNT_2));
    });
    it("should emit TokensClaimed for each provided account", async function () {
      if (!receipt) this.skip();
      await expect(receipt)
        .emit(contract, "TokensClaimed")
        .withArgs(user1, true, EXPECTED_CLAIM_AMOUNT_1, EXPECTED_CLAIM_AMOUNT_1);
      await expect(receipt)
        .emit(contract, "TokensClaimed")
        .withArgs(user2, true, EXPECTED_CLAIM_AMOUNT_2, EXPECTED_CLAIM_AMOUNT_2);
    });
  });
});
