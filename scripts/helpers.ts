import 'dotenv/config'

// Modifications to build / helper scripts based on sparrowswap

import {
	AccountData,
	Coin,
	coin,
	EncodeObject
} from '@cosmjs/proto-signing'
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate"
import { getSigningCosmWasmClient, generateWallet, restoreWallet } from "@sei-js/core"
import {calculateFee, GasPrice, isDeliverTxFailure} from "@cosmjs/stargate"

import path from "path"
import fs from "fs";
import https from "https";

export const ARTIFACTS_PATH = '../artifacts'
export const GAS_LIMIT = 4000000;

export function getRemoteFile(file: any, url: any) {
	let localFile = fs.createWriteStream(path.join(ARTIFACTS_PATH, `${file}.json`));

	https.get(url, (res) => {
		res.pipe(localFile);
		res.on("finish", () => {
			file.close();
		})
	}).on('error', (e) => {
		console.error(e);
	});
}

interface ClientEnvConstruct {
	account: AccountData
	chainId: string
	client: SigningCosmWasmClient
	gasPrice: GasPrice
}
export class ClientEnv {
	account: AccountData
	chainId: string
	client: SigningCosmWasmClient
	gasPrice: GasPrice
	private constructor(data: ClientEnvConstruct) {
		this.account = data.account;
		this.chainId = data.chainId;
		this.client = data.client;
		this.gasPrice = data.gasPrice;
	}

	async signAndSend(msg: EncodeObject) {
		const result = await this.client.signAndBroadcast(this.account.address, [msg], calculateFee(GAS_LIMIT, this.gasPrice))
		if (isDeliverTxFailure(result)) {
			throw new TransactionError(result.code, result.transactionHash, result.rawLog + "")
		}
		return result
	}
	
	async uploadContract(filepath: string) {
		const contract = fs.readFileSync(filepath)
		const result = await this.client.upload(this.account.address, contract, calculateFee(GAS_LIMIT, this.gasPrice))
		return result.codeId
	}
	async instantiateContract(admin_address: string | undefined, codeId: number, msg: object, label: string) {
		const result = await this.client.instantiate(this.account.address, codeId, msg, label, calculateFee(GAS_LIMIT, this.gasPrice), {
			admin: admin_address
		})
		return result.logs[0].events.filter(el => el.type == "instantiate").map(x => x.attributes.filter(element => element.key == '_contract_address').map(x => x.value));
	}
	async deployContract(adminAddress: string, filepath: string, initMsg: object, label: string) {
		const codeId = await this.uploadContract(filepath);
		return await this.instantiateContract(adminAddress, codeId, initMsg, label);
	}
	async executeContract(contractAddress: string, msg: object, funds?: Coin[]) {
		return await this.client.execute(this.account.address, contractAddress, msg, calculateFee(GAS_LIMIT, this.gasPrice), undefined, funds)
	}
	async queryContract(contractAddress: string, query: object): Promise<any> {
		return await this.client.queryContractSmart(contractAddress, query)
	}
	static async newFromEnvVars(): Promise<ClientEnv> {
		if (!process.env.MNEMONIC) {
			throw new Error("MNEMONIC env var not set")
		}
		if (!process.env.GAS_PRICE) {
			throw new Error("GAS_PRICE env var not set")
		}
		if (!process.env.RPC_URL) {
			throw new Error("RPC_URL not set")
		}

		const signer = await restoreWallet(process.env.MNEMONIC)

		const accounts = await signer.getAccounts()
		if (accounts.length == 1) {
			throw new Error("Expected wallet from mnemonic to result in exactly 1 account but got " + accounts.length + "accounts");
		}

		const account = accounts[0]
		const gasPrice = GasPrice.fromString(process.env.GAS_PRICE)

		const client = await getSigningCosmWasmClient(process.env.RPC_URL, signer, {
			gasPrice: gasPrice
		})
		const chainId = await client.getChainId()

		if (chainId !== process.env.CHAIN_ID) {
			throw new Error(`Chain ID mismatch. Expected ${process.env.CHAIN_ID}, got ${chainId}`)
		}
		return new ClientEnv({ account, chainId, client, gasPrice });
	}
}

export function readArtifact(name: string = 'artifact', dir: string = ARTIFACTS_PATH) {
	try {
		const data = fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')
		return JSON.parse(data)
	} catch (e) {
		return {}
	}
}
export function writeArtifact(data: object, name: string = 'artifact', dir: string = ARTIFACTS_PATH) {
	fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2))
}

export async function sleep(timeout: number) {
	await new Promise(resolve => setTimeout(resolve, timeout))
}

export class TransactionError extends Error {
	name!: "TransactionError"
	public constructor(
		public code: string | number,
		public txhash: string | undefined,
		public rawLog: string,
	) {
		super("transaction failed")
	}
}
TransactionError.prototype.name == "TransactionError";

export function toEncodedBinary(object: any) {
	return Buffer.from(JSON.stringify(object)).toString('base64');
}

export function strToEncodedBinary(data: string) {
	return Buffer.from(data).toString('base64');
}

export function toDecodedBinary(data: string) {
	return Buffer.from(data, 'base64')
}

export class NativeAsset {
	denom: string;
	amount?: string

	constructor(denom: string, amount?: string) {
		this.denom = denom
		this.amount = amount
	}

	getInfo() {
		return {
			"native_token": {
				"denom": this.denom,
			}
		}
	}

	withAmount() {
		return {
			"info": this.getInfo(),
			"amount": this.amount
		}
	}

	getDenom() {
		return this.denom
	}

	toCoin() {
		return coin(this.amount || "0", this.denom)
	}
}

export class TokenAsset {
	addr: string;
	amount?: string

	constructor(addr: string, amount?: string) {
		this.addr = addr
		this.amount = amount
	}

	getInfo() {
		return {
			"token": {
				"contract_addr": this.addr
			}
		}
	}

	withAmount() {
		return {
			"info": this.getInfo(),
			"amount": this.amount
		}
	}

	toCoin() {
		return null
	}

	getDenom() {
		return this.addr
	}
}

export class NativeSwap {
	offer_denom: string;
	ask_denom: string;

	constructor(offer_denom: string, ask_denom: string) {
		this.offer_denom = offer_denom
		this.ask_denom = ask_denom
	}

	getInfo() {
		return {
			"native_swap": {
				"offer_denom": this.offer_denom,
				"ask_denom": this.ask_denom
			}
		}
	}
}

export class AstroSwap {
	offer_asset_info: TokenAsset | NativeAsset;
	ask_asset_info: TokenAsset | NativeAsset;

	constructor(offer_asset_info: TokenAsset | NativeAsset, ask_asset_info: TokenAsset | NativeAsset) {
		this.offer_asset_info = offer_asset_info
		this.ask_asset_info = ask_asset_info
	}

	getInfo() {
		return {
			"astro_swap": {
				"offer_asset_info": this.offer_asset_info.getInfo(),
				"ask_asset_info": this.ask_asset_info.getInfo(),
			}
		}
	}
}

export function checkParams(network: any, required_params: any) {
	for (const k in required_params) {
		if (!network[required_params[k]]) {
			throw "Set required param: " + required_params[k]
		}
	}
}
