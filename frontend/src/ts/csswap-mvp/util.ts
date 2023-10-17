import { getAppChainConfig } from "./chain_config";
import { Asset } from "./contract_schema/pair/query";
import { showError } from "./popups/error";
import { getSelectedChain } from "./wallet-env";

export const q = document.querySelector.bind(document);
export const qa = document.querySelectorAll.bind(document);

export function errorDialogIfRejected(f: () => Promise<void>) {
	f().catch(ex => {
		console.error(ex);
		showError(ex);
	});
}
export function bigIntAbs(val: bigint): bigint {
	if (val < 0n) {
		return val * -1n;
	}
	return val;
}
export function bigIntToStringDecimal(rawAmount: bigint | number, decimals: number, trimTrailingZeros: boolean = false): string {
	let result: string;
	if (typeof rawAmount === "number") {
		if (decimals == 0) {
			return Math.floor(rawAmount).toString();
		}
		// Can't use .toString() as that switches to scientific notations with values smaller than 0.000001
		result = (rawAmount / (10 ** decimals)).toFixed(decimals)
	}else{
		if (decimals == 0) {
			return rawAmount.toString();
		}
		const divisor = 10n ** BigInt(Math.trunc(decimals))
		result = (rawAmount / divisor).toString() + "." +  (bigIntAbs(rawAmount) % divisor).toString().padStart(decimals, "0");
	}
	if (trimTrailingZeros) {
		return result.replace(/\.(\d*?)0+$/, (_, g1) => {
			if (!g1) {
				return "";
			}
			return "." + g1;
		})
	}
	return result;
}
export function stringDecimalToBigInt(str: string | number, decimals: number): bigint | null {
	str = String(str);
	const matches = str.match(/(-?)(\d*)(?:\.(\d+)|\.)?/);
	if (matches == null) {
		return null;
	}
	const [_, sign, intPart, decimalPart] = matches;
	if (!intPart && !decimalPart) {
		return null;
	}
	const multiplier = 10n ** BigInt(Math.trunc(decimals))
	const result = BigInt(intPart || "") * multiplier + BigInt(((decimalPart || "").substring(0, decimals) || "").padEnd(decimals, "0"));
	if (sign) {
		return result * -1n;
	}
	return result;
}

export function UIAmount(amount: bigint | string | number, unifiedDenom: string, trimTrailingZeros: boolean = false): string {
	const tokenUserInfo = getAppChainConfig(getSelectedChain()).tokenUserInfo[unifiedDenom] || {
		"symbol": "(" + unifiedDenom + ")",
		"decimals": 1,
		"icon": ""
	};
	if(typeof amount == "string"){
		amount = BigInt(amount);
	}
	return bigIntToStringDecimal(amount, tokenUserInfo.decimals, trimTrailingZeros) + " " + tokenUserInfo.symbol;
}
export function UIAsset(asset: Asset, trimTrailingZeros: boolean = false): string {
	return UIAmount(...contractAssetToAmountWithDenom(asset), trimTrailingZeros);
}

export function contractAssetToAmountWithDenom(asset: Asset): [bigint, string] {
	if ("token" in asset.info) {
		return [BigInt(asset.amount), "cw20/" + asset.info.token.contract_addr]
	}else{
		return [BigInt(asset.amount), asset.info.native_token.denom]
	}
}

export function amountWithDenomToContractAsset(amount: bigint | string | number, unifiedDenom: string): Asset {
	return {
		amount: amount.toString(),
		info: (() => {
			if (unifiedDenom.startsWith("cw20/")) {
				return {
					token: {contract_addr: unifiedDenom.substring("cw20/".length)}
				}
			}else{
				return {
					native_token: {denom: unifiedDenom}
				}
			}
		})()
	}
}
