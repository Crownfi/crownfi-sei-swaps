#!/bin/env bun

import fs from "node:fs/promises"
import { execFile } from "node:child_process"

import * as seicore from "@crownfi/sei-js-core"
import * as seiutils from "@crownfi/sei-utils"
import ethers from "ethers"
import { GasPrice } from "@cosmjs/stargate"
import { ERC20WrapperExecMsg } from "../../packages/npm/token-wrapper-sdk/src/index.js"

const bail = (message: string): never => {
	console.error(message)
	return process.exit(1)
}

const get_env_or_bail = (env: string): string =>
	process.env[env] ?? bail(`env ${env} not set`)

const seed = get_env_or_bail("MNEMONIC")
const sei_wallet = await seicore.restoreWallet(seed, 0, 60)

const sei_rpc = get_env_or_bail("RPC_ENDPOINT")
const sei_client = await seicore.getSigningCosmWasmClient(
	sei_rpc,
	sei_wallet,
	{ gasPrice: GasPrice.fromString("1usei") },
);

const curr_path = process.argv[1].split(/(.*?csswap-mvp\/)/g)[1]!

const sei_acc = (await sei_wallet.getAccounts())[0]!
const { codeId } = await sei_client.upload(sei_acc.address, await fs.readFile(curr_path + "target/wasm32-unknown-unknown/release/crownfi_erc20_wrapper.wasm"), "auto");
const wrapper_contract = await sei_client.instantiate(sei_acc.address, codeId, {}, "banana", "auto")

const contract_path = curr_path + "packages/evm/test_erc20_token"
await new Promise((resolve, reject) => {
	const curr_dir = process.cwd()
	process.chdir(contract_path)
	execFile(contract_path + "/build.sh", (err, stdout, stderr) => {
		if (err) reject(stderr)
		process.chdir(curr_dir)
		resolve(stdout)
	})
})

const evm_contract_bin = await fs.readFile(contract_path + "/out/main_sol_TestToken.bin")
// const evm_contract_abi = JSON.parse((await fs.readFile(contract_path + "/out/main_sol_TestToken.abi")).toString())

const provider = new ethers.JsonRpcProvider(get_env_or_bail("EVM_RPC"))
const evm_wallet = ethers.Wallet.fromPhrase(seed, provider)
const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = await provider.getFeeData()

const evm_address = await evm_wallet.getAddress()
let constructor_args = evm_address.replace("0x", "").toLowerCase()
if (constructor_args.length < 64) {
	const diff = 32 - constructor_args.length / 2
	for (let i = 0; i < diff; i++) {
		constructor_args = "00" + constructor_args
	}
}

const evm_deploy_t = await evm_wallet.sendTransaction({
	from: evm_address,
	data: "0x" + evm_contract_bin.toString() + constructor_args,
	gasPrice,
	gasLimit: 0xec1cc
})
await evm_deploy_t.wait()
const evm_contract_recepit = await provider.getTransactionReceipt(evm_deploy_t.hash)
if (!evm_contract_recepit || !evm_contract_recepit.contractAddress) bail(JSON.stringify(evm_contract_recepit, undefined, 2))
const erc20_contract_address = evm_contract_recepit!.contractAddress!

const log_balance = async (addr: string) => {
	const balance_call = ethers.hexlify(seiutils.encodeEvmFuncCall("balanceOf(address)", [addr]))
	const balance = await evm_wallet.call({
		to: erc20_contract_address,
		data: balance_call,
	})
	console.log({ [addr]: parseInt(balance.replace("0x", ""), 16) })
}

await log_balance(evm_address)

const approve_call = ethers.hexlify(seiutils.encodeEvmFuncCall("approve(address,uint256)", [seicore.stringToCanonicalAddr(wrapper_contract.contractAddress).fill(0, 0, 12), 10]));
const approve = await evm_wallet.sendTransaction({
	to: erc20_contract_address,
	data: approve_call,
	// type: 0x2,
	gasPrice,
	maxFeePerGas,
	maxPriorityFeePerGas,
	gasLimit: 0xec1cc
})
await approve.wait()

console.log("APPROVED TRANSACTION")

const recipient = Buffer.from(evm_address.substring(2), "hex").toString("base64")
await sei_client.execute(
	sei_acc.address,
	wrapper_contract.contractAddress,
	{ wrap: { amount: "10", token_addr: erc20_contract_address, evm_sender: recipient } } satisfies ERC20WrapperExecMsg,
	"auto"
)

console.log("WRAPPED 10 TOKENS")

await log_balance(evm_address)
const contract_addr = seiutils.toChecksumAddressEvm(ethers.hexlify(seicore.stringToCanonicalAddr(wrapper_contract.contractAddress).subarray(12)))
await log_balance(contract_addr)

const tkn_denom = `factory/${wrapper_contract.contractAddress}/crwn${erc20_contract_address.substring(2)}`
await sei_client.execute(
	sei_acc.address,
	wrapper_contract.contractAddress,
	{
		unwrap: {
			evm_recipient: recipient
		}
	} satisfies ERC20WrapperExecMsg,
	"auto",
	undefined,
	[{ amount: "5", denom: tkn_denom }]
)

console.log("UNWRAPPED 5 TOKENS")

await log_balance(evm_address)
await log_balance(contract_addr)
