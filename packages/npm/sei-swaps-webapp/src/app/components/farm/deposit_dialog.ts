import { SwapMarket } from "@crownfi/sei-swaps-sdk";
import { FarmPoolDepositDialogAutogen } from "./_autogen";
import { ClientEnv, UIAmount, bigIntToStringDecimal, getUserTokenInfo, stringDecimalToBigInt } from "@crownfi/sei-utils";
import { setLoading } from "../../loading";
import { errorDialogIfRejected } from "../../dialogs";

export class FarmPoolDepositDialogElement extends FarmPoolDepositDialogAutogen {
	constructor() {
		super();
		this.refs.btnCancel.addEventListener("click", (ev) => {
			ev.preventDefault();
			this.close();
		});
		this.refs.form.elements["deposit-type"].forEach(elem => {
			elem.addEventListener("input", (_) => {
				this.refreshTradeInputs();
			});
		})
		this.refs.form.elements.amount0.addEventListener("input", (_) => {
			this.refreshTradeInputs("amount0")
		});
		this.refs.form.elements.amount1.addEventListener("input", (_) => {
			this.refreshTradeInputs("amount1")
		});
		this.refs.form.elements.result.addEventListener("input", (_) => {
			this.refreshTradeInputs("result")
		});
		
		this.addEventListener("close", (ev) => {
			this.remove();
		});
		this.addEventListener("submit", (ev) => {
			const form = this.refs.form;

			// not using form.values() here as I want to get the amounts as a string
			const poolName = form.elements.pool.value;

			setLoading(true, "Waiting for transaction confirmation...");
			errorDialogIfRejected(async () => {
				try{
					const [client, swapMarket] = await Promise.all([
						ClientEnv.get(),
						this.swapMarket()
					]);
					const pool = swapMarket.getPairFromName(poolName);
					if (pool == null) {
						return;
					}
					const {decimals: token0Decimals} = getUserTokenInfo(pool.assets[0]) || {
						decimals: 0
					}
					const {decimals: token1Decimals} = getUserTokenInfo(pool.assets[1]) || {
						decimals: 0
					}
					const amount0 = stringDecimalToBigInt(form.elements.amount0.value, token0Decimals);
					const amount1 = stringDecimalToBigInt(form.elements.amount1.value, token1Decimals);
					if (amount0 == null || amount1 == null) {
						return;
					}
					const {transactionHash} = await client.executeContractMulti(
						pool.buildProvideLiquidityIxs(
							amount0,
							amount1,
							0.5
						)
					);
				}finally{
					setLoading(false);
				}
			});
		});
	}
	invalidateSwapMarket() {
		this.#swapMarket = null;
	}
	#swapMarket: SwapMarket | null = null
	async swapMarket(): Promise<SwapMarket> {
		if (this.#swapMarket == null) {
			const client = await ClientEnv.get();
			const swapMarket = await SwapMarket.getFromChainId(
				client.wasmClient,
				client.chainId
			);
			await swapMarket.refresh();
			this.#swapMarket = swapMarket;
		}
		return this.#swapMarket;
	}

	refreshBalances() {
		this.refs.balanceToken0.innerText = "";
		this.refs.balanceToken1.innerText = "";
		this.refs.balanceResult.innerText = "";
		this.refs.balanceToken0.classList.add("lazy-loading-text-2");
		this.refs.balanceToken1.classList.add("lazy-loading-text-2");
		this.refs.balanceResult.classList.add("lazy-loading-text-2");
		errorDialogIfRejected(async () => {
			try{
				const [client, swapMarket] = await Promise.all([
					ClientEnv.get(),
					this.swapMarket()
				]);
				const pair = swapMarket.getPairFromName(this.refs.form.elements.pool.value)!;
				this.refs.form.elements.amount0.step

				this.refs.balanceToken0.innerText = UIAmount(
					await client.getBalance(pair.assets[0]),
					pair.assets[0]
				);
				this.refs.balanceToken0.innerText = UIAmount(
					await client.getBalance(pair.assets[1]),
					pair.assets[1]
				);

				this.refs.balanceResult.innerText = (
					await client.getBalance(pair.sharesDenom)
				).toString();
			}catch(ex: any){
				if (!this.refs.balanceToken0.innerText) {
					this.refs.balanceToken0.innerText = "[Error]"
				}
				if (!this.refs.balanceToken1.innerText) {
					this.refs.balanceToken1.innerText = "[Error]"
				}
				if (!this.refs.balanceResult.innerText) {
					this.refs.balanceResult.innerText = "[Error]"
				}
				throw ex;
			}finally{
				this.refs.balanceToken0.classList.remove("lazy-loading-text-2");
				this.refs.balanceToken1.classList.remove("lazy-loading-text-2");
				this.refs.balanceResult.classList.remove("lazy-loading-text-2");
			}
		})
	}

	#shouldRefreshTradeInput: boolean = false;
	#refreshingTradeInput: boolean = false;
	#tradeInputEdited: "amount0" | "amount1" | "result" | undefined;
	refreshTradeInputs(inputEdited?: "amount0" | "amount1" | "result") {
		this.#shouldRefreshTradeInput = true;
		this.#tradeInputEdited = inputEdited;
		if (!this.#refreshingTradeInput) {
			this.#refreshingTradeInput = true;
			(async () => {
				do {
					this.#shouldRefreshTradeInput = false;
					await new Promise(resolve => setTimeout(resolve, 500));
					const pair = (await this.swapMarket()).getPairFromName(this.refs.form.elements.pool.value)!;
					const form = this.refs.form;
					switch (form.values()["deposit-type"]) {
						case "current": {
							form.elements.result.readOnly = false;
							switch (this.#tradeInputEdited) {
								case "amount0": {
									const amount0 = BigInt(form.elements.amount0.value);
									const amount1 = pair.exchangeValue(amount0);
									form.elements.amount1.value = bigIntToStringDecimal(amount1, getUserTokenInfo(pair.assets[1]).decimals);
									form.elements.result.value = pair.calculateProvideLiquidity(amount0, amount1).newShares + "";
									break;
								}
								case "amount1": {
									const amount1 = BigInt(form.elements.amount1.value);
									const amount0 = pair.exchangeValue(amount1);
									form.elements.amount0.value = bigIntToStringDecimal(amount0, getUserTokenInfo(pair.assets[0]).decimals);
									form.elements.result.value = pair.calculateProvideLiquidity(amount0, amount1).newShares + "";
									break;
								}
								case "result": {
									const [[amount0, _], [amount1, __]] = pair.shareValue(BigInt(form.elements.result.value));
									form.elements.amount0.value = bigIntToStringDecimal(amount0, getUserTokenInfo(pair.assets[0]).decimals);
									form.elements.amount1.value = bigIntToStringDecimal(amount1, getUserTokenInfo(pair.assets[1]).decimals);
									break;
								}
							}
							break;
						}
						case "imbalanced": {
							form.elements.result.readOnly = true;
							form.elements.result.value = "";
							break;
						}
					}
					
				}while(this.#shouldRefreshTradeInput);
			})().catch(console.error).finally(() => {
				this.#refreshingTradeInput = false;
			});
		}
	}

	connectedCallback() {
		this.showModal();
		this.refreshBalances();
	}
}
FarmPoolDepositDialogElement.registerElement();
