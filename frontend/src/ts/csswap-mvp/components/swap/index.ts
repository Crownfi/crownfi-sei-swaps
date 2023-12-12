import { SeiNetId, getAppChainConfig } from "../../chain_config";
import { UIAmount, bigIntToStringDecimal, denomToContractAssetInfo, errorDialogIfRejected, isProbablyTxError, makeTxExecErrLessFugly, qa, resolveRoute, stringDecimalToBigInt } from "../../util";
import { ClientEnv, SeiWalletChangedEvent, getSelectedChain } from "../../wallet-env";
import { SwapComponentAutogen } from "./_autogen";

import { ExecuteMsg as RouterContractExecuteMsg } from "../../contract_schema/router/execute";
import { Cw20HookMsg as RouterContractCw20HookMsg } from "../../contract_schema/router/cw20_hook_msg";
import { QueryMsg as RouterContractQueryMsg } from "../../contract_schema/router/query";
import { SimulateSwapOperationsResponse } from "../../contract_schema/router/responses/simulate_swap_operations";
import { ExecuteMsg as CW20ExecuteMsg } from "../../contract_schema/token/execute";
import { setLoading } from "../../loading";
import { alert } from "../../popups";


export class SwapComponentElement extends SwapComponentAutogen {
	referencedChain: SeiNetId | null = null;
	private currentRoute: [string, string][] = [];
	constructor() {
		super();
		this.refs.form.elements["in-token"].addEventListener("input", (ev) => {
			const appConfig = getAppChainConfig(getSelectedChain());
			const tokenDenom = this.refs.form.elements["in-token"].value;
			this.refs.inIcon.src = "/assets/lazy-load.svg"
			setTimeout(() => {
				this.refs.inIcon.src = appConfig.tokenUserInfo[tokenDenom]?.icon || "/assets/placeholder.svg";
			}, 1);

			const {decimals} = appConfig.tokenUserInfo[tokenDenom] || {
				decimals: 0
			}
			this.refs.form.elements["in-amount"].step = (10 ** -decimals).toString();
			this.refs.form.elements["in-amount"].step = (10 ** -decimals).toString();

			this.refreshRoute();
			this.refreshBalances();
			this.refreshTradeOutput();
		});
		this.refs.form.elements["out-token"].addEventListener("input", (ev) => {
			const appConfig = getAppChainConfig(getSelectedChain());
			const tokenDenom = this.refs.form.elements["out-token"].value;
			this.refs.outIcon.src = "/assets/lazy-load.svg"
			setTimeout(() => {
				this.refs.outIcon.src = appConfig.tokenUserInfo[tokenDenom]?.icon || "/assets/placeholder.svg";
			}, 1);

			const {decimals} = appConfig.tokenUserInfo[tokenDenom] || {
				decimals: 0
			}
			this.refs.form.elements["out-amount"].step = (10 ** -decimals).toString();
			this.refs.form.elements["out-amount"].step = (10 ** -decimals).toString();

			this.refreshRoute();
			this.refreshBalances();
			this.refreshTradeOutput();
		});
		this.refs.form.elements["in-amount"].addEventListener("input", (ev) => {
			this.refreshTradeOutput();
		});
		this.refs.form.addEventListener("submit", (ev) => {
			ev.preventDefault();
			const form = this.refs.form;
			const appConfig = getAppChainConfig(getSelectedChain());
			const inDenom = this.refs.form.elements["in-token"].value;
			const outDenom = this.refs.form.elements["out-token"].value;
			if (inDenom == outDenom) {
				alert("Nothing to do", "The \"from\" and \"to\" coins are the same.");
				return;
			}
			const inAmount = stringDecimalToBigInt(
				this.refs.form.elements["in-amount"].value,
				appConfig.tokenUserInfo[inDenom]?.decimals || 0
			);
			
			errorDialogIfRejected(async () => {
				try{
					setLoading(true, "Waiting for transaction confirmation...");
					const client = await ClientEnv.get();
					if (inDenom.startsWith("cw20/")) {
						const {transactionHash} = await client.executeContract(
							inDenom.substring("cw20/".length),
							{
								send: {
									amount: inAmount + "",
									contract: appConfig.routerAddress,
									// this is pretty fugly
									msg: Buffer.from(
										JSON.stringify(
											this.buildExecSwapOperationsMsg() satisfies RouterContractCw20HookMsg
										)
									).toString("base64")
								}
							} satisfies CW20ExecuteMsg
						);
						alert("Transaction confirmed", "Transaction ID:\n" + transactionHash);
					}else{
						const {transactionHash} = await client.executeContract(
							appConfig.routerAddress,
							this.buildExecSwapOperationsMsg() satisfies RouterContractExecuteMsg,
							[
								{
									amount: inAmount + "",
									denom: inDenom
								}
							]
						);
						alert("Transaction confirmed", "Transaction ID:\n" + transactionHash);
					}
					/*
					const {transactionHash} = await client.executeContract(
						appConfig.routerAddress,
						{
							send: {
								amount: form.elements.amount.value + "",
								contract: poolInfo.pool,
								// this is pretty fugly
								msg: Buffer.from(
										JSON.stringify(
										{
											withdraw_liquidity: {}
										} satisfies PairContractCw20HookMsg
									)
								).toString("base64")
							}
						} satisfies CW20ExecuteMsg
					);
					*/
					
					//alert("Transaction confirmed", "Transaction ID:\n" + transactionHash);
				}finally{
					setLoading(false);
				}
			});
		});
		this.rebuildPoolList();
	}
	buildExecSwapOperationsMsg() {
		const operations = this.currentRoute.map(v => {
			return {
				astro_swap: {
					offer_asset_info: denomToContractAssetInfo(v[0]),
					ask_asset_info: denomToContractAssetInfo(v[1])
				}
			}
		});
		return {
			execute_swap_operations: {
				operations,
				max_spread: "0.1"
			}
		};
	}
	refreshRoute() {
		const inSelector = this.refs.form.elements["in-token"];
		const outSelector = this.refs.form.elements["out-token"];
		if(inSelector.value == outSelector.value) {
			console.info("SwapComponentElement: same token selected");
			this.currentRoute = [];
			return;
		}
		const route = resolveRoute(inSelector.value, outSelector.value);
		if (route == null) {
			throw new Error("couldn't resolve route!");
		}
		console.info("SwapComponentElement: resolved route:", route);
		this.currentRoute = route;
	}
	rebuildPoolList(dontIfChainUnchanged: boolean = false) {
		const selectedChain = getSelectedChain();
		if (dontIfChainUnchanged && this.referencedChain == selectedChain) {
			return;
		}
		this.refs.form.elements["in-token"].innerHTML = "";
		this.refs.form.elements["out-token"].innerHTML = "";
		const appConfig = getAppChainConfig(selectedChain);
		const uniqueTokens: Set<string> = new Set();
		for (const k in appConfig.pairs) {
			const v = appConfig.pairs[k];
			uniqueTokens.add(v.token0);
			uniqueTokens.add(v.token1);
		}
		for (const tokenDenom of uniqueTokens) {
			const optionElem = document.createElement("option");
			optionElem.innerText = appConfig.tokenUserInfo[tokenDenom]?.symbol || tokenDenom;
			optionElem.value = tokenDenom;
			this.refs.form.elements["in-token"].appendChild(optionElem.cloneNode(true));
			this.refs.form.elements["out-token"].appendChild(optionElem);
		}
		// quick hack to load balances and icons.
		this.refs.form.elements["in-token"].dispatchEvent(new InputEvent("input"));
		this.refs.form.elements["out-token"].dispatchEvent(new InputEvent("input"));
	}
	refreshBalances() {
		this.refs.inBalance.innerText = "⏳️";
		this.refs.outBalance.innerText = "⏳️";
		errorDialogIfRejected(async () => {
			try{
				// const appConfig = getAppChainConfig(getSelectedChain());
				const inToken = this.refs.form.elements["in-token"].value;
				const outToken = this.refs.form.elements["out-token"].value;
				const client = await ClientEnv.get();
				if (client.account == null) {
					this.refs.inBalance.innerText = "[Not connected]";
					this.refs.outBalance.innerText = "[Not connected]";
					return;
				}
				this.refs.inBalance.innerText = UIAmount(
					await client.getBalance(inToken),
					inToken
				);
				this.refs.outBalance.innerText = UIAmount(
					await client.getBalance(outToken),
					outToken
				);
			}catch(ex: any){
				if (this.refs.inBalance.innerText == "⏳️") {
					this.refs.inBalance.innerText = "[Error]"
				}
				if (this.refs.outBalance.innerText == "⏳️") {
					this.refs.outBalance.innerText = "[Error]"
				}
				throw ex;
			}
		});
	}

