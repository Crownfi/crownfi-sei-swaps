import { FarmPoolComponentAutogen, FarmPoolItemAutogen, FarmPoolItemOptionsAutogen } from "./_autogen.js";
import { SwapMarket } from "@crownfi/sei-swaps-sdk";
import { ClientEnv, UIAmount, getUserTokenInfo, seiUtilEventEmitter } from "@crownfi/sei-utils";
import { errorDialogIfRejected } from "../../dialogs/index.js";
import { qa } from "../../util.js";
import { FarmPoolWithdrawDialogElement } from "./withdraw_dialog.js";
import { FarmPoolDepositDialogElement } from "./deposit_dialog.js";

export class FarmPoolComponentElement extends FarmPoolComponentAutogen {
	constructor() {
		super();
		this.refs.bigChestTvl.innerText = "";
		this.refs.bigChestTvl.classList.add("lazy-loading-text-4");
		this.refs.bigChestTotalTraded.innerText = "";
		this.refs.bigChestTotalTraded.classList.add("lazy-loading-text-4");
		this.refs.bigChestVolume24H.innerText = "";
		this.refs.bigChestVolume24H.classList.add("lazy-loading-text-4");
		this.rebuildPoolList();
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
	/**
	 * This also calls refreshGlobalStats
	 */
	rebuildPoolList() {
		// Can't just blank out the pool list cuz we need to keep the headings.
		while (
			this.refs.poolList.lastElementChild instanceof FarmPoolItemElement ||
			this.refs.poolList.lastElementChild instanceof FarmPoolItemOptionsElement
		) {
			this.refs.poolList.lastElementChild.remove();
		}
		// loading stuff here
		const placeholderElems: FarmPoolItemElement[] = [];
		for (let i = 0; i < 3; i += 1) {
			placeholderElems[i] = new FarmPoolItemElement();
			this.refs.poolList.append(placeholderElems[i]);
			placeholderElems[i].classList.add("lazy-loading");
		}
		errorDialogIfRejected(async () => {
			const swapMarket = await this.swapMarket();
			this.refreshGlobalStats();
			const allPairs = swapMarket.getAllPairs();
			if (allPairs.length < placeholderElems.length) {
				placeholderElems.splice(allPairs.length).forEach((elem) => elem.remove());
			}
			for (let i = 0; i < placeholderElems.length; i += 1) {
				placeholderElems[i].pool = allPairs[i].name;
				placeholderElems[i].refreshPoolStats();
			}
			for (let i = placeholderElems.length; i < allPairs.length; i += 1) {
				const poolListItemElem = new FarmPoolItemElement();
				poolListItemElem.pool = allPairs[i].name;
				this.refs.poolList.append(poolListItemElem);
				poolListItemElem.refreshPoolStats();
			}
		});
	}
	refreshGlobalStats() {
		const { bigChestTvl, bigChestTotalTraded, bigChestVolume24H } = this.refs;

		bigChestTvl.innerText = "";
		bigChestTvl.classList.add("lazy-loading-text-4");
		bigChestTotalTraded.innerText = "";
		bigChestTotalTraded.classList.add("lazy-loading-text-4");
		bigChestVolume24H.innerText = "";
		bigChestVolume24H.classList.add("lazy-loading-text-4");
		errorDialogIfRejected(async () => {
			const swapMarket = await this.swapMarket();
			const commonValueDenom = "usei"; // change this to usdc or something idk

			let approxTVL = 0n;
			for (const pair of swapMarket.getAllPairs()) {
				// I love how all "value" in crypto (and even finance) is fake.
				approxTVL += swapMarket.exchangeValue(pair.totalDeposits[0], pair.assets[0], commonValueDenom) ?? 0n;
				approxTVL += swapMarket.exchangeValue(pair.totalDeposits[1], pair.assets[1], commonValueDenom) ?? 0n;
			}
			bigChestTvl.innerText = UIAmount(approxTVL, commonValueDenom, true);
			bigChestTvl.classList.remove("lazy-loading-text-4");
			bigChestTotalTraded.innerText = "[TODO]";
			bigChestTotalTraded.classList.remove("lazy-loading-text-4");
			bigChestVolume24H.innerText = "[TODO]";
			bigChestVolume24H.classList.remove("lazy-loading-text-4");
		});
	}

	static findFromParent(element: HTMLElement | null): FarmPoolComponentElement | null {
		while (!(element instanceof FarmPoolComponentElement)) {
			if (element == null) {
				return null;
			}
			element = element.parentElement;
		}
		return element;
	}
}
FarmPoolComponentElement.registerElement();

seiUtilEventEmitter.on("defaultNetworkChanged", (ev) => {
	(qa(`div[is="farm-pool-component"]`) as NodeListOf<FarmPoolComponentElement>).forEach((elem) => {
		elem.invalidateSwapMarket();
		elem.rebuildPoolList();
	});
});

export class FarmPoolItemElement extends FarmPoolItemAutogen {
	constructor() {
		super();
		this.refs.btnExpand.addEventListener("click", (ev) => {
			if (this.classList.contains("expanded")) {
				if (this.nextElementSibling instanceof FarmPoolItemOptionsElement) {
					this.nextElementSibling.remove();
				}
				this.classList.remove("expanded");
			} else {
				const newOptions = new FarmPoolItemOptionsElement();
				newOptions.pool = this.pool;
				this.after(newOptions);
				newOptions.refreshBalances();
				this.classList.add("expanded");
			}
		});
	}
	onPoolChanged(_: string | null, newValue: string | null): void {
		if (newValue) {
			this.refs.btnExpand.disabled = false;
			this.classList.remove("lazy-loading");
			this.refs.poolName.innerText = newValue;
			this.refreshPoolStats();
		} else {
			this.refs.btnExpand.disabled = true;
			this.classList.add("lazy-loading");
		}
	}
	refreshPoolStats() {
		const marketElem = FarmPoolComponentElement.findFromParent(this);
		if (marketElem == null) {
			// Not added to the DOM yet
			return;
		}

		const { exchangeRate, totalDeposits, feeRate, volume24H, apy: apyElem } = this.refs;
		exchangeRate.innerText = "";
		exchangeRate.classList.add("lazy-loading-text-2");

		totalDeposits.innerHTML =
			'<span class="lazy-loading-text-4"></span><br><span class="lazy-loading-text-4"></span>';

		feeRate.innerText = "";
		feeRate.classList.add("lazy-loading-text-2");

		volume24H.innerText = "[TODO]";
		apyElem.innerText = "[TODO]";
		errorDialogIfRejected(async () => {
			const market = await marketElem.swapMarket();
			const pair = market.getPairFromName(this.pool + "")!;

			const tokenInfo0 = getUserTokenInfo(pair.assets[0]);
			const tokenInfo1 = getUserTokenInfo(pair.assets[1]);

			exchangeRate.innerText =
				"1 " +
				tokenInfo0.symbol +
				" = " +
				pair.exchangeRate().toFixed(tokenInfo1.decimals) +
				" " +
				tokenInfo1.symbol;
			exchangeRate.classList.remove("lazy-loading-text-2");

			totalDeposits.innerText = pair.totalDeposits
				.map((amount, index) => {
					return UIAmount(amount, pair.assets[index]);
				})
				.join("\n");

			feeRate.innerText = (pair.totalFeeBasisPoints / 100).toFixed(2) + "%";
			feeRate.classList.remove("lazy-loading-text-2");

			this.refs.iconToken0.src = tokenInfo0.icon;
			this.refs.iconToken1.src = tokenInfo1.icon;
		});
	}
}
FarmPoolItemElement.registerElement();

seiUtilEventEmitter.on("transactionConfirmed", (ev) => {
	(qa(`div[is="farm-pool-item"]`) as NodeListOf<FarmPoolItemElement>).forEach((elem) => {
		elem.refreshPoolStats();
	});
});

export class FarmPoolItemOptionsElement extends FarmPoolItemOptionsAutogen {
	constructor() {
		super();

		this.refs.depositBtn.addEventListener("click", (ev) => {
			const newDialog = new FarmPoolDepositDialogElement();
			newDialog.refs.form.elements.pool.value = this.pool!;
			document.body.appendChild(newDialog);
		});
		this.refs.withdrawBtn.addEventListener("click", (ev) => {
			const newDialog = new FarmPoolWithdrawDialogElement();
			newDialog.refs.form.elements.pool.value = this.pool!;
			document.body.appendChild(newDialog);
		});
	}
	refreshBalances() {
		const swapMarketElem = FarmPoolComponentElement.findFromParent(this);
		if (swapMarketElem == null) {
			// not attached to DOM
			return;
		}
		this.refs.withdrawBtn.disabled = true;
		this.refs.depositBtn.disabled = true;
		this.refs.depositTxt.innerText = "";
		this.refs.depositTxt.classList.add("lazy-loading-text-2");
		this.refs.withdrawTxt.innerText = "";
		this.refs.withdrawTxt.classList.add("lazy-loading-text-2");
		errorDialogIfRejected(async () => {
			try {
				const [pool, client] = await Promise.all([
					swapMarketElem.swapMarket().then((market) => market.getPairFromName(this.pool + "")),
					ClientEnv.get(),
				]);

				if (pool == null || client.account == null) {
					this.refs.depositTxt.innerText = "[Not connected]";
					this.refs.depositTxt.classList.remove("lazy-loading-text-2");
					this.refs.withdrawTxt.innerText = "[Not connected]";
					this.refs.withdrawTxt.classList.remove("lazy-loading-text-2");
					return;
				}
				this.refs.withdrawBtn.disabled = false;
				this.refs.depositBtn.disabled = false;

				const lpBalance = await client.getBalance(pool.contract.address);

				this.refs.depositTxt.innerText = lpBalance + "";
				this.refs.withdrawTxt.innerText = pool
					.shareValue(lpBalance)
					.map((v) => UIAmount(...v))
					.join("\n");
			} catch (ex: any) {
				if (!this.refs.depositTxt.innerText) {
					this.refs.depositTxt.innerText = "[Error]";
				}
				if (!this.refs.withdrawTxt.innerText) {
					this.refs.withdrawTxt.innerText = "[Error]";
				}
				throw ex;
			} finally {
				this.refs.depositTxt.classList.remove("lazy-loading-text-2");
				this.refs.withdrawTxt.classList.remove("lazy-loading-text-2");
			}
		});
	}
	onPoolChanged(oldPoolName: string | null, poolName: string | null) {
		this.refreshBalances();
	}
}
FarmPoolItemOptionsElement.registerElement();

seiUtilEventEmitter.on("transactionConfirmed", (ev) => {
	(qa(`div[is="farm-pool-item-options"]`) as NodeListOf<FarmPoolItemOptionsElement>).forEach((elem) => {
		elem.refreshBalances();
	});
});
seiUtilEventEmitter.on("defaultProviderChanged", (ev) => {
	(qa(`div[is="farm-pool-item-options"]`) as NodeListOf<FarmPoolItemOptionsElement>).forEach((elem) => {
		elem.refreshBalances();
	});
});
