import { Asset } from "./contract_schema/pair/query";
import { showError } from "./popups/error";

export function errorDialogIfRejected(f: () => Promise<void>) {
	f().catch(ex => {
		showError(ex);
	});
}


export function amountToAssetInfo(amount: bigint | string | number, denom: string): Asset {
	return {
		amount: amount.toString(),
		info: (() => {
			if (denom.startsWith("cw20/")) {
				return {
					token: {contract_addr: denom.substring("cw20/".length)}
				}
			}else{
				return {
					native_token: {denom}
				}
			}
		})()
	}
}
