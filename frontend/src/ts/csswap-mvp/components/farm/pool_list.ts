import { SeiNetId, getAppChainConfig } from "../../chain_config";
import { UIAsset, errorDialogIfRejected, qa } from "../../util";
import { ClientEnv, SeiTransactionConfirmedEvent, SeiWalletChangedEvent, getSelectedChain } from "../../wallet-env";
import { FarmPoolComponentAutogen, FarmPoolItemAutogen, FarmPoolItemOptionsAutogen } from "./_autogen";

import { QueryMsg as FactoryContractQueryMsg } from "../../contract_schema/factory/query";
import { FeeInfoResponse as FactoryContractFeeInfoResponse } from "../../contract_schema/factory/responses/fee_info"

import { ExecuteMsg as PairContractExecuteMsg } from "../../contract_schema/pair/execute";
import { Cw20HookMsg as PairContractCw20HookMsg } from "../../contract_schema/pair/cw20_hook_msg";
import { QueryMsg as PairContractQueryMsg } from "../../contract_schema/pair/query";
import { ArrayOf_Asset as PairContractSharesResponse } from "../../contract_schema/pair/responses/share";
import { PairInfo as PairContractPairInfoResponse } from "../../contract_schema/pair/responses/pair";
import { PoolResponse as PairContractPoolResponse } from "../../contract_schema/pair/responses/pool";
import { ConfigResponse as PairContractConfigResponse } from "../../contract_schema/pair/responses/config";

import { ExecuteMsg as CW20ExecuteMsg } from "../../contract_schema/token/execute";
import { QueryMsg as Cw20QueryMsg } from "../../contract_schema/token/query";
import { BalanceResponse as Cw20BalanceResponse } from "../../contract_schema/token/responses/balance";
import { FarmPoolDepositDialogElement, FarmPoolWithdrawDialogElement } from ".";


export class FarmPoolComponentElement extends FarmPoolComponentAutogen {
	referencedChain: SeiNetId | null = null;
	constructor() {
		super();
		this.rebuildPoolList();
	}
	rebuildPoolList(dontIfChainUnchanged: boolean = false) {
		const selectedChain = getSelectedChain();
		if (dontIfChainUnchanged && this.referencedChain == selectedChain) {
			return;
		}
		// Can't just blank out the pool list cuz we need to keep the headings.
		while (
			this.refs.poolList.lastElementChild instanceof FarmPoolItemElement ||
			this.refs.poolList.lastElementChild instanceof FarmPoolItemOptionsElement
		) {
			this.refs.poolList.lastElementChild.remove();
		}
		const appConfig = getAppChainConfig(selectedChain);
		for (const poolName in appConfig.pairs) {
			const poolListItemElem = new FarmPoolItemElement();
			poolListItemElem.pool = poolName;
			this.refs.poolList.append(poolListItemElem);
		}
		this.referencedChain = selectedChain;
	}
}
FarmPoolComponentElement.registerElement();

window.addEventListener("seiWalletChanged", ((ev: SeiWalletChangedEvent) => {
	(qa(`div[is="farm-pool-component"]`) as NodeListOf<FarmPoolComponentElement>).forEach(elem => {
		elem.rebuildPoolList(true);
	});
}) as (ev: Event) => void);

