import { typedDeployments } from "@utils";
import { DEPLOY } from "config";
import { DeployFunction } from "hardhat-deploy/types";

const migrate: DeployFunction = async ({ deployments: d, getNamedAccounts }) => {
  const { deploy } = typedDeployments(d);
  const { deployer } = await getNamedAccounts();

  if (!DEPLOY.MEDX_TOKEN.ADDRESS) {
    await deploy("MedXToken", {
      from: deployer,
      args: [
        DEPLOY.MEDX_TOKEN.OWNER ?? deployer,
        DEPLOY.MEDX_TOKEN.FEE_RECEIVER ?? deployer,
        DEPLOY.UNISWAP_V2_ROUTER,
        DEPLOY.USDT_ADDRESS,
      ],
      log: true,
      autoMine: true,
    });
  }
};

migrate.id = "deploy_token";
migrate.tags = [migrate.id];

export default migrate;
