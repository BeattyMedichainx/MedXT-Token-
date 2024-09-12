import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-toolbox";

import "hardhat-deploy";
import "hardhat-exposed";
import "hardhat-docgen";
import "hardhat-gas-reporter";
import "hardhat-watcher";
import "solidity-coverage";
import "tsconfig-paths/register";

import "./tasks/index";

import "hardhat-exposed/dist/type-extensions";
import { HardhatUserConfig } from "hardhat/config";
import {
  CONTRACTS_EXPOSED,
  DEPLOYER_KEY,
  DOCGEN,
  EXPLORER_API_KEY,
  FORK,
  GAS_PRICE,
  GAS_REPORTER,
  INFURA_KEY,
  LOGGING,
  OPERATOR_KEY,
} from "config";

function typedNamedAccounts<T>(namedAccounts: { [key in string]: T }) {
  return namedAccounts;
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    outDir: "types/typechain-types",
    target: "ethers-v6",
  },
  networks: {
    hardhat: {
      gasPrice: GAS_PRICE === "auto" ? "auto" : Number(GAS_PRICE),
      loggingEnabled: LOGGING,
      forking: {
        enabled: FORK.ENABLED,
        url: FORK.PROVIDER_URI,
      },
    },
    localhost: { url: "http://127.0.0.1:8545" },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
      chainId: 1,
      accounts: [DEPLOYER_KEY, OPERATOR_KEY],
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_KEY}`,
      chainId: 11155111,
      accounts: [DEPLOYER_KEY, OPERATOR_KEY],
    },
    polygon: {
      url: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
      chainId: 137,
      accounts: [DEPLOYER_KEY, OPERATOR_KEY],
    },
    polygonMumbai: {
      url: `https://polygon-mumbai.infura.io/v3/${INFURA_KEY}`,
      chainId: 80001,
      accounts: [DEPLOYER_KEY, OPERATOR_KEY],
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [DEPLOYER_KEY, OPERATOR_KEY],
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: [DEPLOYER_KEY, OPERATOR_KEY],
    },
  },
  etherscan: {
    apiKey: {
      mainnet: EXPLORER_API_KEY.ETHERSCAN,
      sepolia: EXPLORER_API_KEY.ETHERSCAN,
      polygon: EXPLORER_API_KEY.POLYGONSCAN,
      polygonMumbai: EXPLORER_API_KEY.POLYGONSCAN,
      bsc: EXPLORER_API_KEY.BSCSCAN,
      bscTestnet: EXPLORER_API_KEY.BSCSCAN,
    },
  },
  namedAccounts: typedNamedAccounts({
    deployer: 0,
    operator: 1,
  }),
  watcher: {
    test: {
      tasks: [{ command: "test", params: { testFiles: ["{path}"] } }],
      files: ["./test/**/*"],
      verbose: true,
    },
  },
  exposed: {
    imports: CONTRACTS_EXPOSED.IMPORTS,
    initializers: CONTRACTS_EXPOSED.INITIALIZERS,
    exclude:
      typeof CONTRACTS_EXPOSED.EXCLUDE === "string" ? CONTRACTS_EXPOSED.EXCLUDE.split(",") : CONTRACTS_EXPOSED.EXCLUDE,
  },
  gasReporter: {
    enabled: GAS_REPORTER.ENABLED,
    coinmarketcap: GAS_REPORTER.COINMARKETCAP,
    currency: GAS_REPORTER.CURRENCY,
    token: GAS_REPORTER.TOKEN,
    gasPriceApi: GAS_REPORTER.GAS_PRICE_API,
  },
  docgen: {
    path: DOCGEN.OUT_DIR,
    clear: DOCGEN.CLEAR,
    runOnCompile: DOCGEN.RUN_ON_COMPILE,
  },
};

export default config;