export class FarmPoolItemElement extends FarmPoolItemAutogen {
	constructor() {
		super();
		this.refs.btnExpand.addEventListener("click", (ev) => {
			if (this.classList.contains("expanded")) {
				if (this.nextElementSibling instanceof FarmPoolItemOptionsElement) {
					this.nextElementSibling.remove();
				}
				this.classList.remove("expanded");
			}else{
				const newOptions = new FarmPoolItemOptionsElement();
				newOptions.pool = this.pool;
				this.after(newOptions);
				this.classList.add("expanded");
			}
		});
	}
	onPoolChanged(oldPoolName: string | null, poolName: string | null) {
		if(oldPoolName == poolName || poolName == null) {
			return;
		}
		const appConfig = getAppChainConfig(getSelectedChain());
		const poolInfo = appConfig.pairs[poolName];
		if (poolInfo == null) {
			this.refs.poolName.innerText = "[NULL]"
			this.refs.iconToken0.src = "/assets/placeholder.svg";
			this.refs.iconToken1.src = "/assets/placeholder.svg";
			return;
		}
		const token0UserInfo = appConfig.tokenUserInfo[poolInfo.token0] || {
			"symbol": "(" + poolInfo.token0 + ")",
			"decimals": 0,
			"icon": "/assets/placeholder.svg"
		}
		const token1UserInfo = appConfig.tokenUserInfo[poolInfo.token1] || {
			"symbol": "(" + poolInfo.token0 + ")",
			"decimals": 0,
			"icon": "/assets/placeholder.svg"
		}
		this.refs.poolName.innerText = poolName;
		this.refs.iconToken0.src = token0UserInfo.icon;
		this.refs.iconToken1.src = token1UserInfo.icon;
		this.refreshPoolStats();
	}
	refreshPoolStats() {
		const poolName = this.pool;
		if (!poolName) {
			return;
		}
		const appConfig = getAppChainConfig(getSelectedChain());
		const poolInfo = appConfig.pairs[poolName];
		errorDialogIfRejected(async () => {
			const client = await ClientEnv.get();
			console.log("poolInfo.pool", poolInfo.pool);
			const pairQuery = await client.queryContract(
				poolInfo.pool,
				{
					pair: {}
				} satisfies PairContractQueryMsg
			) as PairContractPairInfoResponse;
			console.log(poolName + " pair query:", {pairQuery});
			const poolQuery = await client.queryContract(
				poolInfo.pool,
				{
					pool: {}
				} satisfies PairContractQueryMsg
			) as PairContractPoolResponse;
			console.log(poolName + " pool query:", {poolQuery});
			const configQuery = await client.queryContract(
				poolInfo.pool,
				{
					config: {}
				} satisfies PairContractQueryMsg
			) as PairContractConfigResponse;
			console.log(poolName + " config query:", {configQuery});

			const cumulativePricesQuery = await client.queryContract(
				poolInfo.pool,
				{
					cumulative_prices: {}
				} satisfies PairContractQueryMsg
			);
			console.log(poolName + " cumulativePrices query:", {cumulativePricesQuery});
			/*
			const observation5Seconds = await client.queryContract(
				poolInfo.pool,
				{
					observe: {seconds_ago: 5}
				} satisfies PairContractQueryMsg
			);
			console.log(poolName + " pool query:", {observation5Seconds});
			*/
			
			const feeInfoQuery = await client.queryContract(
				configQuery.factory_addr,
				{
					fee_info: {
						pair_type: pairQuery.pair_type
					}
				} satisfies FactoryContractQueryMsg
			) as FactoryContractFeeInfoResponse;

			this.refs.totalDeposits.innerText = poolQuery.assets.map(v => UIAsset(v)).join("\n");
			this.refs.feeRate.innerText = (feeInfoQuery.total_fee_bps / 100).toFixed(2) + "%"
		});
	}
}
FarmPoolItemElement.registerElement();

window.addEventListener("seiTransactionConfirmed", ((ev: SeiTransactionConfirmedEvent) => {
	(qa(`div[is="farm-pool-item"]`) as NodeListOf<FarmPoolItemElement>).forEach(elem => {
		elem.refreshPoolStats();
	});
}) as (ev: Event) => void);



export class FarmPoolItemOptionsElement extends FarmPoolItemOptionsAutogen {
	constructor(){
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
		this.refs.withdrawBtn.disabled = true;
		this.refs.depositBtn.disabled = true;
		this.refs.depositTxt.innerText = "⏳️";
		this.refs.withdrawTxt.innerText = "⏳️";
		errorDialogIfRejected(async () => {
			try{
				const client = await ClientEnv.get();
				if (this.pool == null || client.account == null) {
					this.refs.depositTxt.innerText = "[Not connected]";
					this.refs.withdrawTxt.innerText = "[Not connected]";
					return;
				}
				this.refs.withdrawBtn.disabled = false;
				this.refs.depositBtn.disabled = false;
				const appConfig = getAppChainConfig(getSelectedChain());
				const poolInfo = appConfig.pairs[this.pool];
				const {balance: lpBalance} = await client.queryContract(
					poolInfo.lpToken,
					{
						balance: {address: client.account.address}
					} satisfies Cw20QueryMsg
				) as Cw20BalanceResponse;
				this.refs.depositTxt.innerText = lpBalance;

				const assets = await client.queryContract(
					poolInfo.pool,
					{
						share: {amount: lpBalance}
					} satisfies PairContractQueryMsg
				) as PairContractSharesResponse;
				this.refs.withdrawTxt.innerText = assets.map(v => UIAsset(v)).join("\n");
			}catch(ex: any){
				if (this.refs.depositTxt.innerText == "⏳️") {
					this.refs.depositTxt.innerText = "[Error]";
				}
				if (this.refs.withdrawTxt.innerText == "⏳️") {
					this.refs.withdrawTxt.innerText = "[Error]";
				}
				throw ex;
			}
		});
	}
	onPoolChanged(oldPoolName: string | null, poolName: string | null) {
		this.refreshBalances();
	}
}
FarmPoolItemOptionsElement.registerElement();

