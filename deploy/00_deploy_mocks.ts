import { typedDeployments } from "@utils";
import { DEPLOY } from "config";
import { DeployFunction } from "hardhat-deploy/types";

const migrate: DeployFunction = async ({ deployments: d, getNamedAccounts }) => {
  const { deploy } = typedDeployments(d);
  const { deployer } = await getNamedAccounts();

  if (!DEPLOY.UNISWAP_V2_ROUTER) {
    const weth = await deploy("ERC20Mock", {
      from: deployer,
      args: ["WETH Mocked", "WETHM"],
      log: true,
      autoMine: true,
    });
    const factory = await deploy("UniV2FactoryMock", {
      from: deployer,
      args: [],
      log: true,
      autoMine: true,
    });
    await deploy("UniV2RouterMock", {
      from: deployer,
      args: [factory.address, weth.address],
      log: true,
      autoMine: true,
    });
  }

  if (!DEPLOY.USDT_ADDRESS) {
    await deploy("ERC20Mock", {
      from: deployer,
      args: ["USDT Mocked", "USDTM"],
      log: true,
      autoMine: true,
    });
  }
};

migrate.id = "deploy_mocks";
migrate.tags = [migrate.id];

export default migrate;
