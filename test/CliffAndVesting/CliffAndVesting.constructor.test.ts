import { CliffAndVesting, CliffAndVesting__factory } from "@contracts";
import { randomAccount, ZERO_ADDRESS } from "@test-utils";
import assert from "assert";
import { expect } from "chai";
import { randomBytes } from "crypto";
import { ethers } from "hardhat";

describe("constructor", () => {
  const VESTING_NAME = "Test Vesting";
  const VESTING_ID = Buffer.from([
    VESTING_NAME.length,
    ...Buffer.from(Buffer.from(VESTING_NAME).toString("hex").padEnd(0x3e, "0"), "hex"),
  ]);
  let factory: CliffAndVesting__factory;
  before(async () => {
    factory = await ethers.getContractFactory("CliffAndVesting");
  });

  describe("vesting id", () => {
    describe("When first byte of vesting id is 0x20", () => {
      it("should revert with InvalidConfig", async () => {
        const vestingId = Buffer.from([0x20, ...randomBytes(0x1f)]);
        await expect(factory.deploy(vestingId, 1, 0, 1, 0, randomAccount())).revertedWithCustomError(
          factory,
          "InvalidConfig",
        );
      });
    });

    describe("When first byte of vesting id gt 0x20", () => {
      it("should revert with InvalidConfig", async () => {
        const vestingId = Buffer.from([0x21, ...randomBytes(0x1f)]);
        await expect(factory.deploy(vestingId, 1, 0, 1, 0, randomAccount())).revertedWithCustomError(
          factory,
          "InvalidConfig",
        );
      });
    });

    describe("When first byte of vesting id lt 0x20", () => {
      const MAX_LENGTH_VESTING_NAME = "Vesting Name: 31 symbols length";
      const MAX_LENGETH_VESTING_ID = Buffer.from([0x1f, ...Buffer.from(MAX_LENGTH_VESTING_NAME)]);
      let contract: CliffAndVesting | null = null;
      before(() => assert(MAX_LENGTH_VESTING_NAME.length === 31));
      it("should succeed", async () => {
        contract = await factory.deploy(MAX_LENGETH_VESTING_ID, 1, 0, 1, 0, randomAccount());
      });
      it("should save vesting name", async function () {
        if (!contract) this.skip();
        const actual = await contract.vestingName();
        assert.strictEqual(actual, MAX_LENGTH_VESTING_NAME);
      });
    });
  });

  describe("When period size is zero", () => {
    it("should revert with InvalidConfig", async () => {
      await expect(factory.deploy(VESTING_ID, 0, 0, 1, 0, randomAccount())).revertedWithCustomError(
        factory,
        "InvalidConfig",
      );
    });
  });

  describe("When period size gt 360 days", () => {
    const PERIOD_SIZE = 360 * 24 * 60 * 60 + 1;
    it("should revert with InvalidConfig", async () => {
      await expect(factory.deploy(VESTING_ID, PERIOD_SIZE, 0, 1, 0, randomAccount())).revertedWithCustomError(
        factory,
        "InvalidConfig",
      );
    });
  });

  describe("When initial release gt 100%", () => {
    it("should revert with InvalidConfig", async () => {
      await expect(factory.deploy(VESTING_ID, 1, 0, 1, 10n ** 18n + 1n, randomAccount())).revertedWithCustomError(
        factory,
        "InvalidConfig",
      );
    });
  });

  describe("When vesting is zero and initial release lt 100%", () => {
    it("should revert with InvalidConfig", async () => {
      await expect(factory.deploy(VESTING_ID, 1, 0, 0, 1, randomAccount())).revertedWithCustomError(
        factory,
        "InvalidConfig",
      );
    });
  });

  describe("When initial release eq 100% and vesting gt 0", () => {
    it("should revert with InvalidConfig", async () => {
      await expect(factory.deploy(VESTING_ID, 1, 0, 1, 10n ** 18n, randomAccount())).revertedWithCustomError(
        factory,
        "InvalidConfig",
      );
    });
  });

  describe("When token address is zero", () => {
    it("should revert with InvalidConfig", async () => {
      await expect(factory.deploy(VESTING_ID, 1, 0, 1, 0, ZERO_ADDRESS))
        .revertedWithCustomError(factory, "InvalidConfig")
        .withArgs();
    });
  });

  describe("When vesting periods count gt 120", () => {
    it("should revert with InvalidConfig", async () => {
      await expect(factory.deploy(VESTING_ID, 1, 0, 121, 0, randomAccount())).revertedWithCustomError(
        factory,
        "InvalidConfig",
      );
    });
  });

  describe("When all parameters are correct", () => {
    const PERIOD_SIZE = 123n;
    const CLIFF = 234n;
    const VESTING = 34n;
    const INITIAL_RELEASE_X18 = 456n * 10n ** 15n; // 45.6 %
    const TOKEN_ADDRESS = randomAccount();
    let contract: CliffAndVesting | null = null;
    it("should succeed", async () => {
      contract = await factory.deploy(VESTING_ID, PERIOD_SIZE, CLIFF, VESTING, INITIAL_RELEASE_X18, TOKEN_ADDRESS);
    });
    it("vesting name should be saved", async function () {
      if (!contract) this.skip();
      const actual = await contract.vestingName();
      const expectedLength = VESTING_ID[0];
      const expected = VESTING_ID.subarray(1, expectedLength + 1).toString();
      assert.strictEqual(actual, expected);
    });
    it("period size should be saved", async function () {
      if (!contract) this.skip();
      const actual = await contract.periodSize();
      assert.strictEqual(actual, PERIOD_SIZE);
    });
    it("cliff periods count should be saved", async function () {
      if (!contract) this.skip();
      const actual = await contract.cliff();
      assert.strictEqual(actual, CLIFF);
    });
    it("vesting periods count should be saved", async function () {
      if (!contract) this.skip();
      const actual = await contract.vesting();
      assert.strictEqual(actual, VESTING);
    });
    it("initial release should be saved", async function () {
      if (!contract) this.skip();
      const actual = await contract.initialReleaseX18();
      assert.strictEqual(actual, INITIAL_RELEASE_X18);
    });
    it("token address should be saved", async function () {
      if (!contract) this.skip();
      const actual = await contract.token();
      assert.strictEqual(actual, TOKEN_ADDRESS);
    });
  });
});
