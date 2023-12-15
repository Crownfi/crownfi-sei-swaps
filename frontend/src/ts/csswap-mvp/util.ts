import { getAppChainConfig } from "./chain_config";
import { Asset, AssetInfo } from "./contract_schema/pair/query";
import { showError } from "./popups";
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
		info: denomToContractAssetInfo(unifiedDenom)
	}
}
export function denomToContractAssetInfo(unifiedDenom: string): AssetInfo {
	if (unifiedDenom.startsWith("cw20/")) {
		return {
			token: {contract_addr: unifiedDenom.substring("cw20/".length)}
		}
	}else{
		return {
			native_token: {denom: unifiedDenom}
		}
	}
}

export function isProbablyTxError(e: any): boolean {
	return typeof e.message == "string" && e.message.match(/\.go\:\d+\]/m);
}
export function makeTxExecErrLessFugly(
	message: string
): {messageIndex: string, errorSource: string, errorDetail: string} | null {
	let betterErrorFormat = /failed to execute message; message index\:\s*?(\d+)\:\s+?(?:dispatch: submessages: )*(.*)\:\s+?(.*?)\s*?\[/.exec(
		message
	);
	
	if (betterErrorFormat) {
		const messageIndex = betterErrorFormat[1];
		let errorSource = betterErrorFormat[3];
		if (errorSource == "execute wasm contract failed") {
			errorSource = "Contract returned an error"
		}
		const errorDetail = betterErrorFormat[2];
		return {
			messageIndex,
			errorSource,
			errorDetail
		};
	} else {
		return null
	}
}

function getDirectPairs(): Map<string, string[]> {
	const result: Map<string, string[]> = new Map();
	const appConfig = getAppChainConfig(getSelectedChain());
	for (const k in appConfig.pairs) {
		const v = appConfig.pairs[k];
		if (result.has(v.token0)) {
			result.get(v.token0)?.push(v.token1);
		}else{
			result.set(v.token0, [v.token1])
		}
		if (result.has(v.token1)) {
			result.get(v.token1)?.push(v.token0);
		}else{
			result.set(v.token1, [v.token0])
		}
	}
	return result;
}

export function resolveRoute(
	unifiedDenomFrom: string,
	unifiedDenomTo: string,
	_directPairs: Map<string, string[]> = getDirectPairs(),
	_alreadySeenFroms: Set<string> = new Set()
): [string, string][] | null {
	if (_alreadySeenFroms.has(unifiedDenomFrom)) {
		return null; // We've already been here.
	}
	// Ideally we'd use some sort of node pathfinding algorithm with fees + gas being used as the distance weights...
	// But this is MVP so we're targetting lowest hops with brute force, baby!
	_alreadySeenFroms.add(unifiedDenomFrom);

	const directTos = _directPairs.get(unifiedDenomFrom);
	if (directTos == null) {
		return null;
	}
	let subResult: [string, string][] | null = null;
	for (let i = 0; i < directTos.length; i += 1) {
		const directTo = directTos[i];
		if (directTo == unifiedDenomTo) {
			// Can't get smaller than 0
			return [[unifiedDenomFrom, unifiedDenomTo]];
		}
		// EXPONENTIAL TIME COMPLEXITY LET'S GOOOOOOO
		const potentialSubResult = resolveRoute(directTo, unifiedDenomTo, _directPairs, _alreadySeenFroms);
		if (
			potentialSubResult != null &&
			(subResult == null || subResult.length > potentialSubResult.length)
		) {
			subResult = potentialSubResult
		}
	}
	if (subResult == null) {
		return null;
	}
	return [
		[unifiedDenomFrom, subResult[0][0]],
		...subResult
	];
}
