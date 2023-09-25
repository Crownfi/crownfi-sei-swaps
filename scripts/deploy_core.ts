#!/usr/bin/env ts-node
console.log("-- starting...");
import "dotenv/config"
import * as wtfnode from "wtfnode";
import {
	ARTIFACTS_PATH,
	writeArtifact,
	readArtifact,
	toEncodedBinary,
	ClientEnv,
} from "./helpers"
import * as path from "path"
import { chainConfigs } from "./types.d/chain_configs";
import { strictEqual } from "assert";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";

const SECONDS_IN_DAY: number = 60 * 60 * 24 // min, hour, day
const activeClients: CosmWasmClient[] = [];

async function main() {
	const clientEnv = await ClientEnv.newFromEnvVars();
	activeClients.push(clientEnv.client);
	console.log(`chainID: ${clientEnv.chainId} wallet: ${clientEnv.account.address}`);
	if (!chainConfigs.generalInfo.defaultAdmin) {
		throw new Error("Set the proper defaultAdmin for the contracts")
	}
	const networkData = readArtifact(clientEnv.chainId);
	networkData.rpcUrl = chainConfigs.generalInfo.rpcUrl;
	networkData.restUrl = chainConfigs.generalInfo.restUrl;
	writeArtifact(networkData, clientEnv.chainId);

	await uploadAndInitToken(clientEnv);
	await uploadPairContracts(clientEnv);
	await uploadAndInitFactory(clientEnv);
	await uploadAndInitRouter(clientEnv);
	console.log("Done!");
}

async function uploadAndInitToken(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)

	if (!network.tokenCodeID) {
		network.tokenCodeID = await clientEnv.uploadContract(path.join(ARTIFACTS_PATH, 'astroport_token.wasm')!)
		writeArtifact(network, clientEnv.chainId)
		console.log(`Token codeId: ${network.tokenCodeID}`)
	}

	if (!network.tokenAddress) {
		chainConfigs.token.admin ||= chainConfigs.generalInfo.defaultAdmin
		chainConfigs.token.initMsg.marketing.marketing ||= chainConfigs.generalInfo.defaultAdmin

		for (let i = 0; i < chainConfigs.token.initMsg.initial_balances.length; i++) {
			chainConfigs.token.initMsg.initial_balances[i].address ||= chainConfigs.generalInfo.defaultAdmin
		}

		console.log('Deploying Token...')
		let resp = await clientEnv.deployContract(
			chainConfigs.token.admin,
			path.join(ARTIFACTS_PATH, 'astroport_token.wasm'),
			chainConfigs.token.initMsg,
			chainConfigs.token.label,
		)

		// @ts-ignore
		network.tokenAddress = resp.shift().shift()
		console.log("astro:", network.tokenAddress)
		console.log(await clientEnv.queryContract(network.tokenAddress, { token_info: {} }))
		console.log(await clientEnv.queryContract(network.tokenAddress, { minter: {} }))

		for (let i = 0; i < chainConfigs.token.initMsg.initial_balances.length; i++) {
			let balance = await clientEnv.queryContract(network.tokenAddress, { balance: { address: chainConfigs.token.initMsg.initial_balances[i].address } })
			strictEqual(balance.balance, chainConfigs.token.initMsg.initial_balances[i].amount)
		}

		writeArtifact(network, clientEnv.chainId)
	}
}

async function uploadPairContracts(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)

	if (!network.pairCodeID) {
		console.log('Register Pair Contract...')
		network.pairCodeID = await clientEnv.uploadContract(path.join(ARTIFACTS_PATH, 'astroport_pair.wasm')!)
		writeArtifact(network, clientEnv.chainId)
	}
}

