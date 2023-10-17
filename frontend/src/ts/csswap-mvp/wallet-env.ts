import { CosmWasmClient, ExecuteInstruction, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { AccountData, Coin, EncodeObject, OfflineSigner } from "@cosmjs/proto-signing";
import {KNOWN_SEI_PROVIDER_INFO, SeiWallet, getQueryClient, getSigningCosmWasmClient, getCosmWasmClient, KNOWN_SEI_PROVIDERS, KnownSeiProviders} from "@crownfi/sei-js-core";
import { SeiNetId, getAppChainConfig } from "./chain_config";
import { GasPrice, isDeliverTxFailure } from "@cosmjs/stargate";
import { setLoading } from "./loading";
import { QueryMsg as Cw20QueryMsg } from "../contract_schema/token/query";
import { BalanceResponse as Cw20BalanceResponse } from "../contract_schema/token/responses/balance";
import { errorDialogIfRejected } from "./util";

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

let selectedChain: SeiNetId = (
	document.location.host.startsWith("127.0.0.1") ||
	document.location.host.startsWith("localhost")
) ? "localsei" : "atlantic-2";

export function getSelectedChain(): SeiNetId {
	return selectedChain;
}

//export interface SeiChainChangedEvent extends CustomEvent<{chainId: SeiNetId}> {};
export interface SeiWalletChangedEvent extends CustomEvent<{chainId: SeiNetId, address: string, provider: MaybeSelectedProvider}> {};

export type MaybeSelectedProvider = KnownSeiProviders | "seed-wallet" | null;

let preferredSeiProvider: MaybeSelectedProvider = null;
export async function setPreferredSeiProvider(chainId: SeiNetId, providerId: MaybeSelectedProvider) {
	if (providerId == null) {
		preferredSeiProvider = providerId
		selectedChain = chainId;
		window.dispatchEvent(
			new CustomEvent("seiWalletChanged", {
				detail: {
					chainId,
					address: "",
					provider: providerId
				},
				cancelable: false
			})
		);
	}else{
		let oldProvider = preferredSeiProvider;
		let oldChain = selectedChain;
		try{
			setLoading(true, "Connecting to wallet...");
			preferredSeiProvider = providerId;
			selectedChain = chainId;
			const clientEnv = await ClientEnv.get();
			window.dispatchEvent(
				new CustomEvent("seiWalletChanged", {
					detail: {
						chainId,
						address: clientEnv.getAccount().address, // may throw
						provider: providerId
					},
					cancelable: false
				})
			);
		}catch(ex) {
			preferredSeiProvider = oldProvider;
			selectedChain = oldChain;
			throw ex;
		}finally{
			setLoading(false);
		}
	}
	if (providerId == null) {
		localStorage.removeItem("preferred_sei_provider");
	}else{
		localStorage.setItem("preferred_sei_provider", providerId);
	}
}

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
		if (preferredSeiProvider == null) {
			return "No wallet selected";
		}
		if (preferredSeiProvider == "seed-wallet") {
			// async imports allow us to load the signing stuff only if needed. (hopefully)
			const {restoreWallet} = await import("@crownfi/sei-js-core");
			// Just support the NULL seed for now.
			return await restoreWallet("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about")
		}
		
		const signer = await (new SeiWallet(preferredSeiProvider)).getOfflineSigner(selectedChain);
		if (signer == undefined) {
			return KNOWN_SEI_PROVIDER_INFO[preferredSeiProvider].name +
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
	async getBalance(unifiedDenom: string, accountAddress: string = this.getAccount().address): Promise<bigint> {
		if (unifiedDenom.startsWith("cw20/")) {
			const {balance} = await this.queryContract(
				unifiedDenom.substring("cw20/".length),
				{
					balance: {address: accountAddress}
				} satisfies Cw20QueryMsg
			) as Cw20BalanceResponse;
			return BigInt(balance);
		}else{
			const {
				balance: {
					amount: balance
				}
			} = await this.queryClient.cosmos.bank.v1beta1.balance({
				address: accountAddress,
				denom: unifiedDenom
			});
			return BigInt(balance);
		}
	}
}
