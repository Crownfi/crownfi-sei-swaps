import 'dotenv/config'
import {
	ARTIFACTS_PATH,
	ClientEnv,
	writeArtifact,
	readArtifact
} from './helpers.js'
import * as path from "path"
import { chainConfigs } from "./types.d/chain_configs.js";
import { strictEqual } from "assert";

// This script is mainly used for test purposes to deploy a token for further pool deployment

async function main() {
	const clientEnv = await ClientEnv.newFromEnvVars();
	console.log(`chainID: ${clientEnv.chainId} wallet: ${clientEnv.account.address}`)

	if (!chainConfigs.generalInfo.defaultAdmin) {
		throw new Error("Set the proper owner multisig for the contracts")
	}

	let network = readArtifact(clientEnv.chainId)

	if (!network.tokenCodeID) {
		network.tokenCodeID = clientEnv.uploadContract(path.join(ARTIFACTS_PATH, "astroport_token.wasm"))
		writeArtifact(network, clientEnv.chainId)
		console.log(`Token codeId: ${network.tokenCodeID}`)
	}

	let msg = {
		admin: chainConfigs.generalInfo.defaultAdmin,
		initMsg: {
			name: "Test 1",
			symbol: "TEST-T",
			decimals: 6,
			initial_balances: [
				{
					address: chainConfigs.generalInfo.defaultAdmin,
					amount: "1000000000000000"
				}
			],
			mint: {
				minter: chainConfigs.generalInfo.defaultAdmin
			}
		},
		label: "Test token"
	};

	console.log(`Deploying Token ${msg.initMsg.symbol}...`)
	let resp = await clientEnv.deployContract(
		clientEnv.account.address,
		path.join(ARTIFACTS_PATH, 'astroport_token.wasm'),
		msg.initMsg,
		msg.label,
	)

	// @ts-ignore
	let tokenAddress: string = resp.shift().shift()
	console.log("Token address:", tokenAddress)
	console.log(await clientEnv.queryContract(tokenAddress, { token_info: {} }))
	console.log(await clientEnv.queryContract(tokenAddress, { minter: {} }))

	for (let i = 0; i < msg.initMsg.initial_balances.length; i++) {
		let balance = await clientEnv.queryContract(tokenAddress, { balance: { address: msg.initMsg.initial_balances[i].address } })
		strictEqual(balance.balance, msg.initMsg.initial_balances[i].amount)
	}

	writeArtifact(network, clientEnv.chainId)
	console.log('FINISH')
}

(async () => {
	try {
		await main();
	}catch(ex: any) {
		console.error(ex);
		process.exitCode = 1;
	}
})();