async function uploadAndInitStaking(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)

	if (!network.xastroTokenCodeID) {
		console.log('Register xASTRO token contract...')
		network.xastroTokenCodeID = await clientEnv.uploadContract(path.join(ARTIFACTS_PATH, 'astroport_xastro_token.wasm')!)
		writeArtifact(network, clientEnv.chainId)
	}

	if (!network.stakingAddress) {
		chainConfigs.staking.initMsg.deposit_token_addr ||= network.tokenAddress
		chainConfigs.staking.initMsg.token_code_id ||= network.xastroTokenCodeID
		chainConfigs.staking.initMsg.marketing.marketing ||= chainConfigs.generalInfo.defaultAdmin
		chainConfigs.staking.initMsg.owner ||= chainConfigs.generalInfo.defaultAdmin
		chainConfigs.staking.admin ||= chainConfigs.generalInfo.defaultAdmin

		console.log('Deploying Staking...')
		let resp = await clientEnv.deployContract(
			chainConfigs.staking.admin,
			path.join(ARTIFACTS_PATH, 'astroport_staking.wasm'),
			chainConfigs.staking.initMsg,
			chainConfigs.staking.label,
		)

		let addresses = resp.shift()
		// @ts-ignore
		network.stakingAddress = addresses.shift();
		// @ts-ignore
		network.xastroAddress = addresses.shift();

		console.log(`Staking Contract Address: ${network.stakingAddress}`)
		console.log(`xASTRO token Address: ${network.xastroAddress}`)
		writeArtifact(network, clientEnv.chainId)
	}
}

async function uploadAndInitFactory(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)

	if (!network.factoryAddress) {
		console.log('Deploying Factory...')
		console.log(`CodeId Pair Contract: ${network.pairCodeID}`)
		console.log(`CodeId Stable Pair Contract: ${network.pairStableCodeID}`)

		for (let i = 0; i < chainConfigs.factory.initMsg.pair_configs.length; i++) {
			if (!chainConfigs.factory.initMsg.pair_configs[i].code_id) {
				if (JSON.stringify(chainConfigs.factory.initMsg.pair_configs[i].pair_type) === JSON.stringify({ xyk: {} })) {
					chainConfigs.factory.initMsg.pair_configs[i].code_id ||= network.pairCodeID;
				}

				if (JSON.stringify(chainConfigs.factory.initMsg.pair_configs[i].pair_type) === JSON.stringify({ stable: {} })) {
					chainConfigs.factory.initMsg.pair_configs[i].code_id ||= network.pairStableCodeID;
				}
			}
		}

		chainConfigs.factory.initMsg.token_code_id ||= network.tokenCodeID;
		chainConfigs.factory.initMsg.whitelist_code_id ||= network.whitelistCodeID;
		chainConfigs.factory.initMsg.owner ||= clientEnv.account.address;
		chainConfigs.factory.admin ||= chainConfigs.generalInfo.defaultAdmin;

		let resp = await clientEnv.deployContract(
			chainConfigs.factory.admin,
			path.join(ARTIFACTS_PATH, 'astroport_factory.wasm'),
			chainConfigs.factory.initMsg,
			chainConfigs.factory.label
		)

		// @ts-ignore
		network.factoryAddress = resp.shift().shift()
		console.log(`Address Factory Contract: ${network.factoryAddress}`)
		writeArtifact(network, clientEnv.chainId)

		// Set new owner for factory
		if (chainConfigs.factory.change_owner) {
			console.log(
				'Propose owner for factory. Ownership has to be claimed within %s days',
				Number(chainConfigs.factory.proposeNewOwner.expires_in) / SECONDS_IN_DAY
			)
			await clientEnv.executeContract(
				network.factoryAddress,
				{
					"propose_new_owner": chainConfigs.factory.proposeNewOwner
				}
			)
		}
	}
}

async function uploadAndInitRouter(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)

	if (!network.routerAddress) {
		chainConfigs.router.initMsg.astroport_factory ||= network.factoryAddress
		chainConfigs.router.admin ||= chainConfigs.generalInfo.defaultAdmin;

		console.log('Deploying Router...')
		let resp = await clientEnv.deployContract(
			chainConfigs.router.admin,
			path.join(ARTIFACTS_PATH, 'astroport_router.wasm'),
			chainConfigs.router.initMsg,
			chainConfigs.router.label
		)

		// @ts-ignore
		network.routerAddress = resp.shift().shift()
		console.log(`Address Router Contract: ${network.routerAddress}`)
		writeArtifact(network, clientEnv.chainId)
	}
};

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
