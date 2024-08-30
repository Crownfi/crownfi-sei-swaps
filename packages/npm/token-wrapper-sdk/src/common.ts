import { WrapperContractDenomError } from "./error.js";

export function assertFactoryTokenSourceMatches(
	nativeDenom: string,
	contractAddr: string,
	validSubdenomCheck: (subdenom: string) => boolean
) {
	if (!factoryTokenSourceMatches(nativeDenom, contractAddr, validSubdenomCheck)) {
		throw new WrapperContractDenomError(nativeDenom, contractAddr);
	}
}

export function factoryTokenSourceMatches(
	nativeDenom: string,
	contractAddr: string,
	validSubdenomCheck: (subdenom: string) => boolean
): boolean {
	const denomPrefix = "factory/" + contractAddr + "/";
	return nativeDenom.startsWith(denomPrefix) && validSubdenomCheck(nativeDenom.substring(denomPrefix.length));
}
