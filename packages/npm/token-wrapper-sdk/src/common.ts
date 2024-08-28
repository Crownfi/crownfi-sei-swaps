import { WrapperContractDenomError } from "./error.js";

export function assertFactoryTokenSourceMatches(
	nativeDenom: string,
	contractAddr: string,
) {
	if (!factoryTokenSourceMatches(nativeDenom, contractAddr)) {
		throw new WrapperContractDenomError(nativeDenom, contractAddr);
	}
}

export function factoryTokenSourceMatches(
	nativeDenom: string,
	contractAddr: string,
): boolean {
	return nativeDenom.startsWith("factory/" + contractAddr + "/");
}
