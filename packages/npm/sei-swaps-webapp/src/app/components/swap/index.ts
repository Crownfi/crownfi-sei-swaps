import { SwapComponentAutogen } from "./_autogen.js";
import { setLoading } from "../../loading.js";
import { alert, errorDialogIfRejected } from "../../dialogs/index.js";
import {
	ClientEnv,
	UIAmount,
	bigIntToStringDecimal,
	getUserTokenInfo,
	isProbablyTxError,
	makeTxExecErrLessFugly,
	seiUtilEventEmitter,
	stringDecimalToBigInt,
} from "@crownfi/sei-utils";
import { SwapMarket } from "@crownfi/sei-swaps-sdk";
import { disableFormInputs, enableFormInputs, qa } from "../../util.js";

// Woo! Customized builtin elements!
export class SelectChangesElement extends HTMLSelectElement {
	#oldValue: string;
	#newValue: string;
	get oldValue(): string {
		return this.#oldValue;
	}
	constructor() {
		super();
		this.setAttribute("is", "select-changes"); // allow for easy query selecting
		this.#oldValue = this.value;
		this.#newValue = this.value;
		const eventCb = (_: Event) => {
			if (this.#newValue == this.value) {
				return;
			}
			this.#oldValue = this.#newValue;
			this.#newValue = this.value;
		};
		this.addEventListener("change", eventCb, { capture: true });
		this.addEventListener("input", eventCb, { capture: true });
	}
}
customElements.define("select-changes", SelectChangesElement, { extends: "select" });

export class SwapComponentElement extends SwapComponentAutogen {
	constructor() {
		super();

		const inTokenElem = this.refs.form.elements["in-token"] as SelectChangesElement;
		const outTokenElem = this.refs.form.elements["out-token"] as SelectChangesElement;
		inTokenElem.addEventListener("change", (_) => {
			this.refs.inIcon.src = "/assets/lazy-load.svg";
			setTimeout(() => {
				this.refs.inIcon.src = getUserTokenInfo(inTokenElem.value).icon;
			}, 1);
			const { decimals } = getUserTokenInfo(inTokenElem.value);
			this.refs.form.elements["in-amount"].step = (10 ** -decimals).toString();
			this.refs.form.elements["in-amount"].step = (10 ** -decimals).toString();

			if (outTokenElem.value == inTokenElem.value) {
				outTokenElem.value = inTokenElem.oldValue;
				outTokenElem.dispatchEvent(new Event("change"));
			}

			this.refreshBalances();
			this.refreshTradeOutput();
		});
		outTokenElem.addEventListener("change", (_) => {
			this.refs.outIcon.src = "/assets/lazy-load.svg";
			setTimeout(() => {
				this.refs.outIcon.src = getUserTokenInfo(outTokenElem.value).icon;
			}, 1);
			const { decimals } = getUserTokenInfo(outTokenElem.value);
			this.refs.form.elements["out-amount"].step = (10 ** -decimals).toString();
			this.refs.form.elements["out-amount"].step = (10 ** -decimals).toString();

			if (inTokenElem.value == outTokenElem.value) {
				inTokenElem.value = outTokenElem.oldValue;
				inTokenElem.dispatchEvent(new Event("change"));
			}

			this.refreshBalances();
			this.refreshTradeOutput();
		});

		this.refs.form.elements["in-amount"].addEventListener("input", (ev) => {
			this.refreshTradeOutput();
		});
		this.refs.form.addEventListener("submit", (ev) => {
			ev.preventDefault();
			const inDenom = this.refs.form.elements["in-token"].value;
			const outDenom = this.refs.form.elements["out-token"].value;
			if (inDenom == outDenom) {
				alert("Nothing to do", 'The "from" and "to" coins are the same.');
				return;
			}
			const inAmount =
				stringDecimalToBigInt(this.refs.form.elements["in-amount"].value, getUserTokenInfo(inDenom).decimals) ||
				0n;
			errorDialogIfRejected(async () => {
				try {
					setLoading(true, "Waiting for transaction confirmation...");
					const swapMarket = await this.swapMarket();
					const client = await ClientEnv.get();
					await client.executeContractMulti(swapMarket.buildSwapIxs(inAmount, inDenom, outDenom, 0.5)!);
				} finally {
					setLoading(false);
				}
			});
		});
		this.rebuildSwapOptions();
	}
	invalidateSwapMarket() {
		this.#swapMarket = null;
	}
	#swapMarket: SwapMarket | null = null;
	async swapMarket(): Promise<SwapMarket> {
		if (this.#swapMarket == null) {
			const client = await ClientEnv.get();
			const swapMarket = await SwapMarket.getFromChainId(client.wasmClient, client.chainId);
			await swapMarket.refresh();
			this.#swapMarket = swapMarket;
		}
		return this.#swapMarket;
	}

