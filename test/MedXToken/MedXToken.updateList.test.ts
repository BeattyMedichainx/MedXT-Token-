import { MedXToken } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployMedXTokenAndReturnDependencies } from "@test-utils";
import assert from "assert";
import { expect } from "chai";
import { AddressLike, ContractTransactionReceipt, ContractTransactionResponse, EventLog } from "ethers";
import { ethers } from "hardhat";

enum METHOD_NAME {
  UPDATE_WHITELIST = "updateWhitelist",
  UPDATE_BLACKLIST = "updateBlacklist",
  UPDATE_TAXED_ADDRESSES = "updateTaxedAddresses",
  UPDATE_BURNERS_LIST = "updateBurnersList",
}

const suits: {
  methodName: METHOD_NAME;
  update: (
    contract: MedXToken,
    caller: HardhatEthersSigner,
    remove: AddressLike[],
    add: AddressLike[],
  ) => Promise<ContractTransactionResponse>;
  eventName: string;
  get: (contracts: MedXToken, address: AddressLike) => Promise<boolean>;
}[] = [
  {
    methodName: METHOD_NAME.UPDATE_WHITELIST,
    update: async (contract, caller, remove, add) => contract.connect(caller).updateWhitelist(remove, add),
    eventName: "WhitelistUpdated",
    get: async (contract, address) => contract.whitelisted(address),
  },
  {
    methodName: METHOD_NAME.UPDATE_BLACKLIST,
    update: async (contract, caller, remove, add) => contract.connect(caller).updateBlacklist(remove, add),
    eventName: "BlacklistUpdated",
    get: async (contract, address) => contract.blacklisted(address),
  },
  {
    methodName: METHOD_NAME.UPDATE_TAXED_ADDRESSES,
    update: async (contract, caller, remove, add) => contract.connect(caller).updateTaxedAddresses(remove, add),
    eventName: "TaxedListUpdated",
    get: async (contract, address) => contract.applyTax(address),
  },
  {
    methodName: METHOD_NAME.UPDATE_BURNERS_LIST,
    update: async (contract, caller, remove, add) => contract.connect(caller).updateBurnersList(remove, add),
    eventName: "BurnersListUpdated",
    get: async (contract, address) => contract.canBurn(address),
  },
];

