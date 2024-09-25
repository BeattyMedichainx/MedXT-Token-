import { IUniswapV2Factory__factory, IUniswapV2Router02__factory, IWETH__factory } from "@contracts";
import { ContractFactory, InterfaceAbi } from "ethers";
import { runScript } from "utils/runScript";

import factoryArtifact from "@uniswap/v2-core/build/UniswapV2Factory.json";
import routerArtifact from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import weth9Artifact from "@uniswap/v2-periphery/build/WETH9.json";
import { ZERO_ADDRESS } from "@test-utils";
import { ethers } from "hardhat";

export async function deployMocks() {
  const [deployer] = await ethers.getSigners();

  const factoryAbi: InterfaceAbi = factoryArtifact.abi;
  const factoryBytecode: string = factoryArtifact.bytecode;
  const factoryFactory = new ContractFactory(factoryAbi, factoryBytecode).connect(deployer);
  const factoryAddress = await factoryFactory.deploy(ZERO_ADDRESS).then((res) => res.getAddress());
  const factory = IUniswapV2Factory__factory.connect(factoryAddress, deployer);
  console.log("UniswapV2Factory:", await factory.getAddress());

  const weth9Abi: InterfaceAbi = weth9Artifact.abi;
  const weth9Bytecode: string = weth9Artifact.bytecode;
  const weth9Factory = new ContractFactory(weth9Abi, weth9Bytecode).connect(deployer);
  const weth9Address = await weth9Factory.deploy().then((res) => res.getAddress());
  const weth = IWETH__factory.connect(weth9Address, deployer);
  console.log("WETH:", await weth.getAddress());

  const routerAbi: InterfaceAbi = routerArtifact.abi;
  const routerBytecode: string = routerArtifact.bytecode;
  const routerFactory = new ContractFactory(routerAbi, routerBytecode).connect(deployer);
  const routerAddress = await routerFactory.deploy(factoryAddress, weth9Address).then((res) => res.getAddress());
  const router = IUniswapV2Router02__factory.connect(routerAddress, deployer);
  console.log("UniswapV2Router02:", await router.getAddress());

  const erc20MockFactory = await ethers.getContractFactory("ERC20Mock");
  const usdt = await erc20MockFactory.deploy("USDT Mocked", "USDTM");
  console.log("USDT:", await usdt.getAddress());
}

if (require.main === module) void runScript(() => deployMocks());