window.addEventListener("seiTransactionConfirmed", ((ev: SeiTransactionConfirmedEvent) => {
	(qa(`div[is="farm-pool-item-options"]`) as NodeListOf<FarmPoolItemOptionsElement>).forEach(elem => {
		elem.refreshBalances();
	});
}) as (ev: Event) => void);

window.addEventListener("seiWalletChanged", ((ev: SeiWalletChangedEvent) => {
	(qa(`div[is="farm-pool-item-options"]`) as NodeListOf<FarmPoolItemOptionsElement>).forEach(elem => {
		elem.refreshBalances();
	});
}) as (ev: Event) => void);

/*
import { ExecuteInstruction } from "@cosmjs/cosmwasm-stargate";
import { ExecuteMsg as PairContractExecuteMsg } from "../../contract_schema/pair/execute";
import { Cw20HookMsg as PairContractCw20HookMsg } from "../../contract_schema/pair/cw20_hook_msg";
import { ExecuteMsg as CW20ExecuteMsg } from "../../contract_schema/token/execute";
import { QueryMsg as Cw20QueryMsg } from "../../contract_schema/token/query";
import { BalanceResponse as Cw20BalanceResponse } from "../../contract_schema/token/responses/balance";
import { ComponentPairInfo } from "../../types";
import { amountToAssetInfo, errorDialogIfRejected } from "../../util";
import { ClientEnv, getSelectedChain } from "../../wallet-env";
// import { FarmComponentAutogen } from "./autogen";
import { Coin } from "@cosmjs/proto-signing";
import { getAppChainConfig } from "../../chain_config";
*/

