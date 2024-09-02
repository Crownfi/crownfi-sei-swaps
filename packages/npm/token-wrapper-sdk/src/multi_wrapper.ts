import { WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { QueryClient } from "@cosmjs/stargate";
import { ERC20TokenWrapper } from "./erc20.js";
import { CW20TokenWrapper } from "./cw20.js";

export class MultiTokenWrapper<Q extends QueryClient & WasmExtension> {
	cw20Wrapper: CW20TokenWrapper<Q>
	erc20Wrapper: ERC20TokenWrapper<Q>
	constructor(
		client: Q,
		cw20WrapperAddress: string,
		erc20WrapperAddress: string,
	) {
		this.cw20Wrapper = new CW20TokenWrapper(client, cw20WrapperAddress);
		this.erc20Wrapper = new ERC20TokenWrapper(client, erc20WrapperAddress);
	}

	/**
	 * Checks if the specified denom represents an ERC20 token or an CW20 token
	 * 
	 * @param denom the denom to check
	 * @returns true if the string follows the format `cw20/{contract_address}`, or `erc20/{contract_address}` false
	 * otherwise.
	 */
	isWrapable(denom: string): boolean {
		return this.cw20Wrapper.isWrapable(denom) || this.erc20Wrapper.isWrapable(denom);
	}

	/**
	 * Checks if the denom specified is likely to be minted from one of the token wrapper contracts
	 * 
	 * @param denom the native denom to check
	 * @returns 
	 */
	isWrappedDenom(denom: string): boolean {
		return this.cw20Wrapper.isWrappedDenom(denom) || this.erc20Wrapper.isWrappedDenom(denom);
	}

	/**
	 * Works like {@link isWrappedDenom} but throws an error if the denom is not likely to come from the contracts
	 * 
	 * @param denom the native denom to check 
	 */
	assertWrappedDenom(denom: string) {
		this.cw20Wrapper.assertWrappedDenom(denom);
		this.erc20Wrapper.assertWrappedDenom(denom);
	}

	/**
	 * Takes the specified denom, if it represents a contract token, as in, if it follows the 
	 * `erc20/{contract_address}` or `cw20/{contract_address}` formats, this will return the associated wrapped native
	 * token denom. Otherwise, it returns the denom unchanged.
	 * 
	 * @param denom the denom or prefixed token address
	 */
	normalizeToWrappedDenom(denom: string): string {
		if (denom.startsWith("cw20/")) {
			this.cw20Wrapper.wrappedDenomOf(denom);
		} else if (denom.startsWith("erc20/")) {
			this.erc20Wrapper.wrappedDenomOf(denom);
		}
		return denom;
	}

	/**
	 * Takes the specified denom, and if it is likely to be minted by one of the wrapper contracts, return its
	 * unwrapped variant with the associated prefix. `erc20/{contract_address}` or `cw20/{contract_address}`.
	 * 
	 * May reject the promise if the wrapped token hasn't ever been minted yet.
	 */
	async normalizeToUnwrappedDenom(denom: string): Promise<string> {
		if (this.cw20Wrapper.isWrappedDenom(denom)) {
			// FIXME: Check underlying implementation, the thing throws an error on not-found and is therefore probably
			// not nullable.
			return (await this.cw20Wrapper.unwrappedDenomOf(denom))!;
		} else if (this.erc20Wrapper.isWrappedDenom(denom)) {
			return this.erc20Wrapper.unwrappedDenomOf(denom);
		}
		return denom;
	}

	
}
