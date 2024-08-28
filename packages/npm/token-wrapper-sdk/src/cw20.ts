import { ExecuteInstruction, WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { Coin, QueryClient } from "@cosmjs/stargate";
import { stringToCanonicalAddr } from "@crownfi/sei-js-core";
import base32 from "hi-base32";

import { Cw20WrapperContract } from "./base/cw_20_wrapper.js";
import { Nullable_Addr } from "./base/types.js";
import { assertFactoryTokenSourceMatches, factoryTokenSourceMatches } from "./common.js";
import { IBigIntCoin, nativeDenomSortCompare } from "@crownfi/sei-utils";

export class CW20TokenWrapper<Q extends QueryClient & WasmExtension> {
	contract: Cw20WrapperContract<Q>;
	constructor(client: Q, contractAddress: string) {
		this.contract = new Cw20WrapperContract(client, contractAddress)
	}
	/**
	 * Checks if the specified denom starts with "cw20/" followed by a sei1 contract address
	 * @param denom the denom to check
	 * @returns true if the string follows the format `cw20/{contract_address}`, false otherwise.
	 */
	isWrapable(denom: string): boolean {
		return /^cw20\/sei1(?:[a-z0-9]{38}|[a-z0-9]{58})$/.test(denom);
	}
	/**
	 * Checks if the denom specified is likely to be minted from this contract.
	 * 
	 * If you wish to definitively check this, check if {@link unwrappedDenomOf} returns a non-null value instead.
	 * 
	 * @param denom the native denom to check
	 * @returns 
	 */
	isWrappedDenom(denom: string): boolean {
		return factoryTokenSourceMatches(denom, this.contract.address);
	}
	/**
	 * Works like {@link isWrappedDenom} but throws an error if the denom is not likely to come from this contract.
	 * 
	 * @param denom the native denom to check 
	 * @returns 
	 */
	assertWrappedDenom(denom: string) {
		return assertFactoryTokenSourceMatches(denom, this.contract.address);
	}
	/**
	 * Takes the specified contract address (or denom in `cw20/{contract_address}` format) and returns the denom of the
	 * token this contract would mint in return.
	 * 
	 * @param cw20Addr the contract address or cw20 denom to check
	 * @returns the token factory token this contract would mint when given the specified cw20 token
	 */
	wrappedDenomOf(cw20Addr: string): string {
		if (cw20Addr.startsWith("cw20/")) {
			cw20Addr = cw20Addr.substring("cw20/".length);
		}
		return `factory/${this.contract.address}/${base32
			.encode(stringToCanonicalAddr(cw20Addr), true)
			.substring(0, 44)
			.toLowerCase()}`;
	}
	/**
	 * Queries the contract for the CW20 contract address associated with denom specified.
	 * 
	 * The returned promise will reject if the denom specified does not belong to this contract
	 * 
	 * @param wrappedDenom The token factory denom to query with
	 * @returns The contract address or null if the `wrappedDenom` has never been minted
	 */
	async unwrappedDenomOf(wrappedDenom: string): Promise<Nullable_Addr> {
		this.assertWrappedDenom(wrappedDenom);
		return this.contract.queryUnwrappedAddrOf({ denom: wrappedDenom });
	}
	/**
	 * Builds the instruction to wrap the CW20 tokens into token factory tokens.
	 * 
	 * @param amount amount of tokens to wrap
	 * @param cw20Addr the contract address or denom in `cw20/{contract_address}` to wrap
	 * @param recipient who to send the resulting wrapped tokens to, defaults to the sender.
	 * @returns the execute instructions to wrap the token
	 */
	buildWrapIx(
		amount: number | bigint | string,
		cw20Addr: string,
		recipient?: string
	): ExecuteInstruction {
		if (cw20Addr.startsWith("cw20/")) {
			cw20Addr = cw20Addr.substring("cw20/".length);
		}
		return this.contract.executeIxCw20(
			Buffer.from(recipient ? stringToCanonicalAddr(recipient): []),
			cw20Addr,
			amount
		);
	}
	/**
	 * Builds the instruction to unwrap the token factory tokens minted by this contract back into CW20 tokens.
	 * 
	 * @param wrappedTokens the coins to unwrap, they must be associated with this contract or this function throws an error
	 * @param recipient who to send the resulting unwrapped tokens to, defaults to the sender.
	 * @returns the execute instructions to unwrap the token
	 */
	buildUnwrapIx(
		wrappedTokens: (Coin | IBigIntCoin)[],
		recipient?: string
	): ExecuteInstruction {
		const funds = wrappedTokens.map(wrappedToken => {
			this.assertWrappedDenom(wrappedToken.denom);
			return {
				amount: wrappedToken.amount + "",
				denom: wrappedToken.denom
			};
		});
		funds.sort(nativeDenomSortCompare);
		return this.contract.buildUnwrapIx({receiver: recipient}, funds);
	}
}
