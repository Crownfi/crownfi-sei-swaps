import * as sei from "@crownfi/sei-js-core";

export type Amount = bigint | number;
export type SigningClient = Awaited<ReturnType<typeof sei.getSigningCosmWasmClient>>;

export const ERR_DOES_NOT_BELONG_TO_CONTRACT = new Error("token does not belong to contract");

export const validate_native_denom_factory = (contract_addr: string) => (native_denom: string) => {
	if (native_denom.split("/")[1] !== contract_addr) throw ERR_DOES_NOT_BELONG_TO_CONTRACT;
};

export const check_native_denom_factory =
	(contract_addr: string) =>
	(native_denom: string): boolean =>
		native_denom.split("/")[1] === contract_addr;
