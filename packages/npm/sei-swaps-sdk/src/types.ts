import { Addr } from "@crownfi/sei-utils";

export interface AddrWithPayload {
	address: Addr,
	payload?: Buffer
}

/**
 * This represents either a native token denom, or a CW20 token.
 * CW20 tokens are represented with "cw20/{contractAddress}"
 *
 * Stable for "1.0"
 */
export type UnifiedDenom = string;
/**
 * Represents a pair of assets.
 *
 * Stable for "1.0"
 */
export type UnifiedDenomPair = [UnifiedDenom, UnifiedDenom];

export function matchTokenKind<T>(
	unifiedDenom: UnifiedDenom,
	ifCW20Callback: (contractAddress: Addr) => T,
	ifERC20Callback: (contractAddress: Addr) => T,
	ifNativeCallback: (denom: string) => T
): T {
	const splitedDenom = unifiedDenom.split("/");
	switch (splitedDenom[0]) {
		case "cw20":
			return ifCW20Callback(splitedDenom[1]); // "cw20/".length
		case "erc20":
			return ifERC20Callback(splitedDenom[1]);
		case "factory":
			return ifNativeCallback(unifiedDenom);
		default:
			throw new Error(`Unknown token: ${unifiedDenom}`);
	}
}
