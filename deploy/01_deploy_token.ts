import { typedDeployments } from "@utils";
import { DEPLOY } from "config";
import { DeployFunction } from "hardhat-deploy/types";

const migrate: DeployFunction = async ({ deployments: d, getNamedAccounts }) => {
  const { deploy, get: getDeployment } = typedDeployments(d);
  const { deployer } = await getNamedAccounts();

  if (!DEPLOY.MEDX_TOKEN.ADDRESS) {
    const uniV2RouterAddress: string =
      DEPLOY.UNISWAP_V2_ROUTER ?? (await getDeployment("UniV2RouterMock").then((c) => c.address));
    const usdtAddress: string = DEPLOY.USDT_ADDRESS ?? (await getDeployment("ERC20Mock").then((c) => c.address));
    await deploy("MedXToken", {
      from: deployer,
      args: [
        DEPLOY.MEDX_TOKEN.OWNER ?? deployer,
        DEPLOY.MEDX_TOKEN.FEE_RECEIVER ?? deployer,
        uniV2RouterAddress,
        usdtAddress,
      ],
      log: true,
      autoMine: true,
    });
  }
};

migrate.id = "deploy_token";
migrate.tags = [migrate.id];

export default migrate;
