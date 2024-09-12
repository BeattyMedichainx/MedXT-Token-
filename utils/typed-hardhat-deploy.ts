import { ethers } from "ethers";
import {
  CallOptions,
  Deployment,
  DeploymentsExtension,
  DeployOptions,
  DeployResult,
  Receipt,
  TxOptions,
} from "hardhat-deploy/types";
import { Awaited } from "ts-essentials";

interface TypedDeployments<CustomNames extends Record<string, keyof Factories> = Record<string, keyof Factories>>
  extends DeploymentsExtension {
  deploy<N extends keyof Factories>(name: N, options: TypedDeployOptions<N>): Promise<DeployResult>;
  deploy<N extends keyof CustomNames>(
    name: N,
    options: TypedDeployOptionsWithContract<CustomNames[N]>,
  ): Promise<DeployResult>;
  execute<N extends keyof Contracts, M extends keyof Contracts[N]["functions"]>(
    name: N,
    options: TxOptions,
    methodName: M,
    ...args: SafeParameters<Contracts[N]["functions"][M]>
  ): Promise<Receipt>;
  read<N extends keyof Contracts, M extends keyof Contracts[N]["callStatic"]>(
    name: N,
    options: CallOptions,
    methodName: M,
    ...args: SafeParameters<Contracts[N]["callStatic"][M]>
  ): SafeReturnType<Contracts[N]["callStatic"][M]>;
  read<N extends keyof Contracts, M extends keyof Contracts[N]["callStatic"]>(
    name: N,
    methodName: M,
    ...args: SafeParameters<Contracts[N]["callStatic"][M]>
  ): SafeReturnType<Contracts[N]["callStatic"][M]>;
  get<N extends keyof Contracts>(name: N): Promise<Deployment>;
  get<N extends keyof CustomNames>(name: N): Promise<Deployment>;
}

export function typedDeployments<N extends Record<string, keyof Factories>>(
  deployments: DeploymentsExtension,
): TypedDeployments<N> {
  return deployments as TypedDeployments<N>;
}

type _Typechain = typeof import("../types/typechain-types");
type _Factories0 = {
  [key in keyof _Typechain as key extends `${infer N}__factory` ? N : never]: _Typechain[key] extends new (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...any: any[]
  ) => unknown
    ? InstanceType<_Typechain[key]>
    : never;
};
type Factories = Pick<
  _Factories0,
  {
    [key in keyof _Factories0]: _Factories0[key] extends ethers.ContractFactory ? key : never;
  }[keyof _Factories0]
>;

interface TypedDeployOptions<N extends keyof Factories> extends DeployOptions {
  args: Parameters<Factories[N]["deploy"]>;
}
interface TypedDeployOptionsWithContract<N extends keyof Factories> extends TypedDeployOptions<N> {
  contract: N;
}

type Contracts = {
  [key in keyof Factories]: Awaited<ReturnType<Factories[key]["deploy"]>> & {
    functions: Record<string, (...args: unknown[]) => unknown>;
    callStatic: Record<string, (...args: unknown[]) => unknown>;
  };
};

type SafeParameters<T> = T extends (...args: unknown[]) => unknown ? Parameters<T> : never;
type SafeReturnType<T> = T extends (...args: unknown[]) => unknown ? ReturnType<T> : never;

export async function deploy<T extends keyof Factories>(
  deployments: DeploymentsExtension,
  contractName: T,
  from: string,
  ...args: Parameters<Factories[T]["deploy"]>
): Promise<DeployResult> {
  return deployments.deploy(contractName, { from, args, log: true, autoMine: true });
}

export async function getDeployedAddress<T extends keyof Factories>(
  deployments: DeploymentsExtension,
  contractName: T,
): Promise<string> {
  return deployments.get(contractName).then((res) => res.address);
}
