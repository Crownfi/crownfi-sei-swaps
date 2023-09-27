// TODO: Select config somehow
import * as localsei from "./localsei";
export type SeiNetId = "localsei" | "sei-chain" | "atlantic-2" | "pacific-1"

export function getAppChainConfig(netId: SeiNetId) {
	switch (netId) {
		case "localsei":
			return localsei.CHAIN_CONFIG;
		default:
			throw new Error("No chain config defiend for " + netId);
	}
}
