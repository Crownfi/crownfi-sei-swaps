import { ExecuteInstruction } from "@cosmjs/cosmwasm-stargate";
import { ExecuteMsg as PairContractExecuteMsg } from "../../contract_schema/pair/execute";
import { Cw20HookMsg as PairContractCw20HookMsg } from "../../contract_schema/pair/cw20_hook_msg";
import { ExecuteMsg as CW20ExecuteMsg } from "../../contract_schema/token/execute";

import { QueryMsg as PairContractQueryMsg } from "../../contract_schema/pair/query";
import { PoolResponse as PairContractPoolResponse } from "../../contract_schema/pair/responses/pool";
import { ArrayOf_Asset as PairContractSharesResponse } from "../../contract_schema/pair/responses/share";
import { Coin } from "@cosmjs/proto-signing";

import { getAppChainConfig } from "../../chain_config";
import { UIAmount, UIAsset, amountWithDenomToContractAsset, bigIntToStringDecimal, contractAssetToAmountWithDenom, errorDialogIfRejected, stringDecimalToBigInt } from "../../util";
import { ClientEnv, getSelectedChain } from "../../wallet-env";
import {FarmPoolDepositDialogAutogen, FarmPoolWithdrawDialogAutogen} from "./_autogen";
import { setLoading } from "../../loading";
import { alert } from "../../popups";