	private _shouldRefreshTradeOutput: boolean = false;
	private _refreshingTradeOutput: boolean = false;
	refreshTradeOutput() {
		this._shouldRefreshTradeOutput = true;
		if (!this._refreshingTradeOutput) {
			this._refreshingTradeOutput = true;
			(async () => {
				do {
					this._shouldRefreshTradeOutput = false;
					if (!this.currentRoute.length) {
						this.refs.inError.innerText = "\"from\" and \"to\" assets are identical";
						continue;
					}
					this.refs.inError.innerText = "Estimating...";
					await new Promise(resolve => setTimeout(resolve, 500));
					const appConfig = getAppChainConfig(getSelectedChain());
					const client = await ClientEnv.get();

					const inDenom = this.refs.form.elements["in-token"].value;
					const outDenom = this.refs.form.elements["out-token"].value;


					const tokenInAmountElem = this.refs.form.elements["in-amount"];
					const tokenOutAmountElem = this.refs.form.elements["out-amount"];

					const tokenInAmount = stringDecimalToBigInt(
						tokenInAmountElem.value,
						appConfig.tokenUserInfo[inDenom]?.decimals || 0
					) || 0n;
					if (tokenInAmount <= 0n) {
						this.refs.inError.innerText = "Input must be a valid number greater than 0";
						continue;
					}

					// TODO: Remove query in favour of using simulateContract result.
					const {amount: swapResultAmount} = await client.queryContract(
						appConfig.routerAddress,
						{
							simulate_swap_operations: {
								offer_amount: tokenInAmount + "",
								operations: this.currentRoute.map(v => {
									return {
										astro_swap: {
											offer_asset_info: denomToContractAssetInfo(v[0]),
											ask_asset_info: denomToContractAssetInfo(v[1])
										}
									}
								})
							}
						} satisfies RouterContractQueryMsg
					) as SimulateSwapOperationsResponse;
					tokenOutAmountElem.value = bigIntToStringDecimal(
						BigInt(swapResultAmount),
						appConfig.tokenUserInfo[outDenom]?.decimals || 0,
						true
					);
					
					if (inDenom.startsWith("cw20/")) {
						const simResult = await client.simulateContract(
							inDenom.substring("cw20/".length),
							{
								send: {
									amount: tokenInAmount + "",
									contract: appConfig.routerAddress,
									// this is pretty fugly
									msg: Buffer.from(
										JSON.stringify(
											this.buildExecSwapOperationsMsg() satisfies RouterContractCw20HookMsg
										)
									).toString("base64")
								}
							} satisfies CW20ExecuteMsg
						);
						console.log("SIM RESULT:", simResult);
					}else{
						const simResult = await client.simulateContract(
							appConfig.routerAddress,
							this.buildExecSwapOperationsMsg() satisfies RouterContractExecuteMsg,
							[
								{
									amount: tokenInAmount + "",
									denom: inDenom
								}
							]
						);
						console.log("SIM RESULT:", simResult);
					}
					this.refs.inError.innerText = "";
				}while(this._shouldRefreshTradeOutput);
			})().catch((ex: any) => {
				if (isProbablyTxError(ex)) {
					const errParts = makeTxExecErrLessFugly(ex);
					if (errParts) {
						this.refs.inError.innerText = errParts.errorSource + ": " + errParts.errorDetail;
					}else{
						this.refs.inError.innerText = "Transaction Error: " + ex.message;
					}
				}else{
					this.refs.inError.innerText = ex.name + ": " + ex.message;
				}
				console.error("refreshTradeOutput:", ex);
			}).finally(() => {
				this._refreshingTradeOutput = false;
			});
		}
	}
}
SwapComponentElement.registerElement();

