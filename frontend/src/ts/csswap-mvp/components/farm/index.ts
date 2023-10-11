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
