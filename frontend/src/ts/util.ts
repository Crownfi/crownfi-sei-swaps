import { Asset } from "./contract_schema/pair/query";

export function errorDialogIfRejected(f: () => Promise<void>) {
	f().catch(ex => {
		console.error(ex);
		alert(ex.name + ": " + ex.message + "\nMore details in console");
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