window.addEventListener("seiWalletChanged", ((ev: SeiWalletChangedEvent) => {
	console.log("seiWalletChanged event detail:", ev.detail);
	(qa(`div[is="swap-component"]`) as NodeListOf<SwapComponentElement>).forEach(elem => {
		elem.rebuildPoolList(true);
	});
}) as (ev: Event) => void);


/*
import { getAppChainConfig } from "../../chain_config";
import { ClientEnv, getSelectedChain } from "../../wallet-env";
import { QueryMsg as PairContractQueryMsg } from "../../contract_schema/pair/query";
import { SimulationResponse as PairContractQuoteResponse } from "../../contract_schema/pair/responses/simulation";
import { ExecuteMsg as PairContractExecuteMsg } from "../../contract_schema/pair/execute";
import { ExecuteMsg as CW20ExecuteMsg } from "../../contract_schema/token/execute";
import { QueryMsg as Cw20QueryMsg } from "../../contract_schema/token/query";
import { BalanceResponse as Cw20BalanceResponse } from "../../contract_schema/token/responses/balance";
import { amountToAssetInfo, errorDialogIfRejected } from "../../util";
import { Coin } from "@cosmjs/proto-signing";
import { ExecuteInstruction } from "@cosmjs/cosmwasm-stargate";
*/

