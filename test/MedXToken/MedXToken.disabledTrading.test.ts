import { ERC20Mock, IUniswapV2Pair, IUniswapV2Pair__factory, IUniswapV2Router02, IWETH, MedXToken } from "@contracts";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployMedXTokenAndReturnDependencies, ONE_ETHER } from "@test-utils";
import { ContractTransactionReceipt, MaxUint256 } from "ethers";
import { ethers } from "hardhat";
import { time as hreTime } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import assert from "assert";

async function getDeadline(): Promise<number> {
  const timestamp = await hreTime.latest();
  return timestamp + 10;
}

describe("When trading is disabled", () => {
  const USDT_LIQUIDITY = 123_000n * ONE_ETHER;
  const MEDX_USDT_LIQUIDITY = 234_000n * ONE_ETHER;
  const ETH_LIQUIDITY = 34n * ONE_ETHER;
  const MEDX_ETH_LIQUIDITY = 456_000n * ONE_ETHER;

  let deployer: HardhatEthersSigner;
  let feeReceiver: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let contract: MedXToken;
  let usdt: ERC20Mock;
  let weth: IWETH;
  let uniV2Router: IUniswapV2Router02;
  let usdtPair: IUniswapV2Pair;
  let ethPair: IUniswapV2Pair;
  let tradingEnableTime: number;
  before(async () => {
    [deployer, feeReceiver, user1, user2] = await ethers.getSigners();
    tradingEnableTime = (await hreTime.latest()) + 200;

    const fixtures = await deployMedXTokenAndReturnDependencies(deployer, deployer, feeReceiver, tradingEnableTime);
    contract = fixtures.contract;
    usdt = fixtures.usdt;
    weth = fixtures.weth;
    uniV2Router = fixtures.uniV2Router;

    await usdt.mint(deployer, MaxUint256);
    await contract.updateWhitelist([], [deployer]);

    const usdtPairAddress = await fixtures.uniV2Factory.getPair(contract, usdt);
    usdtPair = IUniswapV2Pair__factory.connect(usdtPairAddress, deployer);

    const ethPairAddress = await fixtures.uniV2Factory.getPair(contract, weth);
    ethPair = IUniswapV2Pair__factory.connect(ethPairAddress, deployer);

    await usdt.approve(uniV2Router, USDT_LIQUIDITY);
    await contract.approve(uniV2Router, MEDX_USDT_LIQUIDITY);
    const deadline = await getDeadline();
    await uniV2Router.addLiquidity(usdt, contract, USDT_LIQUIDITY, MEDX_USDT_LIQUIDITY, 0, 0, deployer, deadline);

    await contract.approve(uniV2Router, MEDX_ETH_LIQUIDITY);
    await uniV2Router.addLiquidityETH(contract, MEDX_ETH_LIQUIDITY, 0, 0, deployer, deadline, { value: ETH_LIQUIDITY });
  });

  describe("When sell tokens", () => {
    const AMOUNT_IN = 123n * ONE_ETHER;
    const INITIAL_BALANCE = 234n * ONE_ETHER;
    before(async () => {
      const balance = await contract.balanceOf(user1);
      if (balance < INITIAL_BALANCE) await contract.transfer(user1, INITIAL_BALANCE - balance);
      else if (balance > INITIAL_BALANCE) await contract.connect(user1).transfer(deployer, balance - INITIAL_BALANCE);
      await contract.connect(user1).approve(uniV2Router, AMOUNT_IN);
    });
    it("should revert with TRANSFER_FROM_FAILED", async () => {
      const deadline = await getDeadline();
      await expect(
        uniV2Router
          .connect(user1)
          .swapExactTokensForTokensSupportingFeeOnTransferTokens(AMOUNT_IN, 0, [contract, usdt], user2, deadline),
      ).revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });
  });

  describe("When buy tokens", () => {
    const MEDX_AMOUNT_OUT = 123n * ONE_ETHER;
    let maxAmountIn: bigint;
    before(async () => {
      const expectedAmountIn = await uniV2Router.getAmountsIn(MEDX_AMOUNT_OUT, [usdt, contract]).then((res) => res[0]);
      maxAmountIn = expectedAmountIn + expectedAmountIn / 10n; // +10%
      await usdt.transfer(user1, maxAmountIn);
      await usdt.connect(user1).approve(uniV2Router, maxAmountIn);
    });
    it("should revert with TRANSFER_FAILED", async () => {
      const deadline = await getDeadline();
      await expect(
        uniV2Router
          .connect(user1)
          .swapTokensForExactTokens(MEDX_AMOUNT_OUT, maxAmountIn, [usdt, contract], user2, deadline),
      ).revertedWith("UniswapV2: TRANSFER_FAILED");
    });
  });

  describe("When sell tokens by whitelisted account", () => {
    const AMOUNT_IN = 123n * ONE_ETHER;
    const INITIAL_BALANCE = 234n * ONE_ETHER;
    let totalSupply: bigint;
    let feeReceiverBalance: bigint;
    let usdtPairBalance: bigint;
    before(async () => {
      const balance = await contract.balanceOf(user1);
      if (balance < INITIAL_BALANCE) await contract.transfer(user1, INITIAL_BALANCE - balance);
      else if (balance > INITIAL_BALANCE) await contract.connect(user1).transfer(deployer, balance - INITIAL_BALANCE);
      await contract.connect(user1).approve(uniV2Router, AMOUNT_IN);
      await contract.updateWhitelist([], [user1]);
      feeReceiverBalance = await contract.balanceOf(feeReceiver);
      totalSupply = await contract.totalSupply();
      usdtPairBalance = await contract.balanceOf(usdtPair);
    });
    after(async () => contract.updateWhitelist([user1], []));
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const deadline = await getDeadline();
      const response = await uniV2Router
        .connect(user1)
        .swapExactTokensForTokensSupportingFeeOnTransferTokens(AMOUNT_IN, 0, [contract, usdt], user2, deadline);
      receipt = await response.wait();
      assert(receipt);
      assert((await hreTime.latest()) < tradingEnableTime);
    });
    it("total supply should not change", async () => {
      const actualTotalSupply = await contract.totalSupply();
      assert.strictEqual(actualTotalSupply, totalSupply);
    });
    it("user balance should decrease by amount in", async () => {
      const balance = await contract.balanceOf(user1);
      const expected = INITIAL_BALANCE - AMOUNT_IN;
      assert.strictEqual(balance, expected);
    });
    it("fee receiver token balance should not change", async () => {
      const balance = await contract.balanceOf(feeReceiver);
      assert.strictEqual(balance, feeReceiverBalance);
    });
    it("dex pair balance should increase by amount in", async () => {
      const balance = await contract.balanceOf(usdtPair);
      const expected = usdtPairBalance + AMOUNT_IN;
      assert.strictEqual(balance, expected);
    });
    it("should not emit FeeTokenCollected event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).not.emit(contract, "FeeTokenCollected");
    });
  });

  describe("When buy tokens to whitelisted account", () => {
    const MEDX_AMOUNT_OUT = 123n * ONE_ETHER;
    let maxAmountIn: bigint;
    let totalSupply: bigint;
    let userBalance: bigint;
    let feeReceiverBalance: bigint;
    let feeReceiverEthBalance: bigint;
    let pairBalance: bigint;
    let ethPairBalance: bigint;
    before(async () => {
      const expectedAmountIn = await uniV2Router.getAmountsIn(MEDX_AMOUNT_OUT, [usdt, contract]).then((res) => res[0]);
      maxAmountIn = expectedAmountIn + expectedAmountIn / 10n; // +10%
      await usdt.transfer(user1, maxAmountIn);
      await usdt.connect(user1).approve(uniV2Router, maxAmountIn);
      await contract.updateWhitelist([], [user2]);
      totalSupply = await contract.totalSupply();
      userBalance = await contract.balanceOf(user2);
      feeReceiverBalance = await contract.balanceOf(feeReceiver);
      pairBalance = await contract.balanceOf(usdtPair);
      ethPairBalance = await contract.balanceOf(ethPair);
      feeReceiverEthBalance = await ethers.provider.getBalance(feeReceiver);
    });
    after(async () => contract.updateWhitelist([user2], []));
    let receipt: ContractTransactionReceipt | null = null;
    it("should succeed", async () => {
      const deadline = await getDeadline();
      const response = await uniV2Router
        .connect(user1)
        .swapTokensForExactTokens(MEDX_AMOUNT_OUT, maxAmountIn, [usdt, contract], user2, deadline);
      receipt = await response.wait();
      assert(receipt);
      assert((await hreTime.latest()) < tradingEnableTime);
    });
    it("total supply should not change", async () => {
      const actualTotalSupply = await contract.totalSupply();
      assert.strictEqual(actualTotalSupply, totalSupply);
    });
    it("user balance should increase by amount out", async () => {
      const balance = await contract.balanceOf(user2);
      const expected = userBalance + MEDX_AMOUNT_OUT;
      assert.strictEqual(balance, expected);
    });
    it("fee receiver balance should not change", async () => {
      const balance = await contract.balanceOf(feeReceiver);
      assert.strictEqual(balance, feeReceiverBalance);
    });
    it("dex pair balance should decrease by amount out", async () => {
      const balance = await contract.balanceOf(usdtPair);
      const expected = pairBalance - MEDX_AMOUNT_OUT;
      assert.strictEqual(balance, expected);
    });
    it("ETH dex pair balance should not change", async () => {
      const balance = await contract.balanceOf(ethPair);
      assert.strictEqual(balance, ethPairBalance);
    });
    it("fee receiver ETH balance should not increase", async () => {
      const balance = await ethers.provider.getBalance(feeReceiver);
      assert.strictEqual(balance, feeReceiverEthBalance);
    });
    it("should not emit FeeTokenCollected event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).not.emit(contract, "FeeTokenCollected");
    });
    it("should not emit FeeEthCollected event", async function () {
      if (!receipt) this.skip();
      await expect(receipt).not.emit(contract, "FeeEthCollected");
    });
  });
});
