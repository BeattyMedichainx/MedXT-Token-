import {
  ERC20Mock,
  IUniswapV2Factory,
  IUniswapV2Factory__factory,
  IUniswapV2Router02,
  IUniswapV2Router02__factory,
  IWETH,
  IWETH__factory,
  MedXToken,
} from "@contracts";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import factoryArtifact from "@uniswap/v2-core/build/UniswapV2Factory.json";
import routerArtifact from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import weth9Artifact from "@uniswap/v2-periphery/build/WETH9.json";

import { AddressLike, ContractFactory, InterfaceAbi } from "ethers";
import { ethers } from "hardhat";
import { ZERO_ADDRESS } from "./constants";

interface MedXTokenDependencies {
  weth: IWETH;
  usdt: ERC20Mock;
  uniV2Factory: IUniswapV2Factory;
  uniV2Router: IUniswapV2Router02;
}

export async function deployUniswapV2(deployer: HardhatEthersSigner): Promise<{
  factory: IUniswapV2Factory;
  weth: IWETH;
  router: IUniswapV2Router02;
}> {
  const factoryAbi: InterfaceAbi = factoryArtifact.abi;
  const factoryBytecode: string = factoryArtifact.bytecode;
  const factoryFactory = new ContractFactory(factoryAbi, factoryBytecode).connect(deployer);
  const factoryAddress = await factoryFactory.deploy(ZERO_ADDRESS).then((res) => res.getAddress());
  const factory = IUniswapV2Factory__factory.connect(factoryAddress, deployer);

  const weth9Abi: InterfaceAbi = weth9Artifact.abi;
  const weth9Bytecode: string = weth9Artifact.bytecode;
  const weth9Factory = new ContractFactory(weth9Abi, weth9Bytecode).connect(deployer);
  const weth9Address = await weth9Factory.deploy().then((res) => res.getAddress());
  const weth = IWETH__factory.connect(weth9Address, deployer);

  const routerAbi: InterfaceAbi = routerArtifact.abi;
  const routerBytecode: string = routerArtifact.bytecode;
  const routerFactory = new ContractFactory(routerAbi, routerBytecode).connect(deployer);
  const routerAddress = await routerFactory.deploy(factoryAddress, weth9Address).then((res) => res.getAddress());
  const router = IUniswapV2Router02__factory.connect(routerAddress, deployer);

  return { factory, weth, router };
}

export async function deployMedXTokenDependencies(
  deployer: HardhatEthersSigner,
): Promise<{ uniV2Factory: IUniswapV2Factory; weth: IWETH; uniV2Router: IUniswapV2Router02; usdt: ERC20Mock }> {
  const erc20MockFactory = await ethers.getContractFactory("ERC20Mock").then((f) => f.connect(deployer));
  const usdt = await erc20MockFactory.deploy("USDT Mock", "USDTM");
  const { factory, weth, router } = await deployUniswapV2(deployer);
  return { uniV2Factory: factory, weth, uniV2Router: router, usdt };
}

export async function deployMedXTokenAndReturnDependencies(
  deployer: HardhatEthersSigner,
  owner: AddressLike,
  feeReceiver: AddressLike,
): Promise<MedXTokenDependencies & { contract: MedXToken }> {
  const dependencies = await deployMedXTokenDependencies(deployer);
  const factory = await ethers.getContractFactory("MedXToken").then((f) => f.connect(deployer));
  const contract = await factory.deploy(owner, feeReceiver, dependencies.uniV2Router, dependencies.usdt);
  return { ...dependencies, contract };
}

export async function deployMedXToken(
  deployer: HardhatEthersSigner,
  owner: AddressLike,
  feeReceiver: AddressLike,
): Promise<MedXToken> {
  const { contract } = await deployMedXTokenAndReturnDependencies(deployer, owner, feeReceiver);
  return contract;
}
