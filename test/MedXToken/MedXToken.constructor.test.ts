import { time as hreTime } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  ERC20Mock,
  IUniswapV2Factory,
  IUniswapV2Pair,
  IUniswapV2Pair__factory,
  IUniswapV2Router02,
  IWETH,
  MedXToken,
  MedXToken__factory,
} from "@contracts";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployMedXTokenDependencies, ZERO_ADDRESS } from "@test-utils";
import assert from "assert";
import { ContractTransactionReceipt } from "ethers";

describe("constructor", () => {
  const EXPECTED_TOTAL_SUPPLY = 25n * 10n ** 9n * 10n ** 18n;

  let [deployer, owner, feeReceiver]: HardhatEthersSigner[] = [];
  let factory: MedXToken__factory;
  let weth: IWETH;
  let usdt: ERC20Mock;
  let uniV2Factory: IUniswapV2Factory;
  let uniV2Router: IUniswapV2Router02;
  before(async () => {
    [deployer, owner, feeReceiver] = await ethers.getSigners();
    factory = await ethers.getContractFactory("MedXToken");
    const dependencies = await deployMedXTokenDependencies(deployer);
    weth = dependencies.weth;
    usdt = dependencies.usdt;
    uniV2Factory = dependencies.uniV2Factory;
    uniV2Router = dependencies.uniV2Router;
  });

  describe("When owner is zero address", () => {
    it("should revert with OwnableInvalidOwner(0x00)", async () => {
      await expect(factory.deploy(ZERO_ADDRESS, feeReceiver, uniV2Router, usdt, 0))
        .revertedWithCustomError(factory, "OwnableInvalidOwner")
        .withArgs(ZERO_ADDRESS);
    });
  });

  describe("When fee receiver is zero address", () => {
    it("should revert with InvalidFeeReceiver", async () => {
      await expect(factory.deploy(owner, ZERO_ADDRESS, uniV2Router, usdt, 0))
        .revertedWithCustomError(factory, "InvalidFeeReceiver")
        .withArgs();
    });
  });

  describe("When all parameters are correct", () => {
    let contract: MedXToken | null = null;
    let txReceipt: ContractTransactionReceipt | null = null;
    let wethPair: IUniswapV2Pair | null = null;
    let usdtPair: IUniswapV2Pair | null = null;
    it("should succeed", async () => {
      const deployedContract = await factory.deploy(owner, feeReceiver, uniV2Router, usdt, 0);
      contract = deployedContract;
      txReceipt = (await deployedContract.deploymentTransaction()?.wait()) ?? null;
      assert.ok(txReceipt);
    });
    it("should mint 25e9 (*1e18) to deployer", async function () {
      if (!contract) this.skip();
      const actualBalance = await contract.balanceOf(deployer);
      assert.strictEqual(actualBalance, EXPECTED_TOTAL_SUPPLY);
    });
    it("tokens should be minted ONLY to deployer", async function () {
      if (!contract) this.skip();
      const actualTotalSupply = await contract.totalSupply();
      assert.strictEqual(actualTotalSupply, EXPECTED_TOTAL_SUPPLY);
    });
    it("deployer should be an admin", async function () {
      if (!contract) this.skip();
      const actualAdmin = await contract.admin();
      assert.strictEqual(actualAdmin, deployer.address);
    });
    it("fee receiver should be saved", async function () {
      if (!contract) this.skip();
      const actualFeeReceiver = await contract.feeReceiver();
      assert.strictEqual(actualFeeReceiver, feeReceiver.address);
    });
    it("fee feature should be enabled", async function () {
      if (!contract) this.skip();
      const actualFeeStatus = await contract.feeEnabled();
      assert.strictEqual(actualFeeStatus, true);
    });
    it("uniV2 router should be saved", async function () {
      if (!contract) this.skip();
      const actualUniV2Router = await contract.uniV2Router();
      assert.strictEqual(actualUniV2Router, await uniV2Router.getAddress());
    });
    it("WETH should be saved", async function () {
      if (!contract) this.skip();
      const actualWeth = await contract.weth();
      assert.strictEqual(actualWeth, await weth.getAddress());
    });
    it("uniV2 pair [WETH <=> MedXT] should be created", async function () {
      if (!contract) this.skip();
      const pairAddress = await uniV2Factory.getPair(weth, contract);
      assert.notStrictEqual(pairAddress, ZERO_ADDRESS);
      wethPair = IUniswapV2Pair__factory.connect(pairAddress, ethers.provider);
    });
    it("uniV2 pair [USDT <=> MedXT] should be created", async function () {
      if (!contract) this.skip();
      const pairAddress = await uniV2Factory.getPair(usdt, contract);
      assert.notStrictEqual(pairAddress, ZERO_ADDRESS);
      usdtPair = IUniswapV2Pair__factory.connect(pairAddress, ethers.provider);
    });
    it("uniV2 pair [WETH <=> MedXT] should be added to taxed list", async function () {
      if (!contract || !wethPair) this.skip();
      const taxed = await contract.applyTax(wethPair);
      assert.strictEqual(taxed, true);
    });
    it("uniV2 pair [USDT <=> MedXT] should be added to taxed list", async function () {
      if (!contract || !usdtPair) this.skip();
      const taxed = await contract.applyTax(usdtPair);
      assert.strictEqual(taxed, true);
    });
    it("should not have other addresses in taxed list", async function () {
      if (!contract) this.skip();
      for (const address of [deployer, owner, feeReceiver, weth, usdt, uniV2Factory, uniV2Router]) {
        const taxed: boolean = await contract.applyTax(address);
        assert.strictEqual(taxed, false);
      }
    });
    it("should emit AdminUpdated event", async function () {
      if (!txReceipt || !contract) this.skip();
      await expect(txReceipt).emit(contract, "AdminUpdated").withArgs(ZERO_ADDRESS, deployer);
    });
    it("should emit FeeReceiverUpdated event", async function () {
      if (!txReceipt || !contract) this.skip();
      await expect(txReceipt).emit(contract, "FeeReceiverUpdated").withArgs(ZERO_ADDRESS, feeReceiver);
    });
    it("should emit FeeToggled event", async function () {
      if (!txReceipt || !contract) this.skip();
      await expect(txReceipt).emit(contract, "FeeToggled").withArgs(true);
    });
    it("should emit TaxedListUpdated event for uni V2 [WETH <=> MedXT] pair", async function () {
      if (!txReceipt || !wethPair) this.skip();
      await expect(txReceipt).emit(contract, "TaxedListUpdated").withArgs(wethPair, true);
    });
    it("should emit TaxedListUpdated event for uni V2 [USDT <=> MedXT] pair", async function () {
      if (!txReceipt || !usdtPair) this.skip();
      await expect(txReceipt).emit(contract, "TaxedListUpdated").withArgs(usdtPair, true);
    });
  });

  describe("When trading enable time lt now", () => {
    const TRADING_ENABLE_TIME = 123n;
    let contract: MedXToken | null = null;
    let txReceipt: ContractTransactionReceipt | null = null;
    before(() => assert(TRADING_ENABLE_TIME < Date.now() / 1e3));
    it("should succeed", async () => {
      const deployedContract = await factory.deploy(owner, feeReceiver, uniV2Router, usdt, TRADING_ENABLE_TIME);
      contract = deployedContract;
      txReceipt = (await deployedContract.deploymentTransaction()?.wait()) ?? null;
      assert.ok(txReceipt);
    });
    it("trading enable time should be saved", async function () {
      if (!contract) this.skip();
      const actual = await contract.tradingEnableTime();
      assert.strictEqual(actual, TRADING_ENABLE_TIME);
    });
    it("trading should be enabled", async function () {
      if (!contract) this.skip();
      const tradingEnabled = await contract.tradingEnabled();
      assert.strictEqual(tradingEnabled, true);
    });
    it("should emit TradingEnabled event", async function () {
      if (!contract || !txReceipt) this.skip();
      await expect(txReceipt).emit(contract, "TradingEnabled").withArgs();
    });
  });

  describe("When trading enable time gt now", () => {
    let tradingEnableTime: bigint;
    let contract: MedXToken | null = null;
    let receipt: ContractTransactionReceipt | null = null;
    before(async () => {
      const latestBlock = await ethers.provider.getBlock("latest");
      assert(latestBlock);
      tradingEnableTime = BigInt(latestBlock.timestamp + 50); // + 50s
    });
    it("should succeed", async () => {
      contract = await factory.deploy(owner, feeReceiver, uniV2Router, usdt, tradingEnableTime);
      const deploymentTx = contract.deploymentTransaction();
      assert(deploymentTx);
      receipt = await deploymentTx.wait();
      assert(receipt);
    });
    it("trading enable time should be saved", async function () {
      if (!contract) this.skip();
      const actual = await contract.tradingEnableTime();
      assert.strictEqual(actual, tradingEnableTime);
    });
    it("trading should be disabled", async function () {
      if (!contract) this.skip();
      const tradingEnabled = await contract.tradingEnabled();
      assert.strictEqual(tradingEnabled, false);
    });
    it("should not emit TradingEnabled event", async function () {
      if (!contract || !receipt) this.skip();
      await expect(receipt).not.emit(contract, "TradingEnabled");
    });
    it("trading should be enable on {tradingEnableTime}", async function () {
      if (!contract) this.skip();
      const current = await hreTime.latest();
      assert(current < tradingEnableTime);
      await hreTime.increaseTo(tradingEnableTime);
      const tradingEnabled = await contract.tradingEnabled();
      assert.strictEqual(tradingEnabled, true);
    });
  });
});
