#!/usr/bin/env ts-node
import * as wtfnode from "wtfnode";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import {
	ClientEnv
} from "./helpers"
const activeClients: CosmWasmClient[] = [];

import {seiprotocol as SeiProtocol} from "@sei-js/proto";
const TokenFactoryComposer = SeiProtocol.seichain.tokenfactory.MessageComposer.withTypeUrl;

async function main() {
	const clientEnv = await ClientEnv.newFromEnvVars();
	activeClients.push(clientEnv.client);
	console.log(`chainID: ${clientEnv.chainId} wallet: ${clientEnv.account.address}`);
//	console.log({clientEnv});

	const newSubDenom = "test-" + Date.now().toString(36);
	const newDenom = "factory/" + clientEnv.account.address + "/" + newSubDenom;
	console.log("Creating new denom", newDenom);

	//console.log("Creating")
	const deliverTxResponse = await clientEnv.signAndSend([
		TokenFactoryComposer.createDenom({
			sender: clientEnv.account.address,
			subdenom: newSubDenom
		}),
		TokenFactoryComposer.mint({
			sender: clientEnv.account.address,
			amount: {
				denom: newDenom,
				amount: "1000000000000000000"
			}
		})
	]);
	console.log({deliverTxResponse});
	//clientEnv.client.sendTokens
}
(async () => {
	try {
		await main();
	}catch(ex: any) {
		console.error(ex);
		process.exitCode = 1;
	}
	activeClients.forEach(v => v.disconnect());
	activeClients.length = 0;
})();
let breaks = 5;
process.on("SIGINT", () => {
	wtfnode.dump();
	breaks -= 1;
	console.log(breaks, "break(s) left");
	if (breaks == 0) {
		process.exit(130);
	}
});
