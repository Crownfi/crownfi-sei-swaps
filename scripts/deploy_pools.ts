import 'dotenv/config'
import {
	writeArtifact,
	readArtifact,
	toEncodedBinary,
	ARTIFACTS_PATH,
	ClientEnv,
} from './helpers.js'
import { join } from 'path'
import { chainConfigs } from "./types.d/chain_configs.js";
import { Pair } from './types.d/astroport_deploy_interfaces.js';

async function uploadAndInitOracle(clientEnv: ClientEnv, pair: Pair, network: any, pool_pair_key: string) {
	let pool_oracle_key = "oracle" + pair.identifier

	if (pair.initOracle && network[pool_pair_key] && !network[pool_oracle_key]) {
		chainConfigs.oracle.admin ||= chainConfigs.generalInfo.defaultAdmin
		chainConfigs.oracle.initMsg.factory_contract ||= network.factoryAddress
		chainConfigs.oracle.initMsg.asset_infos ||= pair.assetInfos

		console.log(`Deploying oracle for ${pair.identifier}...`)
		let resp = await clientEnv.deployContract(
			chainConfigs.oracle.admin,
			join(ARTIFACTS_PATH, 'astroport_oracle.wasm'),
			chainConfigs.oracle.initMsg,
			chainConfigs.oracle.label)

		// @ts-ignore
		network[pool_oracle_key] = resp.shift().shift();
		console.log(`Address of ${pair.identifier} oracle contract: ${network[pool_oracle_key]}`)
		writeArtifact(network, clientEnv.chainId)
	}
}

async function createPools(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)
	let pairs = chainConfigs.createPairs.pairs;
	let pools: string[][] = [];

	for (let i = 0; i < pairs.length; i++) {
		let pair = pairs[i]
		let pool_pair_key = "pool" + pair.identifier
		let pool_lp_token_key = "lpToken" + pair.identifier

		// Create pool
		if (!network[pool_pair_key]) {
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

			network[pool_pair_key] = res.logs[0].events.filter(el => el.type == 'wasm').map(x => x.attributes.filter(el => el.key === "pair_contract_addr").map(x => x.value))[0][0]
			let pool_info = await clientEnv.queryContract(network[pool_pair_key], {
				pair: {}
			})

			// write liquidity token
			network[pool_lp_token_key] = pool_info.liquidity_token
			console.log(`Pair successfully created! Address: ${network[pool_pair_key]}`)
			writeArtifact(network, clientEnv.chainId)

			if (pair.initGenerator) {
				pools.push([pool_info.liquidity_token, pair.initGenerator.generatorAllocPoint])
			}
		}

		// Deploy oracle
		await uploadAndInitOracle(clientEnv, pair, network, pool_pair_key)
	}

	await setupPools(clientEnv, pools)
}

async function setupPools(clientEnv: ClientEnv, pools: string[][]) {
	const network = readArtifact(clientEnv.chainId)

	if (!network.generatorAddress) {
		throw new Error("Please deploy the generator contract")
	}

	if (pools.length > 0) {
		let active_pool_length = await clientEnv.queryContract(network.generatorAddress, { active_pool_length: {} })
		if (active_pool_length == 0) {
			console.log("Setup pools for the generator...")
			await clientEnv.executeContract(network.generatorAddress, {
				setup_pools: {
					pools: pools
				}
			})
		} else {
			console.log("You are cannot setup new pools because the generator has %s active pools already.", active_pool_length)
		}
	}
}

async function main() {
	const clientEnv = await ClientEnv.newFromEnvVars();
	console.log(`chainID: ${clientEnv.chainId} wallet: ${clientEnv.account}`)
	const network = readArtifact(clientEnv.chainId)
	console.log('network:', network)

	if (!network.tokenAddress) {
		throw new Error("Token address is not set, create ASTRO token first")
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
})();
