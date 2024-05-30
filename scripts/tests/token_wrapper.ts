#!/bin/env bun

import fs from "node:fs/promises"

import * as seicore from "@crownfi/sei-js-core"
import * as base32 from "hi-base32"
import { TokenWrapperContract } from "../../packages/npm/sei-swaps-sdk/src/base/token_wrapper.js"
import { TokenWrapperExecMsg } from "../../packages/npm/sei-swaps-sdk/src/base/types.js"
import { GasPrice } from "@cosmjs/stargate"

const bail = (message: string): never => {
	console.error(message)
	return process.exit(1)
}

const get_env_or_bail = (env: string): string =>
	process.env[env] ?? bail(`env ${env} not set`)

let curr_arg = 2
const get_arg = (): string => {
	const response = process.argv[curr_arg] ?? bail(`argument of number ${curr_arg} not supplied`)
	curr_arg += 1
	return response
}

const priv_key = get_env_or_bail("PRIV_KEY")
const wallet = await seicore.restoreWallet(priv_key)

const sei_rpc = get_env_or_bail("RPC_ENDPOINT")
const client = await seicore.getSigningCosmWasmClient(
	sei_rpc,
	wallet,
	{ gasPrice: GasPrice.fromString("1usei") },
);

const acc = (await wallet.getAccounts())[0]!

const msg = {
	name: "Test token1",
	symbol: "TEST-T",
	decimals: 6,
	initial_balances: [
		{
			address: acc.address,
			amount: "1000000000000000"
		}
	],
	mint: {
		minter: acc.address
	}
}

const curr_path = process.argv[1].split(/(.*?csswap-mvp\/)/g)[1]
const wrapper_contract = await client.upload(acc.address, await fs.readFile(curr_path + "target/wasm32-unknown-unknown/release/crownfi_token_wrapper.wasm"), "auto")
const cw20_contract = await client.upload(acc.address, await fs.readFile(curr_path + "target/wasm32-unknown-unknown/release/crownfi_astro_token.wasm"), "auto")

const { contractAddress } = await client.instantiate(acc.address, wrapper_contract.codeId, {}, "banana", "auto")
const { contractAddress: token } = await client.instantiate(acc.address, cw20_contract.codeId, msg, "avocado", "auto")
console.log({ token, contractAddress })

const amt = get_arg()

const contract = new TokenWrapperContract(client, contractAddress)
const acc_canonical_addr = seicore.stringToCanonicalAddr(acc.address)
const cw20msg = contract.executeIxCw20(Buffer.from(acc_canonical_addr), token, amt)

const canonical_tkn = seicore.stringToCanonicalAddr(token)
const native_denom = `factory/${contractAddress}/${base32.encode(canonical_tkn, true).substring(0, 44).toLowerCase()}`;

await client.execute(acc.address, token, cw20msg.msg, "auto")
await client.execute(
	acc.address,
	contractAddress,
	{ unwrap: {} } satisfies TokenWrapperExecMsg,
	"auto",
	undefined,
	[{ amount: Math.floor(Number(amt) / 2).toString(), denom: native_denom }]
)

const balance_response = await client.queryContractSmart(token, { balance: { address: acc.address } });
console.log("IT FINALLY WORKED", balance_response)
