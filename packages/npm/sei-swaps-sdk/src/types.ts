import { Addr } from "@crownfi/sei-utils";

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

export function matchIfCW20Token<T>(
	unifiedDenom: UnifiedDenom,
	ifCW20Callback: (contractAddress: Addr) => T,
	ifNotCW20Callback: (denom: string) => T
): T {
	if (unifiedDenom.startsWith("cw20/")) {
		return ifCW20Callback(unifiedDenom.substring(5)); // "cw20/".length
	} else {
		return ifNotCW20Callback(unifiedDenom);
	}
}
