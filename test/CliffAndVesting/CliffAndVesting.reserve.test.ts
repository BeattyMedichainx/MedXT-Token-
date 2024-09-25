import { CliffAndVesting, CliffAndVesting__factory, ERC20Mock } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ONE_ETHER, ZERO_ADDRESS } from "@test-utils";
import assert from "assert";
import { expect } from "chai";
import { ContractTransactionReceipt, MaxUint256 } from "ethers";
import { ethers } from "hardhat";

describe("Method: reserve", () => {
  const VESTING_NAME = "Test Vesting";
  const VESTING_ID = Buffer.from([
    VESTING_NAME.length,
    ...Buffer.from(Buffer.from(VESTING_NAME).toString("hex").padEnd(0x3e, "0"), "hex"),
  ]);
  const PERIOD_SIZE = 30 * 24 * 60 * 60;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let factory: CliffAndVesting__factory;
  let token: ERC20Mock;
  before(async () => {
    [owner, user1, user2, user3] = await ethers.getSigners();
    factory = await ethers.getContractFactory("CliffAndVesting");
    token = await ethers.getContractFactory("ERC20Mock").then((f) => f.deploy("ERC20 Mocked", "ERC20M"));
  });

  describe("When called not from owner", () => {
    let contract: CliffAndVesting;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
    });
    it("should revert with OwnableUnauthorizedAccount", async () => {
      await expect(contract.connect(user1).reserve([]))
        .revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(user1);
    });
  });

  describe("When vesting is started", () => {
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
      await expect(contract.reserve([])).revertedWithCustomError(contract, "AlreadyStarted").withArgs();
    });
  });

  describe("When account is zero address", () => {
    let contract: CliffAndVesting;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
    });
    it("should revert with InvalidConfig", async () => {
      await expect(contract.reserve([{ account: ZERO_ADDRESS, amount: 123n }]))
        .revertedWithCustomError(contract, "InvalidConfig")
        .withArgs();
    });
  });

  describe("When amount is zero", () => {
    let contract: CliffAndVesting;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
    });
    it("should revert with InvalidConfig", async () => {
      await expect(contract.reserve([{ account: user1, amount: 0 }]))
        .revertedWithCustomError(contract, "InvalidConfig")
        .withArgs();
    });
  });

  describe("When user reserve sum exceeds limit", () => {
    const RESERVE_1 = 38597363079105398474523661669562635951089994888546854679819n;
    const RESERVE_2 = 77194726158210796949047323339125271902179989777093709359639n;
    let contract: CliffAndVesting;
    before(async () => {
      assert.strictEqual(RESERVE_1 + RESERVE_2, MaxUint256 / 10n ** 18n + 1n);
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
      await contract.reserve([{ account: user1, amount: RESERVE_1 }]);
    });
    it("should revert with InvalidConfig", async () => {
      await expect(contract.reserve([{ account: user1, amount: RESERVE_2 }]))
        .revertedWithCustomError(contract, "InvalidConfig")
        .withArgs();
    });
  });

  describe("When multiple reserves provided", () => {
    const RESERVE_1 = 123n * ONE_ETHER;
    const RESERVE_2 = 234n * ONE_ETHER;
    const RESERVE_3 = 345n * ONE_ETHER;
    let contract: CliffAndVesting;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
      await contract.reserve([{ account: user3, amount: RESERVE_3 }]);
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.reserve([
        { account: user1, amount: RESERVE_1 },
        { account: user2, amount: RESERVE_2 },
      ]);
      receipt = await response.wait();
      assert(receipt);
    });
    it("should save all reserves", async () => {
      const reserve1 = await contract.accountReserve(user1);
      assert.strictEqual(reserve1.account.toLowerCase(), user1.address.toLowerCase());
      assert.strictEqual(reserve1.reservedAmount, RESERVE_1);
      const reserve2 = await contract.accountReserve(user2);
      assert.strictEqual(reserve2.account.toLowerCase(), user2.address.toLowerCase());
      assert.strictEqual(reserve2.reservedAmount, RESERVE_2);
    });
    it("should increase total reserves by sum of provided reserves amounts", async () => {
      const actual = await contract.totalReserveAmount();
      const expected = RESERVE_3 + RESERVE_1 + RESERVE_2;
      assert.strictEqual(actual, expected);
    });
    it("should emit TokensReserved event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).emit(contract, "TokensReserved").withArgs(user1, RESERVE_1, RESERVE_1);
      await expect(receipt).emit(contract, "TokensReserved").withArgs(user2, RESERVE_2, RESERVE_2);
    });
    it("accounts length should be increased by the number of provided reserves", async () => {
      const actual = await contract.accountsLength();
      assert.strictEqual(actual, 3n);
    });
    it("accounts list should append this account addresses", async () => {
      const actual = await contract.accountsList().then((res) => [...res.map((a) => a.toLowerCase())]);
      assert.deepStrictEqual(actual, [
        user3.address.toLowerCase(),
        user1.address.toLowerCase(),
        user2.address.toLowerCase(),
      ]);
    });
  });

  describe("When multiple reserves for the same account provided", () => {
    const RESERVE_1 = 123n * ONE_ETHER;
    const RESERVE_2 = 234n * ONE_ETHER;
    let contract: CliffAndVesting;
    before(async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, token);
      await contract.reserve([
        { account: user1, amount: RESERVE_1 },
        { account: user2, amount: 345n * ONE_ETHER },
      ]);
    });
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const response = await contract.reserve([{ account: user1, amount: RESERVE_2 }]);
      receipt = await response.wait();
      assert(receipt);
    });
    it("should save sum of provided reserve amounts", async () => {
      const actual = await contract.accountReserve(user1);
      const expected = RESERVE_1 + RESERVE_2;
      assert.strictEqual(actual.reservedAmount, expected);
    });
    it("should emit TokensReserved event with reserve amount and sum of reserves", async function () {
      if (!receipt) this.skip();
      await expect(receipt)
        .emit(contract, "TokensReserved")
        .withArgs(user1, RESERVE_2, RESERVE_1 + RESERVE_2);
    });
    it("should not change accounts length", async () => {
      const actual = await contract.accountsLength();
      assert.strictEqual(actual, 2n);
    });
    it("should append no addresses to the accounts list", async () => {
      const actual = await contract.accountsList().then((res) => [...res.map((a) => a.toLowerCase())]);
      assert.deepStrictEqual(actual, [user1.address.toLowerCase(), user2.address.toLowerCase()]);
    });
  });
});
