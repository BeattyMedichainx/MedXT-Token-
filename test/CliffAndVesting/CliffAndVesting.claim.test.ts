import { CliffAndVesting, CliffAndVesting__factory, ERC20Mock } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ONE_ETHER } from "@test-utils";
import assert from "assert";
import { expect } from "chai";
import { ContractTransactionReceipt, MaxUint256 } from "ethers";
import { ethers } from "hardhat";
import { time as hreTime } from "@nomicfoundation/hardhat-network-helpers";

describe("Method: claim", () => {
  const VESTING_NAME = "Test Vesting";
  const VESTING_ID = Buffer.from([
    VESTING_NAME.length,
    ...Buffer.from(Buffer.from(VESTING_NAME).toString("hex").padEnd(0x3e, "0"), "hex"),
  ]);
  const PERIOD_SIZE = 30 * 24 * 60 * 60;

  let factory: CliffAndVesting__factory;
  let token: ERC20Mock;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  before(async () => {
    [owner, user] = await ethers.getSigners();
    token = await ethers.getContractFactory("ERC20Mock").then((f) => f.deploy("ERC20 Mocked", "ERC20M"));
    factory = await ethers.getContractFactory("CliffAndVesting");
    await token.mint(owner, MaxUint256);
  });

  describe("When vesting is not started", () => {
    let contract: CliffAndVesting;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
    });
    it("should revert with NotStarted", async () => {
      await expect(contract.connect(user).claim()).revertedWithCustomError(contract, "NotStarted").withArgs();
    });
  });

  describe("When no initial release and no periods passed", () => {
    const RESERVE_AMOUNT = 123n * ONE_ETHER;
    let contract: CliffAndVesting;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
      await contract.reserve([{ account: user, amount: RESERVE_AMOUNT }]);
      await token.approve(contract, RESERVE_AMOUNT);
      await contract.start();
    });
    it("claimable amount should equals zero", async () => {
      const actual = await contract.claimableAmount(user);
      assert.strictEqual(actual, 0n);
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(user).claim();
      receipt = await response.wait();
      assert(receipt);
    });
    it("should not emit any transfers", async function () {
      if (!receipt) this.skip();
      await expect(receipt).not.emit(token, "Transfer");
    });
    it("should not emit TokensClaimed event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).not.emit(contract, "TokensClaimed");
    });
    it("account claimed amount should not change", async () => {
      const actual = await contract.accountReserve(user).then((reserve) => reserve.claimedAmount);
      assert.strictEqual(actual, 0n);
    });
  });

  describe("When has initial release and no periods passed", () => {
    const RESERVE_AMOUNT = 123n * ONE_ETHER;
    const INITIAL_RELEASE_X18 = (23n * ONE_ETHER) / 100n;
    const EXPECTED_CLAIM_AMOUNT = (RESERVE_AMOUNT * INITIAL_RELEASE_X18) / ONE_ETHER;
    let contract: CliffAndVesting;
    let prevUserBalance: bigint;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, INITIAL_RELEASE_X18, token);
      await contract.reserve([{ account: user, amount: RESERVE_AMOUNT }]);
      await token.approve(contract, RESERVE_AMOUNT);
      await contract.start();
      prevUserBalance = await token.balanceOf(user);
    });
    it("claimable amount should equals initial release amount", async () => {
      const actual = await contract.claimableAmount(user);
      assert.strictEqual(actual, EXPECTED_CLAIM_AMOUNT);
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(user).claim();
      receipt = await response.wait();
      assert(receipt);
    });
    it("should update claim amount by reserve amount multiplied by initial release", async () => {
      const actual = await contract.accountReserve(user).then((reserve) => reserve.claimedAmount);
      assert.strictEqual(actual, EXPECTED_CLAIM_AMOUNT);
    });
    it("contract balance should decrease by claim amount", async () => {
      const actual = await token.balanceOf(contract);
      const expected = RESERVE_AMOUNT - EXPECTED_CLAIM_AMOUNT;
      assert.strictEqual(actual, expected);
    });
    it("user balance should increase by claim amount", async () => {
      const actual = await token.balanceOf(user);
      const expected = prevUserBalance + EXPECTED_CLAIM_AMOUNT;
      assert.strictEqual(actual, expected);
    });
    it("should emit TokensClaimed event", async function () {
      if (!receipt) this.skip();
      await expect(receipt)
        .emit(contract, "TokensClaimed")
        .withArgs(user, false, EXPECTED_CLAIM_AMOUNT, EXPECTED_CLAIM_AMOUNT);
    });
  });

  describe("When all cliff and no vesting periods have been passed", () => {
    const RESERVE_AMOUNT = 123n * ONE_ETHER;
    const INITIAL_RELEASE_X18 = (23n * ONE_ETHER) / 100n;
    const EXPECTED_CLAIM_AMOUNT = (RESERVE_AMOUNT * INITIAL_RELEASE_X18) / ONE_ETHER;
    let contract: CliffAndVesting;
    let prevUserBalance: bigint;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 1, 1, INITIAL_RELEASE_X18, token);
      await contract.reserve([{ account: user, amount: RESERVE_AMOUNT }]);
      await token.approve(contract, RESERVE_AMOUNT);
      await contract.start();
      await hreTime.increase(PERIOD_SIZE);
      prevUserBalance = await token.balanceOf(user);
    });
    it("claimable amount should equals initial release amount", async () => {
      const actual = await contract.claimableAmount(user);
      assert.strictEqual(actual, EXPECTED_CLAIM_AMOUNT);
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(user).claim();
      receipt = await response.wait();
      assert(receipt);
    });
    it("should update claim amount only by initial release", async () => {
      const actual = await contract.accountReserve(user).then((reserve) => reserve.claimedAmount);
      assert.strictEqual(actual, EXPECTED_CLAIM_AMOUNT);
    });
    it("contract balance should decrease by initial release", async () => {
      const actual = await token.balanceOf(contract);
      const expected = RESERVE_AMOUNT - EXPECTED_CLAIM_AMOUNT;
      assert.strictEqual(actual, expected);
    });
    it("user balance should increase by initial release", async () => {
      const actual = await token.balanceOf(user);
      const expected = prevUserBalance + EXPECTED_CLAIM_AMOUNT;
      assert.strictEqual(actual, expected);
    });
    it("should emit TokensClaimed event", async function () {
      if (!receipt) this.skip();
      await expect(receipt)
        .emit(contract, "TokensClaimed")
        .withArgs(user, false, EXPECTED_CLAIM_AMOUNT, EXPECTED_CLAIM_AMOUNT);
    });
  });

  describe("When all cliff and one vesting periods has been passed", () => {
    const RESERVE_AMOUNT = 123n * ONE_ETHER;
    const INITIAL_RELEASE_X18 = (23n * ONE_ETHER) / 100n;
    const CLIFFS = 3;
    const VESTINGS = 12n;
    const INITIAL_RELEASE_AMOUNT = (RESERVE_AMOUNT * INITIAL_RELEASE_X18) / ONE_ETHER;
    const VESTING_AMOUNT = RESERVE_AMOUNT - INITIAL_RELEASE_AMOUNT;
    const EXPECTED_CLAIM_AMOUNT = INITIAL_RELEASE_AMOUNT + VESTING_AMOUNT / VESTINGS;

    let contract: CliffAndVesting;
    let prevUserBalance: bigint;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, CLIFFS, VESTINGS, INITIAL_RELEASE_X18, token);
      await contract.reserve([{ account: user, amount: RESERVE_AMOUNT }]);
      await token.approve(contract, RESERVE_AMOUNT);
      await contract.start();
      await hreTime.increase(PERIOD_SIZE * (CLIFFS + 1));
      prevUserBalance = await token.balanceOf(user);
    });
    it("claimable amount should equals initial release + 1 vesting reserve amount", async () => {
      const actual = await contract.claimableAmount(user);
      assert.strictEqual(actual, EXPECTED_CLAIM_AMOUNT);
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(user).claim();
      receipt = await response.wait();
      assert(receipt);
    });
    it("should update claim amount to initial release + 1 vesting reserve amount", async () => {
      const actual = await contract.accountReserve(user).then((res) => res.claimedAmount);
      assert.strictEqual(actual, EXPECTED_CLAIM_AMOUNT);
    });
    it("contract balance should decrease by initial release + 1 vesting reserve amount", async () => {
      const actual = await token.balanceOf(contract);
      const expected = RESERVE_AMOUNT - EXPECTED_CLAIM_AMOUNT;
      assert.strictEqual(actual, expected);
    });
    it("user balance should increase by initial release + 1 vesting release amount", async () => {
      const actual = await token.balanceOf(user);
      const expected = prevUserBalance + EXPECTED_CLAIM_AMOUNT;
      assert.strictEqual(actual, expected);
    });
    it("should emit TokensClaimed event", async function () {
      if (!receipt) this.skip();
      await expect(receipt)
        .emit(contract, "TokensClaimed")
        .withArgs(user, false, EXPECTED_CLAIM_AMOUNT, EXPECTED_CLAIM_AMOUNT);
    });
  });

  describe("When already has claimed amount", () => {
    const RESERVE_AMOUNT = 123n * ONE_ETHER;
    const INITIAL_RELEASE_X18 = (23n * ONE_ETHER) / 100n;
    const CLIFFS = 3;
    const VESTINGS = 12n;
    const INITIAL_RELEASE_AMOUNT = (RESERVE_AMOUNT * INITIAL_RELEASE_X18) / ONE_ETHER;
    const VESTING_AMOUNT = RESERVE_AMOUNT - INITIAL_RELEASE_AMOUNT;
    const PREV_CLAIM_AMOUNT = INITIAL_RELEASE_AMOUNT + VESTING_AMOUNT / VESTINGS;
    const EXPECTED_CLAIM_AMOUNT = INITIAL_RELEASE_AMOUNT + (2n * VESTING_AMOUNT) / VESTINGS;

    let contract: CliffAndVesting;
    let prevUserBalance: bigint;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, CLIFFS, VESTINGS, INITIAL_RELEASE_X18, token);
      await contract.reserve([{ account: user, amount: RESERVE_AMOUNT }]);
      await token.approve(contract, RESERVE_AMOUNT);
      await contract.start();
      await hreTime.increase(PERIOD_SIZE * (CLIFFS + 1));
      await contract.connect(user).claim();
      await hreTime.increase(PERIOD_SIZE);
      prevUserBalance = await token.balanceOf(user);
    });
    it("claimable amount should equals unclaimed vesting amount", async () => {
      const actual = await contract.claimableAmount(user);
      assert.strictEqual(actual, EXPECTED_CLAIM_AMOUNT - PREV_CLAIM_AMOUNT);
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(user).claim();
      receipt = await response.wait();
      assert(receipt);
    });
    it("claim amount should equal sum of claims", async () => {
      const actual = await contract.accountReserve(user).then((res) => res.claimedAmount);
      assert.strictEqual(actual, EXPECTED_CLAIM_AMOUNT);
    });
    it("should increase user balance by unclaimed vesting amount", async () => {
      const actual = await token.balanceOf(user);
      const expected = prevUserBalance + (EXPECTED_CLAIM_AMOUNT - PREV_CLAIM_AMOUNT);
      assert.strictEqual(actual, expected);
    });
    it("should decrease contract balance by unclaimed vesting amount", async () => {
      const actual = await token.balanceOf(contract);
      const expected = RESERVE_AMOUNT - EXPECTED_CLAIM_AMOUNT;
      assert.strictEqual(actual, expected);
    });
    it("should emit TokensClaimed event", async function () {
      if (!receipt) this.skip();
      await expect(receipt)
        .emit(contract, "TokensClaimed")
        .withArgs(user, false, EXPECTED_CLAIM_AMOUNT, EXPECTED_CLAIM_AMOUNT - PREV_CLAIM_AMOUNT);
    });
  });

  describe("When passed periods gt cliff + vesting", () => {
    const RESERVE_AMOUNT = 123n * ONE_ETHER;
    const INITIAL_RELEASE_X18 = (23n * ONE_ETHER) / 100n;
    const CLIFFS = 3;
    const VESTINGS = 12;

    let contract: CliffAndVesting;
    let prevUserBalance: bigint;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, CLIFFS, VESTINGS, INITIAL_RELEASE_X18, token);
      await contract.reserve([{ account: user, amount: RESERVE_AMOUNT }]);
      await token.approve(contract, RESERVE_AMOUNT);
      await contract.start();
      await hreTime.increase(PERIOD_SIZE * (CLIFFS + VESTINGS + 1));
      prevUserBalance = await token.balanceOf(user);
    });
    it("claimable amount should equals total reserve amount", async () => {
      const actual = await contract.claimableAmount(user);
      assert.strictEqual(actual, RESERVE_AMOUNT);
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(user).claim();
      receipt = await response.wait();
      assert(receipt);
    });
    it("user claimed amount should be equal to total reserve amount", async () => {
      const actual = await contract.accountReserve(user).then((res) => res.claimedAmount);
      assert.strictEqual(actual, RESERVE_AMOUNT);
    });
    it("should increase by user balance by total reserve amount", async () => {
      const actual = await token.balanceOf(user);
      const expected = prevUserBalance + RESERVE_AMOUNT;
      assert.strictEqual(actual, expected);
    });
    it("should decrease contract balance by total reserve amount", async () => {
      const actual = await token.balanceOf(contract);
      assert.strictEqual(actual, 0n);
    });
    it("should emit TokensClaimed event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).emit(contract, "TokensClaimed").withArgs(user, false, RESERVE_AMOUNT, RESERVE_AMOUNT);
    });
  });

  describe("When called second time in one period", () => {
    const RESERVE_AMOUNT = 123n * ONE_ETHER;
    const INITIAL_RELEASE_X18 = (23n * ONE_ETHER) / 100n;
    const INITIAL_RELEASE_AMOUNT = (RESERVE_AMOUNT * INITIAL_RELEASE_X18) / ONE_ETHER;
    const CLIFFS = 3;
    const VESTINGS = 12n;
    const VESTING_AMOUNT = RESERVE_AMOUNT - INITIAL_RELEASE_AMOUNT;
    const EXPECTED_CLAIM_AMOUNT = INITIAL_RELEASE_AMOUNT + VESTING_AMOUNT / VESTINGS;
    let contract: CliffAndVesting;
    let prevUserBalance: bigint;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, CLIFFS, VESTINGS, INITIAL_RELEASE_X18, token);
      await contract.reserve([{ account: user, amount: RESERVE_AMOUNT }]);
      await token.approve(contract, RESERVE_AMOUNT);
      await contract.start();
      await hreTime.increase(PERIOD_SIZE * (CLIFFS + 1));
      await contract.connect(user).claim();
      prevUserBalance = await token.balanceOf(user);
    });
    it("claimable amount should equals zero", async () => {
      const actual = await contract.claimableAmount(user);
      assert.strictEqual(actual, 0n);
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(user).claim();
      receipt = await response.wait();
      assert(receipt);
    });
    it("user claim amount should not change", async () => {
      const actual = await contract.accountReserve(user).then((res) => res.claimedAmount);
      assert.strictEqual(actual, EXPECTED_CLAIM_AMOUNT);
    });
    it("user balance should not change", async () => {
      const actual = await token.balanceOf(user);
      assert.strictEqual(actual, prevUserBalance);
    });
    it("contract balance should not change", async () => {
      const actual = await token.balanceOf(contract);
      assert.strictEqual(actual, RESERVE_AMOUNT - EXPECTED_CLAIM_AMOUNT);
    });
    it("should not emit TokensClaimed event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).not.emit(contract, "TokensClaimed");
    });
  });

  describe("When has not vesting periods", () => {
    const RESERVE_AMOUNT = 123n * ONE_ETHER;
    let contract: CliffAndVesting;
    let prevUserBalance: bigint;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 0, ONE_ETHER, token);
      await contract.reserve([{ account: user, amount: RESERVE_AMOUNT }]);
      await token.approve(contract, RESERVE_AMOUNT);
      await contract.start();
      prevUserBalance = await token.balanceOf(user);
    });
    it("claimable amount should equals total reserve amount", async () => {
      const actual = await contract.claimableAmount(user);
      assert.strictEqual(actual, RESERVE_AMOUNT);
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.connect(user).claim();
      receipt = await response.wait();
      assert(receipt);
    });
    it("user claimed amount should increase by total reserve amount", async () => {
      const actual = await contract.accountReserve(user).then((res) => res.claimedAmount);
      assert.strictEqual(actual, RESERVE_AMOUNT);
    });
    it("user balance should increase by total reserve amount", async () => {
      const actual = await token.balanceOf(user);
      assert.strictEqual(actual, prevUserBalance + RESERVE_AMOUNT);
    });
    it("contract balance should decrease by total reserve amount", async () => {
      const actual = await token.balanceOf(contract);
      assert.strictEqual(actual, 0n);
    });
    it("should emit TokensClaimed event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).emit(contract, "TokensClaimed").withArgs(user, false, RESERVE_AMOUNT, RESERVE_AMOUNT);
    });
  });
});
