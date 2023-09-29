// TODO: Select config somehow
import * as localsei from "./localsei";
import * as atlantic_2 from "./atlantic-2";
export type SeiNetId = "localsei" | "sei-chain" | "atlantic-2" | "pacific-1"
export type chainConfig = {
	"rpcUrl": string,
	"restUrl": string,
	"tokenCodeID": number,
	"tokenAddress": string,
	"pairCodeID": number,
	"factoryAddress": string,
	"routerAddress": string,
	"pairs": {[name: string]: {
		"token0": string,
		"token1": string,
		"pool": string,
		"lpToken": string,
		"oracle": string
	}}
}

export function getAppChainConfig(netId: SeiNetId): chainConfig {
	switch (netId) {
		case "localsei":
			return localsei.CHAIN_CONFIG;
		case "atlantic-2":
			return atlantic_2.CHAIN_CONFIG;
		default:
			throw new Error("No chain config defiend for " + netId);
	}
}
