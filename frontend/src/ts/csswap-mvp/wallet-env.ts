import { CosmWasmClient, ExecuteInstruction, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { AccountData, Coin, DirectSecp256k1HdWallet, EncodeObject, OfflineSigner } from "@cosmjs/proto-signing";
import {KNOWN_SEI_PROVIDER_INFO, SeiWallet, getQueryClient, getSigningCosmWasmClient, getCosmWasmClient, KNOWN_SEI_PROVIDERS} from "@crownfi/sei-js-core";
import { SeiNetId, getAppChainConfig } from "./chain_config";
import { GasPrice, isDeliverTxFailure } from "@cosmjs/stargate";

// TODO: Allow the user to set their preference
export async function connectAutodiscover(): Promise<SeiWallet> {
	const detectedWalletIds = SeiWallet.discoveredWalletList();
	if (detectedWalletIds.length == 0) {
		throw new Error("No wallets discovered");
	}
	console.log("Auto-discovered known wallet:", KNOWN_SEI_PROVIDER_INFO[detectedWalletIds[0]])
	return new SeiWallet(detectedWalletIds[0]);
}

let selectedChain: SeiNetId = (
	document.location.host.startsWith("127.0.0.1") ||
	document.location.host.startsWith("localhost")
) ? "localsei" : "atlantic-2";

export function getSelectedChain(): SeiNetId {
	return selectedChain;
}

function nativeDenomCompare(a: Coin, b: Coin) {
	if (a.denom < b.denom) {
		return -1;
	}else if(a.denom > b.denom){
		return 1;
	}
	return 0;
}

export class TransactionError extends Error {
	name!: "TransactionError"
	public constructor(
		public code: string | number,
		public txhash: string | undefined,
		public rawLog: string,
	) {
		super("Transaction confirmed with an error")
	}
}
TransactionError.prototype.name == "TransactionError";

interface ClientEnvConstruct {
	account: AccountData | null
	chainId: string
	wasmClient: SigningCosmWasmClient | CosmWasmClient
	queryClient: Awaited<ReturnType<typeof getQueryClient>>
	readonlyReason: string
}
export class ClientEnv {
	account: AccountData | null
	chainId: string
	wasmClient: SigningCosmWasmClient | CosmWasmClient
	queryClient: Awaited<ReturnType<typeof getQueryClient>>
	readonlyReason: string
	private constructor({account, chainId, wasmClient, queryClient, readonlyReason}: ClientEnvConstruct) {
		this.account = account;
		this.chainId = chainId;
		this.wasmClient = wasmClient;
		this.queryClient = queryClient;
		this.readonlyReason = readonlyReason;
	}
	private static async getSigner(): Promise<OfflineSigner | string> {
		//const rpcUrl = getAppChainConfig(selectedChain).rpcUrl;
		if (selectedChain != "atlantic-2" && selectedChain != "pacific-1") {
			// Currently no known sei wallet apps support custom chains
			console.warn(
				"Not actually connecting to wallet because apparently all the sei wallet devs don't care about " +
				"people testing their shit before deploying. So for now, you get the account derived from the NULL " +
				"seed. I can't believe I have to do this."
			);
			const {restoreWallet} = await import("@crownfi/sei-js-core");
			return await restoreWallet("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
		}
		const detectedWalletIds = SeiWallet.discoveredWalletList();
		if (detectedWalletIds.length == 0) {
			return "No known Sei wallets found. Currently we know of: " +
				KNOWN_SEI_PROVIDERS.map(v => KNOWN_SEI_PROVIDER_INFO[v].name).join(", ") + ".";
		}
		console.log("Auto-discovered wallet app:", KNOWN_SEI_PROVIDER_INFO[detectedWalletIds[0]].name);
		const signer = await (new SeiWallet(detectedWalletIds[0])).getOfflineSigner(selectedChain);
		if (signer == undefined) {
			return KNOWN_SEI_PROVIDER_INFO[detectedWalletIds[0]].name +
				" did not provide a signer. (Is the wallet unlocked and are we authorized?)";
		}
		return signer;
	}
	static async get(): Promise<ClientEnv> {
		const {rpcUrl, restUrl} = getAppChainConfig(selectedChain);
		const queryClient = await getQueryClient(restUrl);

		const [wasmClient, account, readonlyReason] = await (async () => {
			const maybeSigner = await ClientEnv.getSigner();
			if (typeof maybeSigner == "string") {
				return [await getCosmWasmClient(rpcUrl), null, maybeSigner];
			}
			const accounts = await maybeSigner.getAccounts();
			if (accounts.length !== 1) {
				return [
					await getCosmWasmClient(rpcUrl),
					null,
					"Expected wallet to expose exactly 1 account but got " + accounts.length + " accounts"
				];
			}
			return [
				await getSigningCosmWasmClient(
					rpcUrl,
					maybeSigner,
					{
						gasPrice: GasPrice.fromString("0.1usei")
					}
				),
				accounts[0],
				""
			]
		})();
		if (account != null) {
			console.info("Found user address:", account.address);
		}
		return new ClientEnv({ account, chainId: selectedChain, wasmClient, queryClient, readonlyReason });
	}
	/**
	 * Conveniently throws an error with the underlying reason if the account property is null
	 */
	getAccount() {
		if (this.account == null) {
			throw new Error("Can't get user wallet address - " + this.readonlyReason);
		}
		return this.account;
	}
	isSignable(): this is { wasmClient: SigningCosmWasmClient, account: AccountData } {
		return (this.wasmClient instanceof SigningCosmWasmClient) && this.account != null;
	}
	async signAndSend(msgs: EncodeObject[]) {
		if (!this.isSignable()) {
			throw new Error("Cannot execute transactions - " + this.readonlyReason);
		}
		const result = await this.wasmClient.signAndBroadcast(this.account.address, msgs, "auto")
		if (isDeliverTxFailure(result)) {
			throw new TransactionError(result.code, result.transactionHash, result.rawLog + "")
		}
		return result
	}
	async executeContract(contractAddress: string, msg: object, funds?: Coin[]) {
		if (!this.isSignable()) {
			throw new Error("Cannot execute transactions - " + this.readonlyReason);
		}
		if (funds) {
			// 🙄🙄🙄🙄
			funds.sort(nativeDenomCompare);
		}
		return await this.wasmClient.execute(this.account.address, contractAddress, msg, "auto", undefined, funds)
	}
	async executeContractMulti(instructions: ExecuteInstruction[]) {
		if (!this.isSignable()) {
			throw new Error("Cannot execute transactions - " + this.readonlyReason);
		}
		for(let i = 0; i < instructions.length; i += 1){
			if (instructions[i].funds) {
				// 🙄🙄🙄🙄🙄🙄🙄🙄🙄🙄🙄🙄🙄🙄🙄🙄
				instructions[i].funds = (instructions[i].funds as Coin[]).sort(nativeDenomCompare);
			}
		}
		return await this.wasmClient.executeMultiple(this.account.address, instructions, "auto")
	}
	async queryContract(contractAddress: string, query: object): Promise<any> {
		return await this.wasmClient.queryContractSmart(contractAddress, query)
	}
	async query() {
		//return await this.client.
	}
}