// TODO: It would be better to re-use these modals rather than constantly creating/destroying them.
// ...but this works for now.
export class FarmPoolDepositDialogElement extends FarmPoolDepositDialogAutogen {
	constructor(){
		super();
		this.refs.btnCancel.addEventListener("click", (ev) => {
			ev.preventDefault();
			this.close();
		});
		this.addEventListener("close", (ev) => {
			this.remove();
		});
		this.addEventListener("submit", (ev) => {
			const form = this.refs.form;
			
			// not using form.values() here as I want to get the amounts as a string
			const pool = form.elements.pool.value;
			const appConfig = getAppChainConfig(getSelectedChain());
			const poolInfo = appConfig.pairs[pool];
			const {decimals: token0Decimals} = appConfig.tokenUserInfo[poolInfo.token0] || {
				decimals: 0
			}
			const {decimals: token1Decimals} = appConfig.tokenUserInfo[poolInfo.token1] || {
				decimals: 0
			}
			const amount0 = stringDecimalToBigInt(form.elements.amount0.value, token0Decimals);
			const amount1 = stringDecimalToBigInt(form.elements.amount1.value, token1Decimals);
			if (amount0 == null || amount1 == null) {
				return;
			}
			errorDialogIfRejected(async () => {
				try{
					setLoading(true, "Waiting for transaction confirmation...");
					const funds: Coin[] = []
					const ixs: ExecuteInstruction[] = [];
					if (poolInfo.token0.startsWith("cw20/")) {
						ixs.push({
							contractAddress: poolInfo.token0.substring("cw20/".length),
							msg: {
								increase_allowance: {
									amount: amount0 + "",
									spender: poolInfo.pool
								}
							} satisfies CW20ExecuteMsg
						});
					} else {
						funds.push({
							amount: amount0 + "",
							denom: poolInfo.token0
						});
					}
					if (poolInfo.token1.startsWith("cw20/")) {
						ixs.push({
							contractAddress: poolInfo.token1.substring("cw20/".length),
							msg: {
								increase_allowance: {
									amount: amount1 + "",
									spender: poolInfo.pool
								}
							} satisfies CW20ExecuteMsg
						});
					} else {
						funds.push({
							amount: amount1 + "",
							denom: poolInfo.token1
						});
					}
					ixs.push({
						contractAddress: poolInfo.pool,
						msg: {
							provide_liquidity: {
								assets: [
									amountWithDenomToContractAsset(amount0, poolInfo.token0),
									amountWithDenomToContractAsset(amount1, poolInfo.token1)
								]
							}
						} satisfies PairContractExecuteMsg,
						funds
					});
					const client = await ClientEnv.get();
					const {transactionHash} = await client.executeContractMulti(ixs);
					// alert("Transaction confirmed", "Transaction ID:\n" + transactionHash);
				}finally{
					setLoading(false);
				}
			});
		});
		this.refs.form.elements.result.addEventListener("input", (ev) => {
			this.refreshSharesInput();
		});
	}
	refreshBalances() {
		this.refs.balanceToken0.innerText = "⏳️";
		this.refs.balanceToken1.innerText = "⏳️";
		this.refs.balanceResult.innerText = "⏳️";
		errorDialogIfRejected(async () => {
			try{
				const appConfig = getAppChainConfig(getSelectedChain());
				const poolInfo = appConfig.pairs[this.refs.form.elements.pool.value];

				const client = await ClientEnv.get();
				this.refs.balanceToken0.innerText = UIAmount(
					await client.getBalance(poolInfo.token0),
					poolInfo.token0
				);
				this.refs.balanceToken1.innerText = UIAmount(
					await client.getBalance(poolInfo.token1),
					poolInfo.token1
				);
				this.refs.balanceResult.innerText = (
					await client.getBalance("cw20/" + poolInfo.lpToken)
				).toString();
			}catch(ex: any){
				if (this.refs.balanceToken0.innerText == "⏳️") {
					this.refs.balanceToken0.innerText = "[Error]"
				}
				if (this.refs.balanceToken1.innerText == "⏳️") {
					this.refs.balanceToken1.innerText = "[Error]"
				}
				if (this.refs.balanceResult.innerText == "⏳️") {
					this.refs.balanceResult.innerText = "[Error]"
				}
				throw ex;
			}
		})
	}
	private _shouldRefreshSharesInput: boolean = false;
	private _refreshingSharesInput: boolean = false;
	refreshSharesInput() {
		this._shouldRefreshSharesInput = true;
		if (!this._refreshingSharesInput) {
			this._refreshingSharesInput = true;
			(async () => {
				do {
					this._shouldRefreshSharesInput = false;
					await new Promise(resolve => setTimeout(resolve, 500));
					const appConfig = getAppChainConfig(getSelectedChain());
					const poolInfo = appConfig.pairs[this.refs.form.elements.pool.value];
					const {decimals: token0Decimals} = appConfig.tokenUserInfo[poolInfo.token0] || {
						decimals: 0
					}
					const {decimals: token1Decimals} = appConfig.tokenUserInfo[poolInfo.token1] || {
						decimals: 0
					}

					const client = await ClientEnv.get();

					const {
						amount0: amount0Input,
						amount1: amount1Input,
						result: resultInput
					} = this.refs.form.elements;
					const desiredShares = resultInput.value;
					const assets = await client.queryContract(
						poolInfo.pool,
						{
							share: {amount: desiredShares}
						} satisfies PairContractQueryMsg
					) as PairContractSharesResponse;
					amount0Input.value = bigIntToStringDecimal(BigInt(assets[0].amount), token0Decimals);
					amount1Input.value = bigIntToStringDecimal(BigInt(assets[1].amount), token1Decimals);
				}while(this._shouldRefreshSharesInput);
			})().catch(console.error).finally(() => {
				this._refreshingSharesInput = false;
			});
		}
	}
	connectedCallback() {
		this.showModal();
		const poolName = this.refs.form.elements.pool.value;
		const appConfig = getAppChainConfig(getSelectedChain());
		const poolInfo = appConfig.pairs[poolName];
		if (poolInfo == null) {
			console.error("FarmPoolDepositDialogElement was created without a valid pool ID!");
			this.close();
		}
		const {symbol: token0Symbol, decimals: token0Decimals} = appConfig.tokenUserInfo[poolInfo.token0] || {
			symbol: "(" + poolInfo.token0 + ")",
			decimals: 0
		}
		const {symbol: token1Symbol, decimals: token1Decimals} = appConfig.tokenUserInfo[poolInfo.token1] || {
			symbol: "(" + poolInfo.token0 + ")",
			decimals: 0
		}
		this.refs.form.elements.amount0.step = (10 ** -token0Decimals).toString();
		this.refs.form.elements.amount1.step = (10 ** -token1Decimals).toString();
		this.refs.form.elements.amount0.min = (10 ** -token0Decimals).toString();
		this.refs.form.elements.amount1.min = (10 ** -token1Decimals).toString();
		this.refs.denomToken0.innerText = token0Symbol;
		this.refs.denomToken1.innerText = token1Symbol;

		this.refs.form.elements.result.readOnly = true; // TODO: Remove
		this.refs.form.elements.result.value = "NaN";

		this.refreshBalances();
		this.correctFundingModeInputs();
	}
	// Are there 0 shares which allow us to specify an arbitrary ratio? Or do we gotta work with a pre-existing one?
	// This is what this function does and enables/disables the inputs accordingly
	correctFundingModeInputs() {
		const form = this.refs.form;
		const {
			amount0: amount0Input,
			amount1: amount1Input,
			result: resultInput
		} = form.elements;
		amount0Input.disabled = true;
		amount1Input.disabled = true;
		resultInput.disabled = true;
		errorDialogIfRejected(async () => {
			const appConfig = getAppChainConfig(getSelectedChain());
			const poolInfo = appConfig.pairs[this.refs.form.elements.pool.value];
			const client = await ClientEnv.get();

			const poolQuery = await client.queryContract(
				poolInfo.pool,
				{
					pool: {}
				} satisfies PairContractQueryMsg
			) as PairContractPoolResponse;
			if (BigInt(poolQuery.total_share) > 0n) {
				amount0Input.readOnly = true;
				amount1Input.readOnly = true;
				resultInput.readOnly = false;
			}else{
				amount0Input.readOnly = false;
				amount1Input.readOnly = false;
				resultInput.readOnly = true;
			}
			amount0Input.disabled = false;
			amount1Input.disabled = false;
			resultInput.disabled = false;
		});
	}
}
FarmPoolDepositDialogElement.registerElement();
export class FarmPoolWithdrawDialogElement extends FarmPoolWithdrawDialogAutogen {
	constructor(){
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
			const pool = form.elements.pool.value;
			const appConfig = getAppChainConfig(getSelectedChain());
			const poolInfo = appConfig.pairs[pool];
			
			errorDialogIfRejected(async () => {
				try{
					setLoading(true, "Waiting for transaction confirmation...");
					
					const client = await ClientEnv.get();
					const {transactionHash} = await client.executeContract(
						poolInfo.lpToken,
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
					// alert("Transaction confirmed", "Transaction ID:\n" + transactionHash);
				}finally{
					setLoading(false);
				}
			});
		});
	}
	refreshBalances() {
		this.refs.balance.innerText = "⏳️";
		errorDialogIfRejected(async () => {
			try{
				const appConfig = getAppChainConfig(getSelectedChain());
				const poolInfo = appConfig.pairs[this.refs.form.elements.pool.value];

				const client = await ClientEnv.get();
				this.refs.balance.innerText = (
					await client.getBalance("cw20/" + poolInfo.lpToken)
				).toString();
			}catch(ex: any){
				if (this.refs.balance.innerText == "⏳️") {
					this.refs.balance.innerText = "[Error]"
				}
				throw ex;
			}
		})
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
					this.refs.tradeResult.innerText = "\n⏳️";
					await new Promise(resolve => setTimeout(resolve, 500));
					const appConfig = getAppChainConfig(getSelectedChain());
					const poolInfo = appConfig.pairs[this.refs.form.elements.pool.value];
					const client = await ClientEnv.get();
					const assets = await client.queryContract(
						poolInfo.pool,
						{
							share: {amount: this.refs.form.elements.amount.value}
						} satisfies PairContractQueryMsg
					) as PairContractSharesResponse;
					this.refs.tradeResult.innerText = "\n" + assets.map(v => UIAsset(v)).join("\n");
					
				}while(this._shouldRefreshTradeOutput);
			})().catch(console.error).finally(() => {
				this._refreshingTradeOutput = false;
			});
		}
	}
	connectedCallback() {
		this.showModal();
		this.refreshBalances();
	}
}
FarmPoolWithdrawDialogElement.registerElement();
