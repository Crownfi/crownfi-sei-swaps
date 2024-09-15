import * as path from "node:path";
import { promises as fsp } from "node:fs";

import { applyEnvVarsToDefaultClientEnv, fundFromLocalKeychain  } from "@crownfi/sei-cli-utils";
import { ContractDeployingClientEnv, UIAmount } from "@crownfi/sei-utils";
import { PoolFactoryContract } from "@crownfi/sei-swaps-sdk";
import { Coin, coin } from "@cosmjs/proto-signing";

const __dirname = import.meta.dirname;

applyEnvVarsToDefaultClientEnv();

const clientEnv = await ContractDeployingClientEnv.get();
const walletSeiAddress = clientEnv.account?.seiAddress;

async function readContractBinary(fileName: string) {
  const contractPath = path.resolve(__dirname, "..", "target", "wasm32-unknown-unknown", "release", fileName);
  try {
    const content = await fsp.readFile(contractPath);

    return content;
  } catch(error) {
    console.error("Contract not found:", contractPath);
    process.exit(1);
  }
}

async function uploadContractBinary(contractName: string, binary: Buffer, allowFactories = false) {
  console.log(`Uploading ${contractName} code...`);

  const uploadResult = await clientEnv.uploadContract(binary, allowFactories);

  console.log(`Uploaded ${contractName} code: `, {
    transactionHash: uploadResult.transactionHash,
    codeId: uploadResult.codeId
  });

  return uploadResult;
}

async function deployContract(name: string, codeId: number, instantiateMsg: object, label: string, funds?: Coin[]) {
  console.log(`Deploying ${name}...`);

  const deployResult = 
    await clientEnv.instantiateContract(codeId, instantiateMsg, label, funds);

  console.log(`${name} deployed`, {
    transactionHash: deployResult.transactionHash,
    contractAddress: deployResult.contractAddress,
  });

  return deployResult;
}

console.log(`ChainID: ${clientEnv.chainId}`);
console.log(`Wallet: ${walletSeiAddress}`);
console.log("Account balance:", UIAmount(await clientEnv.getBalance("usei"), "usei", true));

if (clientEnv.chainId == "sei-chain" && (await clientEnv.getBalance("usei")) < 1000000n) {
	console.log("Funding account form \"admin\" in local keyring");
	await fundFromLocalKeychain("admin", clientEnv, coin(100000000000, "usei"));
	await fundFromLocalKeychain("admin", clientEnv, coin(100000000000, "uusdc"));
	await fundFromLocalKeychain("admin", clientEnv, coin(100000000000, "uatom"));
}

const cw20WrapperBinary = await readContractBinary("crownfi_cw20_wrapper.wasm");
const erc20WrapperBinary = await readContractBinary("crownfi_erc20_wrapper.wasm");
const swapRouterBinary = await readContractBinary("crownfi_swap_router_contract.wasm");
const poolPairsBinary = await readContractBinary("crownfi_pool_pair_contract.wasm");
const poolFactoryBinary = await readContractBinary("crownfi_pool_factory_contract.wasm");

const cw20Receipt = await uploadContractBinary("CW20 Wrapper", cw20WrapperBinary);
const erc20Receipt = await uploadContractBinary("ERC20 Wrapper", erc20WrapperBinary);
const swapRouterReceipt = await uploadContractBinary("Swap Router", swapRouterBinary);
const poolPairReceipt = await uploadContractBinary("Pool Pair", poolPairsBinary, true);
const poolFactoryReceipt = await uploadContractBinary("Pool Factory", poolFactoryBinary);

const cw20WrapperDeployResult = await deployContract("CW20 Wrapper", cw20Receipt.codeId, {}, "wc20-wrapper");
const erc20WrapperDeployResult = await deployContract("ERC20 WRapper", erc20Receipt.codeId, {}, "erc20-wrapper");

const swapRouterDeployResult = await deployContract("Swap Router", swapRouterReceipt.codeId, {}, "swap-router");

const poolFactoryDeployResult = await deployContract(
  "Pool Factory", 
  poolFactoryReceipt.codeId, 
  {
    config: {
      admin: walletSeiAddress,
      fee_receiver: walletSeiAddress,
      pair_code_id: poolPairReceipt.codeId,
      default_total_fee_bps: 1,
      default_maker_fee_bps: 1,
      permissionless_pool_cration: true,
    },
  }, 
  "pool-factory",);

const poolFactory = new PoolFactoryContract(clientEnv.queryClient, poolFactoryDeployResult.contractAddress);

console.log("Creating new Pool Pair with Pool Factory...");

await clientEnv.executeContract(
  poolFactory.buildCreatePoolIx(
    { left_denom: "uatom", initial_shares_receiver: walletSeiAddress }, 
    [ coin(2000000000, "uatom"), coin(4000000000, "usei") ]
  ),
  "pool-factory-uatom-usei",
  "auto"
);

await clientEnv.executeContract(
  poolFactory.buildCreatePoolIx(
    { left_denom: "usei", initial_shares_receiver: walletSeiAddress }, 
    [ coin(4000000000, "usei"), coin(5000000000, "uusdc") ]
  ),
  "pool-factory-usei-uusdc",
  "auto"
);

await clientEnv.executeContract(
  poolFactory.buildUpdateFeesForPoolIx({
    "maker_fee_bps": 2,
    "pair": ["usei", "uusdc"],
    "total_fee_bps": 3,
  }),
  "pool-factory-usei-uusdc",
  "auto"
);

console.log("Pool Pairs created.")

console.log("Pairs on Pool Factory:", await poolFactory.queryPairs());