/*
export class SwapComponentElement extends SwapComponentAutogen {
	pairInfos: (ReturnType<typeof getAppChainConfig>)["pairs"]
	private quoteRequested: boolean;
	private quoteRequestedPromise: Promise<void> | null
	constructor(pairInfos: (ReturnType<typeof getAppChainConfig>)["pairs"]) {
		super();
		this.pairInfos = pairInfos;

		// Our select form is dynamically generated, so we can bend acetewms assumptions a bit.
		this.refs.dynSelectPairs.name = "pair";
		this.refs.dynSelectPairs.classList.add("form-select");
		for (const k of Object.keys(pairInfos)) {
			const newOption = document.createElement("option");
			newOption.value = k;
			newOption.innerText = k;
			this.refs.dynSelectPairs.appendChild(newOption);
		}
		this.refs.dynSelectPairs.oninput = () => {
			this.applyPairSelected();
		}
		this.applyPairSelected();
		this.refs.dynSelectPairs.value = Object.keys(pairInfos)[0];

		this.refs.reverseBtn.onclick = (ev) => {
			ev.preventDefault();
			const form = this.refs.tradeInput;
			const selectedPair = this.refs.dynSelectPairs.value as keyof typeof this.pairInfos;
			let inputDenom, outputDenom;
			if (form.elements.denom.value == this.pairInfos[selectedPair].token0) {
				inputDenom = this.pairInfos[selectedPair].token1;
				outputDenom = this.pairInfos[selectedPair].token0;
			}else{
				inputDenom = this.pairInfos[selectedPair].token0;
				outputDenom = this.pairInfos[selectedPair].token1;
			}
			form.elements.denom.value = inputDenom;
			this.refs.inputDenom.innerText = inputDenom;
			this.refs.outputDenom.innerText = outputDenom;
			this.refreshQuote();
		}
		this.refs.tradeInput.oninput = (ev) => {
			this.refreshQuote();
		}
		this.refs.tradeInput.onsubmit = (ev) => {
			console.debug("this.refs.tradeInput.onsubmit");
			ev.preventDefault();
			errorDialogIfRejected(async () => {
				await this.executeSwap();
			});
		}
		this.quoteRequested = false;
		this.quoteRequestedPromise = null;
	}
	applyPairSelected() {
		const form = this.refs.tradeInput;
		const selectedPair = this.refs.dynSelectPairs.value as keyof typeof this.pairInfos;
		const inputDenom = this.pairInfos[selectedPair].token0;
		const outputDenom = this.pairInfos[selectedPair].token1;
		form.elements.denom.value = inputDenom;
		this.refs.inputDenom.innerText = inputDenom;
		this.refs.outputDenom.innerText = outputDenom;
	}
	async executeSwap() {
		this.refs.swapBtn.disabled = true;
		try{
			const form = this.refs.tradeInput;
			const {
				denom: inputDenom,
				amount: inputAmount,
				pair
			} = form.values();
			const pairInfo = this.pairInfos[pair as keyof typeof this.pairInfos];
			const client = await ClientEnv.get();

			const funds: Coin[] = []
			const ixs: ExecuteInstruction[] = [];
			if (inputDenom.startsWith("cw20/")) {
				ixs.push({
					contractAddress: inputDenom.substring("cw20/".length),
					msg: {
						increase_allowance: {
							amount: inputAmount + "",
							spender: pairInfo.pool
						}
					} satisfies CW20ExecuteMsg
				});
			} else {
				funds.push({
					amount: inputAmount + "",
					denom: inputDenom
				});
			}
			ixs.push({
				contractAddress: pairInfo.pool,
				msg: {
					swap: {
						offer_asset: amountToAssetInfo(inputAmount, inputDenom)
					}
				} satisfies PairContractExecuteMsg,
				funds
			});
			const {transactionHash} = await client.executeContractMulti(ixs);
			console.info("Transaction hash:", transactionHash);
		}finally{
			this.refs.swapBtn.disabled = false;
		}
	}
	refreshQuote() {
		this.quoteRequested = true;
		if (this.quoteRequestedPromise != null) {
			return;
		}
		this.quoteRequestedPromise = (async () => {
			do {
				try{
					this.refs.outputAmount.innerText = "⏳️";
					await new Promise(resolve => setTimeout(resolve, 500));
					this.quoteRequested = false;
					const form = this.refs.tradeInput;
					console.debug("form pair selector:", form.elements.pair);
					const {
						denom: inputDenom,
						amount: inputAmount,
						pair
					} = form.values();
					const client = await ClientEnv.get();
					console.debug({
						pair,
						"this.pairInfos": this.pairInfos
					})
					const pairInfo = this.pairInfos[pair as keyof typeof this.pairInfos];
					const swapQuote = await client.queryContract(
						pairInfo.pool,
						{
							simulation: {
								offer_asset: amountToAssetInfo(inputAmount, inputDenom)
							}
						} satisfies PairContractQueryMsg
					) as PairContractQuoteResponse;
					this.refs.outputAmount.innerText = swapQuote.return_amount;
				}catch(ex: any){
					console.error("Couldn't get swap quote");
					console.error(ex);
					this.refs.outputAmount.innerText = "⚠️";
				}
			}while(this.quoteRequested);
			this.quoteRequestedPromise = null;
		})();
	}
	connectedCallback() {
		console.debug("SwapComponentElement added to page.");
		
	}
	disconnectedCallback() {
		console.debug("SwapComponentElement removed from page.");
	}
}
SwapComponentElement.registerElement();

export function appendSwapComponents(targetElement: HTMLElement) {
	const {pairs} = getAppChainConfig(getSelectedChain());
	const farmElem = new SwapComponentElement(pairs);
	targetElement.appendChild(farmElem);
}
*/