for (const { methodName, update, eventName, get } of suits) {
  describe(`Method: ${methodName}`, () => {
    let deployer: HardhatEthersSigner;
    let owner: HardhatEthersSigner;
    let admin: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;
    let contract: MedXToken;
    let wethPairAddress: string;
    before(async () => {
      [deployer, owner, admin, user1, user2] = await ethers.getSigners();
      const fixtures = await deployMedXTokenAndReturnDependencies(deployer, owner, deployer);
      contract = fixtures.contract;
      const contractAddress = await contract.getAddress();
      wethPairAddress = await fixtures.uniV2Factory.getPair(contractAddress, await fixtures.weth.getAddress());
      await contract.updateAdmin(admin);
    });

    describe("When called not from owner nor admin", () => {
      it("should revert with OwnerOrAdminUnauthorizedAccount", async () => {
        await expect(update(contract, deployer, [], []))
          .revertedWithCustomError(contract, "OwnerOrAdminUnauthorizedAccount")
          .withArgs(deployer);
      });
    });

    describe("When added by owner", () => {
      after(async () => update(contract, owner, [user1, user2], []));
      let receipt: ContractTransactionReceipt | null = null;
      it("should succeed", async () => {
        const response = await update(contract, owner, [], [user1, user2]);
        receipt = await response.wait();
        assert(receipt);
      });
      it("should add provided addresses to the list", async () => {
        for (const address of [user1, user2]) {
          const added = await get(contract, address);
          assert.strictEqual(added, true);
        }
      });
      it(`should emit ${eventName} for both addresses`, async function () {
        if (!receipt) this.skip();
        for (const address of [user1, user2]) {
          await expect(receipt).emit(contract, eventName).withArgs(address, true);
        }
      });
    });

    describe("When added by admin", () => {
      after(async () => update(contract, owner, [user1, user2], []));
      it("should succeed", async () => update(contract, admin, [], [user1, user2]));
    });

    describe("When added listed address", () => {
      before(async () => update(contract, owner, [], [user1]));
      after(async () => update(contract, owner, [user1, user2], []));
      let receipt: ContractTransactionReceipt | null = null;
      it("should succeed", async () => {
        const response = await update(contract, owner, [], [user1, user2]);
        receipt = await response.wait();
        assert(receipt);
      });
      it("should keep address in the list", async () => {
        const added = await get(contract, user1);
        assert.strictEqual(added, true);
      });
      it("should add other addresses", async () => {
        const added = await get(contract, user2);
        assert.strictEqual(added, true);
      });
      it(`should not emit ${eventName} for skipped address`, function () {
        if (!receipt) this.skip();
        const filter = (receipt.logs as EventLog[]).filter(
          (log) => log.eventName === eventName && (log.args[0] as string).toLowerCase() === user1.address.toLowerCase(),
        );
        assert.strictEqual(filter.length, 0);
      });
      it(`should emit ${eventName} for other addresses`, async function () {
        if (!receipt) this.skip();
        await expect(receipt).emit(contract, eventName).withArgs(user2, true);
      });
    });

    describe("When removed", () => {
      before(async () => update(contract, owner, [], [user1, user2]));
      after(async () => update(contract, owner, [user1, user2], []));
      let receipt: ContractTransactionReceipt | null = null;
      it("should succeed", async () => {
        const response = await update(contract, owner, [user1, user2], []);
        receipt = await response.wait();
        assert(receipt);
      });
      it("should remove addresses from the list", async () => {
        for (const address of [user1, user2]) {
          const added = await get(contract, address);
          assert.strictEqual(added, false);
        }
      });
      it(`should emit ${eventName}`, async function () {
        if (!receipt) this.skip();
        for (const address of [user1, user2]) {
          await expect(receipt).emit(contract, eventName).withArgs(address, false);
        }
      });
    });

    describe("When removed address should be removed", () => {
      before(async () => update(contract, owner, [], [user2]));
      after(async () => update(contract, owner, [user1, user2], []));
      let receipt: ContractTransactionReceipt | null = null;
      it("should succeed", async () => {
        const response = await update(contract, owner, [user1, user2], []);
        receipt = await response.wait();
        assert(receipt);
      });
      it("should not add address to the list", async () => {
        const added = await get(contract, user1);
        assert.strictEqual(added, false);
      });
      it("should remove other addresses", async () => {
        const added = await get(contract, user2);
        assert.strictEqual(added, false);
      });
      it(`should not emit ${eventName} for skipped address`, function () {
        if (!receipt) this.skip();
        const filter = (receipt.logs as EventLog[]).filter(
          (log) => log.eventName === eventName && (log.args[0] as string).toLowerCase() === user1.address.toLowerCase(),
        );
        assert.strictEqual(filter.length, 0);
      });
      it(`should emit ${eventName} for other addresses`, async function () {
        if (!receipt) this.skip();
        await expect(receipt).emit(contract, eventName).withArgs(user2, false);
      });
    });

    describe("When address should be removed and added", () => {
      after(async () => update(contract, owner, [user1, user2], []));
      it("should succeed", async () => update(contract, owner, [user1], [user1]));
      it("should be added to the list", async () => {
        const added = await get(contract, user1);
        assert.strictEqual(added, true);
      });
    });

    if (methodName === METHOD_NAME.UPDATE_BLACKLIST) {
      describe("When MedX token should be added to blacklist", () => {
        it("should revert with InvalidBlacklistedAccount", async () => {
          const contractAddress = await contract.getAddress();
          await expect(update(contract, owner, [], [contractAddress]))
            .revertedWithCustomError(contract, "InvalidBlacklistedAccount")
            .withArgs(contractAddress);
        });
      });

      describe("When [MedX<=>WETH] uniswap V2 pair should be added to blacklist", () => {
        it("should revert with InvalidBlacklistedAccount", async () => {
          await expect(update(contract, owner, [], [wethPairAddress]))
            .revertedWithCustomError(contract, "InvalidBlacklistedAccount")
            .withArgs(wethPairAddress);
        });
      });
    }

    if (methodName === METHOD_NAME.UPDATE_WHITELIST) {
      describe("When address is taxed and should be whitelisted", () => {
        before(async () => contract.connect(admin).updateTaxedAddresses([], [user1]));
        after(async () => contract.connect(admin).updateTaxedAddresses([user1], []));
        it("should revert with InvalidWhitelistedAccount", async () => {
          await expect(update(contract, owner, [], [user1]))
            .revertedWithCustomError(contract, "InvalidWhitelistedAccount")
            .withArgs(user1);
        });
      });
    }

    if (methodName === METHOD_NAME.UPDATE_TAXED_ADDRESSES) {
      describe("When whitelisted address should be added to taxed list", () => {
        before(async () => contract.connect(admin).updateWhitelist([], [user1]));
        after(async () => contract.connect(admin).updateWhitelist([user1], []));
        let receipt: ContractTransactionReceipt | null = null;
        it("should succeed", async () => {
          const response = await update(contract, owner, [], [user1]);
          receipt = await response.wait();
          assert(receipt);
        });
        it("address should be added to taxed list", async () => {
          const added = await contract.applyTax(user1);
          assert.strictEqual(added, true);
        });
        it("address should be removed from whitelist", async () => {
          const added = await contract.whitelisted(user1);
          assert.strictEqual(added, false);
        });
        it("should emit TaxedListUpdated event", async function () {
          if (!receipt) this.skip();
          await expect(receipt).emit(contract, "TaxedListUpdated").withArgs(user1, true);
        });
        it("should emit WhitelistUpdated event", async function () {
          if (!receipt) this.skip();
          await expect(receipt).emit(contract, "WhitelistUpdated").withArgs(user1, false);
        });
      });
    }
  });
}
