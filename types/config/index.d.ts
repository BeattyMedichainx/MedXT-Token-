declare module "config" {
  export const INFURA_KEY: string;
  export const DEPLOYER_KEY: string;
  export const OPERATOR_KEY: string;
  export const GAS_PRICE: number | string;
  export const LOGGING: boolean;

  export interface VestingReserveConfig {
    readonly ACCOUNT: string;
    readonly AMOUNT: number | string;
  }

  export interface VestingInstanceConfig {
    readonly NAME: string;
    readonly PERIOD_SIZE?: number | string | null;
    readonly CLIFF: number | string;
    readonly VESTING_PERIODS: number | string;
    readonly INITIAL_RELEASE_X18: number | string;
    readonly RESERVES: VestingReserveConfig[] | (number | string);
  }

  export interface VestingsConfig {
    readonly RESERVE_BATCH_SIZE: number;
    readonly DEFAULT_PERIOD_SIZE: number | string;
    readonly DEFAULT_ACCOUNT: string;
    readonly LIST: readonly VestingInstanceConfig[];
  }

  export const DEPLOY: {
    readonly UNISWAP_V2_ROUTER: string;
    readonly USDT_ADDRESS: string;
    readonly MEDX_TOKEN: {
      readonly ADDRESS: string | null;
      readonly OWNER: string | null;
      readonly FEE_RECEIVER: string | null;
    };
    readonly VESTING: VestingsConfig;
  };
  export const SCRIPTS: Record<string, never>;

  export const EXPLORER_API_KEY: {
    readonly ETHERSCAN: string;
    readonly POLYGONSCAN: string;
    readonly BSCSCAN: string;
  };

  export const FORK: {
    readonly ENABLED: boolean;
    readonly PROVIDER_URI: string;
  };

  export const GAS_REPORTER: {
    readonly ENABLED: boolean;
    readonly COINMARKETCAP: string;
    readonly CURRENCY: string;
    readonly TOKEN: string;
    readonly GAS_PRICE_API: string;
  };

  export const DOCGEN: {
    readonly OUT_DIR: string;
    readonly CLEAR: boolean;
    readonly RUN_ON_COMPILE: boolean;
  };

  export const CONTRACTS_EXPOSED: {
    readonly IMPORTS: boolean;
    readonly INITIALIZERS: boolean;
    readonly EXCLUDE: string[] | string;
  };
}