	rebuildSwapOptions() {
		disableFormInputs(this.refs.form);
		this.refs.form.classList.add("lazy-loading");
		errorDialogIfRejected(async () => {
			try {
				this.refs.inError.innerText = "Loading swap market...";
				this.refs.form.elements["in-token"].innerHTML = "";
				this.refs.form.elements["out-token"].innerHTML = "";
				const allPairs = (await this.swapMarket()).getAllPairs();
				const uniqueTokens: Set<string> = new Set();
				for (const pair of allPairs) {
					uniqueTokens.add(pair.assets[0]);
					uniqueTokens.add(pair.assets[1]);
				}
				for (const tokenDenom of uniqueTokens) {
					const optionElem = document.createElement("option");
					optionElem.innerText = getUserTokenInfo(tokenDenom).symbol;
					optionElem.value = tokenDenom;
					this.refs.form.elements["in-token"].appendChild(optionElem.cloneNode(true));
					this.refs.form.elements["out-token"].appendChild(optionElem);
				}
				this.refs.form.elements["in-token"].value = allPairs[0].assets[0];
				this.refs.form.elements["in-token"].dispatchEvent(new Event("change"));
				this.refs.form.elements["out-token"].value = allPairs[0].assets[1];
				this.refs.form.elements["out-token"].dispatchEvent(new Event("change"));
				this.refs.inError.innerText = "";
				enableFormInputs(this.refs.form, [this.refs.btnInHalf, this.refs.btnInMax]);
				this.refreshBalances();
			} catch (ex: any) {
				this.refs.inError.innerText = "Unable to load swap market";
				throw ex;
			} finally {
				this.refs.form.classList.remove("lazy-loading");
			}
		});
	}

	refreshBalances() {
		errorDialogIfRejected(async () => {
			this.refs.inBalance.innerText = "";
			this.refs.inBalance.classList.add("lazy-loading-text-2");
			this.refs.outBalance.innerText = "";
			this.refs.outBalance.classList.add("lazy-loading-text-2");
			try {
				// const appConfig = getAppChainConfig(getSelectedChain());
				const inToken = this.refs.form.elements["in-token"].value;
				const outToken = this.refs.form.elements["out-token"].value;
				if (!inToken || !outToken) {
					this.refs.inBalance.innerText = "[Invalid]";
					this.refs.outBalance.innerText = "[Invalid]";
					return;
				}
				const client = await ClientEnv.get();
				if (client.account == null) {
					this.refs.inBalance.innerText = "[Not connected]";
					this.refs.outBalance.innerText = "[Not connected]";
					return;
				}
				this.refs.inBalance.innerText = UIAmount(await client.getBalance(inToken), inToken);
				this.refs.inBalance.classList.remove("lazy-loading-text-2");
				this.refs.outBalance.innerText = UIAmount(await client.getBalance(outToken), outToken);
				this.refs.outBalance.classList.remove("lazy-loading-text-2");
			} catch (ex: any) {
				if (!this.refs.inBalance.innerText) {
					this.refs.inBalance.innerText = "[Error]";
				}
				if (!this.refs.outBalance.innerText) {
					this.refs.outBalance.innerText = "[Error]";
				}
				throw ex;
			} finally {
				this.refs.inBalance.classList.remove("lazy-loading-text-2");
				this.refs.outBalance.classList.remove("lazy-loading-text-2");
			}
		});
	}

