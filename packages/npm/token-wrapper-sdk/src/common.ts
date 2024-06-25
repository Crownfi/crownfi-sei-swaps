import sei from "@crownfi/sei-js-core";

export type Amount = bigint | number;
export type SigningClient = Awaited<ReturnType<typeof sei.getSigningCosmWasmClient>>;