/*
export class FarmComponentElement extends FarmComponentAutogen {
	pairInfo: ComponentPairInfo;
	private balanceRefreshTimer: ReturnType<typeof setInterval> | null;
	constructor(pair: ComponentPairInfo) {
		super();
		if (arguments.length == 0) {
			// If we ever do SSR, might be worth having a data-* tag with some JSON in it
			throw new Error("You can't just add a <farm-component> to the DOM all raw like that.");
		}
		this.pairInfo = pair;
		this.slots.title.innerText = pair.name;
		this.slots.denomToken0.innerText = pair.token0;
		this.slots.denomToken1.innerText = pair.token1;
		this.slots.denomLpToken.innerText = pair.name + "_LP";
		this.refs.formDeposit.onsubmit = (ev) => {
			ev.preventDefault();
			errorDialogIfRejected(async () => {
				await this.executeDeposit();
			});
		}
		this.refs.formWithdraw.onsubmit = (ev) => {
			ev.preventDefault();
			errorDialogIfRejected(async () => {
				await this.executeWithdraw();
			});
		}
		this.balanceRefreshTimer = null;
	}
	connectedCallback() {
		console.debug("FarmComponentElement " + this.pairInfo.name + " added to page.");
		if (this.balanceRefreshTimer != null) {
			clearInterval(this.balanceRefreshTimer);
		}
		this.refreshBalances().catch((ex) => {
			console.error("Could not refresh balances for " + this.pairInfo.name);
			console.error(ex);
		});
		this.balanceRefreshTimer = setInterval(() => {
			this.refreshBalances().catch((ex) => {
				console.error("Could not refresh balances for " + this.pairInfo.name);
				console.error(ex);
			});
		}, 30 * 1000);
	}
	disconnectedCallback() {
		console.debug("FarmComponentElement " + this.pairInfo.name + " removed from page.");
		if (this.balanceRefreshTimer != null) {
			clearInterval(this.balanceRefreshTimer);
			this.balanceRefreshTimer = null;
		}
	}
	async refreshBalances() {
		this.slots.balanceLpToken.innerText = "⏳️";
		this.slots.balanceToken0.innerText = "⏳️";
		this.slots.balanceToken1.innerText = "⏳️";
		try{
			const client = await ClientEnv.get();
			if (client.account == null) {
				this.slots.balanceLpToken.innerText = "❓️";
				this.slots.balanceToken0.innerText = "❓️";
				this.slots.balanceToken1.innerText = "❓️";
				return;
			}
			const tokenAddrs = {
				balanceLpToken: {
					address: this.pairInfo.lpToken
				},
				balanceToken0: this.pairInfo.token0.startsWith("cw20/") ?
					{
						address: this.pairInfo.token0.substring("cw20/".length)
					} : {
						denom: this.pairInfo.token0
					},
				balanceToken1: this.pairInfo.token1.startsWith("cw20/") ?
					{
						address: this.pairInfo.token1.substring("cw20/".length)
					} : {
						denom: this.pairInfo.token1
					},
			}
			for (const slotName of ["balanceLpToken", "balanceToken0", "balanceToken1"] as const) {
				const token = tokenAddrs[slotName];
				if ("denom" in token) {
					const {
						balance: {
							amount: balance
						}
					} = await client.queryClient.cosmos.bank.v1beta1.balance({
						address: client.account.address,
						denom: token.denom!
					});
					this.slots[slotName].innerText = balance;
				}else{
					const {balance} = await client.queryContract(
						token.address,
						{
							balance: {address: client.account.address}
						} satisfies Cw20QueryMsg
					) as Cw20BalanceResponse;
					this.slots[slotName].innerText = balance;
				}
			}
		}catch(ex: any) {
			this.slots.balanceLpToken.innerText = "⚠️";
			this.slots.balanceToken0.innerText = "⚠️";
			this.slots.balanceToken1.innerText = "⚠️";
			throw ex;
		}
	}
	async executeDeposit() {
		this.refs.depositBtn.disabled = true;
		try{
			const form = this.refs.formDeposit;
			if (!form.reportValidity()) {
				return;
			}
			const {amount0, amount1} = form.values();
			const client = await ClientEnv.get();

			const funds: Coin[] = []
			const ixs: ExecuteInstruction[] = [];
			if (this.pairInfo.token0.startsWith("cw20/")) {
				ixs.push({
					contractAddress: this.pairInfo.token0.substring("cw20/".length),
					msg: {
						increase_allowance: {
							amount: amount0 + "",
							spender: this.pairInfo.pool
						}
					} satisfies CW20ExecuteMsg
				});
			} else {
				funds.push({
					amount: amount0 + "",
					denom: this.pairInfo.token0
				});
			}
			if (this.pairInfo.token1.startsWith("cw20/")) {
				ixs.push({
					contractAddress: this.pairInfo.token1.substring("cw20/".length),
					msg: {
						increase_allowance: {
							amount: amount1 + "",
							spender: this.pairInfo.pool
						}
					} satisfies CW20ExecuteMsg
				});
			} else {
				funds.push({
					amount: amount1 + "",
					denom: this.pairInfo.token1
				});
			}
			ixs.push({
				contractAddress: this.pairInfo.pool,
				msg: {
					provide_liquidity: {
						assets: [
							amountToAssetInfo(amount0, this.pairInfo.token0),
							amountToAssetInfo(amount1, this.pairInfo.token1)
						]
					}
				} satisfies PairContractExecuteMsg,
				funds
			});
			const {transactionHash} = await client.executeContractMulti(ixs);
			console.info("Transaction hash:", transactionHash);
		} finally {
			this.refs.depositBtn.disabled = false;
		}
	}
	async executeWithdraw() {
		this.refs.withdrawBtn.disabled = true;
		try {
			const form = this.refs.formWithdraw;
			const {amount} = form.values();
			const client = await ClientEnv.get();
			const {transactionHash} = await client.executeContract(
				this.pairInfo.lpToken,
				{
					send: {
						amount: amount + "",
						contract: this.pairInfo.pool,
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
			console.info("Transaction hash:", transactionHash);
		} finally {
			this.refs.withdrawBtn.disabled = false;
		}
	}
}
FarmComponentElement.registerElement();

export function appendFarmComponents(targetElement: HTMLElement) {
	const {pairs} = getAppChainConfig(getSelectedChain());
	for (const k in pairs) {
		const pair = pairs[k];
		const farmElem = new FarmComponentElement({
			...pair,
			name: k
		});
		targetElement.appendChild(farmElem);
	}
}
*/
