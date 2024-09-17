import { ExecuteInstruction, WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { Coin, QueryClient } from "@cosmjs/stargate";
import { ERC20TokenWrapper } from "./erc20.js";
import { CW20TokenWrapper } from "./cw20.js";
import { EvmExecuteInstruction, IBigIntCoin, SeiChainId, SeiClientAccountData } from "@crownfi/sei-utils";

export type MaybeContractTokenKind = ContractTokenKind | 0;
export enum ContractTokenKind {
	CW20 = 1,
	ERC20 = 2
}

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
	static getFromChainId<Q extends QueryClient & WasmExtension>(queryClient: Q, chainId: SeiChainId): MultiTokenWrapper<Q> {
		return new MultiTokenWrapper(
			queryClient,
			CW20TokenWrapper.getAddressFromChainId(chainId),
			ERC20TokenWrapper.getAddressFromChainId(chainId),
		);
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

	wrappedDenomKind(denom: string): MaybeContractTokenKind {
		if (this.cw20Wrapper.isWrappedDenom(denom)) {
			return ContractTokenKind.CW20;
		} else if (this.erc20Wrapper.isWrappedDenom(denom)) {
			return ContractTokenKind.ERC20;
		}
		return 0;
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
	buildWrapIxs(
		amount: number | bigint | string,
		prefixedContractAddr: string,
		sender: SeiClientAccountData,
		recipient: SeiClientAccountData
	): (EvmExecuteInstruction | ExecuteInstruction)[] {
		if (prefixedContractAddr.startsWith("erc20/")) {
			return this.erc20Wrapper.buildWrapIxs(
				amount,
				prefixedContractAddr,
				sender.evmAddress,
				recipient.seiAddress
			);
		} else if (prefixedContractAddr.startsWith("cw20/")) {
			return [this.cw20Wrapper.buildWrapIx(amount, prefixedContractAddr, recipient.seiAddress)];
		} else {
			throw new Error(
				"MultiTokenWrapper: " +
				"buildWrapIxs: Must provide a contract address prefixed with \"erc20/\" or \"cw20/\""
			);
		}
	}
	buildUnwrapIxs(
		wrappedTokens: (Coin | IBigIntCoin)[],
		recipient: SeiClientAccountData
	): ExecuteInstruction[] {
		const wrappedCW20s = [];
		const wrappedERC20s = [];
		for (const wrappedToken of wrappedTokens) {
			if (this.cw20Wrapper.isWrappedDenom(wrappedToken.denom)) {
				wrappedCW20s.push(wrappedToken);
			} else if (this.erc20Wrapper.isWrappedDenom(wrappedToken.denom)) {
				wrappedERC20s.push(wrappedToken);
			}
			// Ignore non-wrapped tokens
		}
		const result = [];
		if (wrappedCW20s.length) {
			result.push(this.cw20Wrapper.buildUnwrapIx(wrappedCW20s, recipient.seiAddress));
		}
		if (wrappedERC20s.length) {
			result.push(this.erc20Wrapper.buildUnwrapIx(wrappedERC20s, recipient.evmAddress));
		}
		return result;
	}
	buildUnwrapIxsUnchecked(
		contractTokenKind: ContractTokenKind,
		recipient: SeiClientAccountData
	): ExecuteInstruction {
		switch (contractTokenKind) {
			case ContractTokenKind.CW20:
				return this.cw20Wrapper.buildUnwrapIxUnchecked(recipient.seiAddress);
			case ContractTokenKind.ERC20:
				return this.cw20Wrapper.buildUnwrapIxUnchecked(recipient.evmAddress);
			default:
				throw new Error("Invalid ContractTokenKind value");
		}
	}
}