	#shouldRefreshTradeOutput: boolean = false;
	#refreshingTradeOutput: boolean = false;
	refreshTradeOutput() {
		this.#shouldRefreshTradeOutput = true;
		if (!this.#refreshingTradeOutput) {
			this.#refreshingTradeOutput = true;

			const tokenInAmountElem = this.refs.form.elements["in-amount"];
			const tokenOutAmountElem = this.refs.form.elements["out-amount"];
			const swapButtonElem = this.refs.btnSwap;
			swapButtonElem.disabled = true;
			this.refs.inError.innerText = "";
			this.refs.inError.classList.add("lazy-loading-text");
			this.refs.outError.innerText = "";
			(async () => {
				// This takes a second or so, so best to defer this if we're debouncing anyway
				const clientPromise = ClientEnv.get();
				do {
					swapButtonElem.disabled = true;
					this.#shouldRefreshTradeOutput = false;
					tokenOutAmountElem.value = "";
					this.refs.inError.innerText = "";
					this.refs.inError.classList.add("lazy-loading-text");
					const [client] = await Promise.all([
						clientPromise,
						new Promise((resolve) => setTimeout(resolve, 500)),
					]);
					const inDenom = this.refs.form.elements["in-token"].value;
					const outDenom = this.refs.form.elements["out-token"].value;
					const tokenInAmount =
						stringDecimalToBigInt(tokenInAmountElem.value, getUserTokenInfo(inDenom).decimals) || 0n;
					if (tokenInAmount <= 0n) {
						this.refs.inError.innerText = "Input must be a valid number greater than 0";
						this.refs.inError.classList.remove("lazy-loading-text");
						continue;
					}
					if (client.account == null) {
						this.refs.inError.innerText = "Wallet must be connected to simulate trades";
						this.refs.inError.classList.remove("lazy-loading-text");
						continue;
					}
					const swapMarket = await this.swapMarket();
					const simResult = await swapMarket.simulateSwap(client, tokenInAmount, inDenom, outDenom, 0.5);
					const sloppyResult = swapMarket.exchangeValue(tokenInAmount, inDenom, outDenom, true) ?? 0n;
					const approxSlippageRate = 1 - Number(simResult.amount) / Number(sloppyResult);

					tokenOutAmountElem.value = bigIntToStringDecimal(
						simResult.amount,
						getUserTokenInfo(outDenom).decimals,
						true
					);
					if (approxSlippageRate > 0.005) {
						this.refs.outError.innerText =
							"Warning: approx. " + (approxSlippageRate * 100).toFixed(2) + "% slippage";
					} else {
						this.refs.outError.innerText = "";
					}
					swapButtonElem.disabled = false;
				} while (this.#shouldRefreshTradeOutput);
			})()
				.catch((ex: any) => {
					if (isProbablyTxError(ex)) {
						const errParts = makeTxExecErrLessFugly(ex);
						if (errParts) {
							this.refs.inError.innerText = errParts.errorSource + ": " + errParts.errorDetail;
						} else {
							this.refs.inError.innerText = "Transaction Error: " + ex.message;
						}
					} else {
						this.refs.inError.innerText = ex.name + ": " + ex.message;
					}
					console.error("refreshTradeOutput:", ex);
				})
				.finally(() => {
					this.#refreshingTradeOutput = false;
					this.refs.inError.classList.remove("lazy-loading-text");
					//swapButtonElem.classList.remove("lazy-loading-text-double");
				});
		}
	}
}
SwapComponentElement.registerElement();

seiUtilEventEmitter.on("defaultNetworkChanged", (ev) => {
	(qa(`div[is="swap-component"]`) as NodeListOf<SwapComponentElement>).forEach((elem) => {
		elem.invalidateSwapMarket();
		elem.refreshTradeOutput();
	});
});
seiUtilEventEmitter.on("defaultProviderChanged", (ev) => {
	(qa(`div[is="swap-component"]`) as NodeListOf<SwapComponentElement>).forEach((elem) => {
		elem.refreshBalances();
		elem.refreshTradeOutput();
	});
});

seiUtilEventEmitter.on("transactionConfirmed", (ev) => {
	(qa(`div[is="swap-component"]`) as NodeListOf<SwapComponentElement>).forEach((elem) => {
		elem.refreshBalances();
		elem.refreshTradeOutput();
	});
});
