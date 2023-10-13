import { SwapComponentAutogen } from "./_autogen";

export class SwapComponentElement extends SwapComponentAutogen {
	constructor() {
		super();
		// TODO
	}
}
SwapComponentElement.registerElement();

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
