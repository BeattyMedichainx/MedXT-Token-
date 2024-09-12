import { CliffAndVesting__factory, MedXToken__factory } from "@contracts";
import { deploy, getDeployedAddress } from "@utils";
import assert from "assert";
import { DEPLOY, VestingInstanceConfig, VestingReserveConfig } from "config";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import _ from "lodash";

function vestingNameToId(name: string): string {
  assert(name.length < 31);
  const length = name.length.toString(16).padStart(2, "0");
  const content = Buffer.from(name).toString("hex").padEnd(0x3e, "0");
  return `0x${length}${content}`;
}

function getVestingReservesConfig(vesting: VestingInstanceConfig): VestingReserveConfig[] {
  return Array.isArray(vesting.RESERVES)
    ? vesting.RESERVES
    : [{ ACCOUNT: DEPLOY.VESTING.DEFAULT_ACCOUNT, AMOUNT: vesting.RESERVES }];
}

const migrate: DeployFunction = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts();
  const tokenAddress = DEPLOY.MEDX_TOKEN.ADDRESS ?? (await getDeployedAddress(deployments, "MedXToken"));
  const token = MedXToken__factory.connect(tokenAddress, await ethers.getSigner(deployer));
  const deployerBalance = await token.balanceOf(deployer);
  const totalReserves = DEPLOY.VESTING.LIST.flatMap((v) => getVestingReservesConfig(v)).reduce(
    (acc, e) => acc + BigInt(e.AMOUNT),
    0n,
  );
  assert(totalReserves <= deployerBalance);
  for (const VESTING of DEPLOY.VESTING.LIST) {
    const vestingAddress = await deploy(
      deployments,
      "CliffAndVesting",
      deployer,
      vestingNameToId(VESTING.NAME),
      VESTING.PERIOD_SIZE ?? DEPLOY.VESTING.DEFAULT_PERIOD_SIZE,
      VESTING.CLIFF,
      VESTING.VESTING_PERIODS,
      VESTING.INITIAL_RELEASE_X18,
      tokenAddress,
    ).then((res) => res.address);
    const vestingContract = CliffAndVesting__factory.connect(vestingAddress, await ethers.getSigner(deployer));
    for (const reserves of _.chunk(getVestingReservesConfig(VESTING), DEPLOY.VESTING.RESERVE_BATCH_SIZE)) {
      await vestingContract.reserve(reserves.map(({ ACCOUNT: account, AMOUNT: amount }) => ({ account, amount })));
    }
    const totalReserveAmount = await vestingContract.totalReserveAmount();
    await token.approve(vestingAddress, totalReserveAmount);
    await vestingContract.start();
    console.log(`${await vestingContract.vestingName()}: ${vestingAddress}`);
  }
};

migrate.id = "deploy_vestings";
migrate.tags = [migrate.id];

export default migrate;
