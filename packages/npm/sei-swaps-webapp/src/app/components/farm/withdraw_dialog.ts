import { ClientEnv, UIAmount } from "@crownfi/sei-utils";
import { FarmPoolWithdrawDialogAutogen } from "./_autogen.js";

import { SwapMarket } from "@crownfi/sei-swaps-sdk";

const setLoading = (a: any, b?: any) => {}
const errorDialogIfRejected = (a: any) => {}

export class FarmPoolWithdrawDialogElement extends FarmPoolWithdrawDialogAutogen {
	constructor() {
		super();
		this.refs.btnCancel.addEventListener("click", (ev) => {
			ev.preventDefault();
			this.close();
		});
		this.addEventListener("close", (ev) => {
			this.remove();
		});
		this.refs.form.elements.amount.addEventListener("input", (ev) => {
			this.refreshTradeOutput();
		});

		this.addEventListener("submit", (ev) => {
			const form = this.refs.form;
			// not using form.values() here as I want to get the amounts as a string
			const poolName = form.elements.pool.value;

			errorDialogIfRejected(async () => {
				try {
					setLoading(true, "Waiting for transaction confirmation...");
					const [client, swapMarket] = await Promise.all([ClientEnv.get(), this.swapMarket()]);
					const pool = swapMarket.getPairFromName(poolName)!;

					const { transactionHash } = await client.executeContractMulti(
						pool.buildWithdrawLiquidityIxs(BigInt(form.elements.amount.value))
					);
					// alert("Transaction confirmed", "Transaction ID:\n" + transactionHash);
				} finally {
					setLoading(false);
				}
			});
		});
	}
	invalidateSwapMarket() {
		this.#swapMarket = null;
	}
	#swapMarket: SwapMarket | null = null;
	async swapMarket(): Promise<SwapMarket> {
		if (this.#swapMarket == null) {
			const client = await ClientEnv.get();
			const swapMarket = await SwapMarket.getFromChainId(client.queryClient, client.chainId);
			await swapMarket.refresh();
			this.#swapMarket = swapMarket;
		}
		return this.#swapMarket;
	}
	refreshBalances() {
		this.refs.balance.innerText = "";
		this.refs.balance.classList.add("lazy-loading-text-2");
		errorDialogIfRejected(async () => {
			try {
				const [client, swapMarket] = await Promise.all([ClientEnv.get(), this.swapMarket()]);
				const pair = swapMarket.getPairFromName(this.refs.form.elements.pool.value)!;

				this.refs.balance.innerText = (await client.getBalance(pair.contract.address)).toString();
			} catch (ex: any) {
				if (!this.refs.balance.innerText) {
					this.refs.balance.innerText = "[Error]";
				}
				throw ex;
			} finally {
				this.refs.balance.classList.remove("lazy-loading-text-2");
			}
		});
	}

	#shouldRefreshTradeOutput: boolean = false;
	#refreshingTradeOutput: boolean = false;
	refreshTradeOutput() {
		this.#shouldRefreshTradeOutput = true;
		if (!this.#refreshingTradeOutput) {
			this.#refreshingTradeOutput = true;
			(async () => {
				do {
					this.#shouldRefreshTradeOutput = false;
					this.refs.tradeResultToken0.innerText = "";
					this.refs.tradeResultToken0.classList.add("lazy-loading-text-2");
					this.refs.tradeResultToken1.innerText = "";
					this.refs.tradeResultToken1.classList.add("lazy-loading-text-2");
					await new Promise((resolve) => setTimeout(resolve, 500));
					const pair = (await this.swapMarket()).getPairFromName(this.refs.form.elements.pool.value)!;
					const shareValue = pair.shareValue(BigInt(this.refs.form.elements.amount.value));
					this.refs.tradeResultToken0.innerText = UIAmount(...shareValue[0]);
					this.refs.tradeResultToken1.innerText = UIAmount(...shareValue[1]);
				} while (this.#shouldRefreshTradeOutput);
			})()
				.catch(console.error)
				.finally(() => {
					this.#refreshingTradeOutput = false;
					this.refs.tradeResultToken0.classList.remove("lazy-loading-text-2");
					this.refs.tradeResultToken1.classList.remove("lazy-loading-text-2");
				});
		}
	}
	connectedCallback() {
		this.showModal();
		this.refreshBalances();
	}
}
FarmPoolWithdrawDialogElement.registerElement();
