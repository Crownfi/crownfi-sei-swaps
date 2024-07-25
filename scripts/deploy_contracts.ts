import * as path from "node:path";
import { promises as fsp } from "node:fs";

import { applyEnvVarsToDefaultClientEnv, fundFromLocalKeychain  } from "@crownfi/sei-cli-utils";
import { ContractDeployingClientEnv, UIAmount } from "@crownfi/sei-utils";
import { coin } from "@cosmjs/proto-signing";

const __dirname = import.meta.dirname;

applyEnvVarsToDefaultClientEnv();

const clientEnv = await ContractDeployingClientEnv.get();

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

async function uploadContractBinary(contractName: string, binary: Buffer) {
  console.log(`Uploading ${contractName} code...`);

  const uploadResult = await clientEnv.uploadContract(binary, false);

  console.log(`Uploaded ${contractName} code: `, {
    transactionHash: uploadResult.transactionHash,
    codeId: uploadResult.codeId
  });

  return uploadResult;
}

console.log(`ChainID: ${clientEnv.chainId}`);
console.log(`Wallet: ${clientEnv.getAccount().seiAddress}`);
console.log("Account balance:", UIAmount(await clientEnv.getBalance("usei"), "usei", true));

if (clientEnv.chainId == "sei-chain" && (await clientEnv.getBalance("usei")) < 1000000n) {
	console.log("Funding account form \"admin\" in local keyring");
	await fundFromLocalKeychain("admin", clientEnv, coin(100000000, "usei"));
	await fundFromLocalKeychain("admin", clientEnv, coin(100000000, "uusdc"));
	await fundFromLocalKeychain("admin", clientEnv, coin(100000000, "uatom"));
}



const cw20WrapperBinary = await readContractBinary("crownfi_cw20_wrapper.wasm");
const erc20WrapperBinary = await readContractBinary("crownfi_erc20_wrapper.wasm");
const swapRouterBinary = await readContractBinary("crownfi_swap_router_contract.wasm");
const poolPairsBinary = await readContractBinary("crownfi_pool_pair_contract.wasm");
const poolFactoryBinary = await readContractBinary("crownfi_pool_factory_contract.wasm");

const cw20Receipt = await uploadContractBinary("CW20 Wrapper", cw20WrapperBinary);
const erc20Receipt = await uploadContractBinary("ERC20 Wrapper", erc20WrapperBinary);
const swapRouterReceipt = await uploadContractBinary("Swap Router", swapRouterBinary);
const poolPairsReceipt = await uploadContractBinary("Pool Pairs", poolPairsBinary);
const poolFactoryReceipt = await uploadContractBinary("Pool Factory", poolFactoryBinary);