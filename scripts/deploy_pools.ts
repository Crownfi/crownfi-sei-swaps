#!/usr/bin/env ts-node
console.log("-- starting...");
import 'dotenv/config'
import * as wtfnode from "wtfnode";
import {
	writeArtifact,
	readArtifact,
	toEncodedBinary,
	ARTIFACTS_PATH,
	ClientEnv,
} from './helpers'
import { join } from 'path'
import { chainConfigs } from "./types.d/chain_configs";
import { Pair } from './types.d/astroport_deploy_interfaces';
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
const activeClients: CosmWasmClient[] = [];

async function uploadAndInitOracle(clientEnv: ClientEnv, pair: Pair, network: any) {
	//let pool_oracle_key = "oracle" + pair.identifier

	if (pair.initOracle && !network[network.pairs[pair.identifier].oracle]) {
		chainConfigs.oracle.admin ||= chainConfigs.generalInfo.defaultAdmin
		chainConfigs.oracle.initMsg.factory_contract ||= network.factoryAddress
		chainConfigs.oracle.initMsg.asset_infos ||= pair.assetInfos

		console.log(`Deploying oracle for ${pair.identifier}...`)
		let resp = await clientEnv.deployContract(
			chainConfigs.oracle.admin,
			join(ARTIFACTS_PATH, 'astroport_oracle.wasm'),
			chainConfigs.oracle.initMsg,
			chainConfigs.oracle.label)

		network.pairs[pair.identifier].oracle = resp.shift()!.shift()!;
		console.log(`Address of ${pair.identifier} oracle contract: ${network.pairs[pair.identifier].oracle}`)
		writeArtifact(network, clientEnv.chainId)
	}
}

async function createPools(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)
	let pairs = chainConfigs.createPairs.pairs;
	let pools: string[][] = [];

	if (network.pairs == null) {
		network.pairs = {};
	}

	for (let i = 0; i < pairs.length; i++) {
		let pair = pairs[i]
		// let pool_pair_key = "pool" + pair.identifier
		// let pool_lp_token_key = "lpToken" + pair.identifier

		// Create pool
		if (!network.pairs[pair.identifier]) {
			console.log(`Creating pool ${pair.identifier}...`)
			let initParams = pair.initParams;
			if (initParams) {
				initParams = toEncodedBinary(initParams)
			}

			let res = await clientEnv.executeContract(network.factoryAddress, {
				create_pair: {
					pair_type: pair.pairType,
					asset_infos: pair.assetInfos,
					init_params: initParams
				}
			})
			network.pairs[pair.identifier] = {};
			network.pairs[pair.identifier].pool = res.logs[0].events.filter(el => el.type == 'wasm').map(x => x.attributes.filter(el => el.key === "pair_contract_addr").map(x => x.value))[0][0]
			let pool_info = await clientEnv.queryContract(network.pairs[pair.identifier].pool, {
				pair: {}
			})

			// write liquidity token
			network.pairs[pair.identifier].lpToken = pool_info.liquidity_token
			console.log(`Pair successfully created! Address: ${network.pairs[pair.identifier].pool}`)
			writeArtifact(network, clientEnv.chainId)

			if (pair.initGenerator) {
				pools.push([pool_info.liquidity_token, pair.initGenerator.generatorAllocPoint])
			}
		}

		// Deploy oracle
		await uploadAndInitOracle(clientEnv, pair, network)
	}
}

async function main() {
	const clientEnv = await ClientEnv.newFromEnvVars();
	activeClients.push(clientEnv.client);
	console.log(`chainID: ${clientEnv.chainId} wallet: ${clientEnv.account}`)
	const network = readArtifact(clientEnv.chainId)
	console.log('network:', network)

	if (!network.tokenAddress) {
		throw new Error("Token address is not set, create CRWN token first")
	}

	if (!network.factoryAddress) {
		throw new Error("Factory address is not set, deploy factory first")
	}

	await createPools(clientEnv)
	console.log('FINISH')
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
