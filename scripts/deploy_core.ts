import "dotenv/config"
import {
	ARTIFACTS_PATH,
	writeArtifact,
	readArtifact,
	toEncodedBinary,
	ClientEnv,
} from "./helpers.js"
import * as path from "path"
import { chainConfigs } from "./types.d/chain_configs.js";
import { strictEqual } from "assert";

const SECONDS_IN_DAY: number = 60 * 60 * 24 // min, hour, day

async function main() {
	const wallet = await ClientEnv.newFromEnvVars();
	console.log(`chainID: ${wallet.chainId} wallet: ${wallet.account.address}`)

	if (!chainConfigs.generalInfo.multisig) {
		// What does this do?
		throw new Error("Set the proper owner multisig for the contracts")
	}

	await uploadAndInitToken(wallet)
	// await uploadAndInitTreasury(wallet)
	await uploadPairContracts(wallet)
	// await uploadAndInitStaking(wallet)
	await uploadAndInitFactory(wallet)
	// await uploadAndInitRouter(wallet)
	await uploadAndInitMaker(wallet)

	// await uploadAndInitVesting(wallet)
	// await uploadAndInitGenerator(wallet)
	// await setupVestingAccounts(wallet)
}

async function uploadAndInitToken(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)

	if (!network.tokenCodeID) {
		network.tokenCodeID = await clientEnv.uploadContract(path.join(ARTIFACTS_PATH, 'astroport_token.wasm')!)
		writeArtifact(network, clientEnv.chainId)
		console.log(`Token codeId: ${network.tokenCodeID}`)
	}

	if (!network.tokenAddress) {
		chainConfigs.token.admin ||= chainConfigs.generalInfo.multisig
		chainConfigs.token.initMsg.marketing.marketing ||= chainConfigs.generalInfo.multisig

		for (let i = 0; i < chainConfigs.token.initMsg.initial_balances.length; i++) {
			chainConfigs.token.initMsg.initial_balances[i].address ||= chainConfigs.generalInfo.multisig
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

	if (!network.pairStableCodeID) {
		console.log('Register Stable Pair Contract...')
		network.pairStableCodeID = await clientEnv.uploadContract(path.join(ARTIFACTS_PATH, 'astroport_pair_stable.wasm')!)
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
		chainConfigs.staking.initMsg.marketing.marketing ||= chainConfigs.generalInfo.multisig
		chainConfigs.staking.initMsg.owner ||= chainConfigs.generalInfo.multisig
		chainConfigs.staking.admin ||= chainConfigs.generalInfo.multisig

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
		chainConfigs.factory.admin ||= chainConfigs.generalInfo.multisig;

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
		chainConfigs.router.admin ||= chainConfigs.generalInfo.multisig;

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
}

async function uploadAndInitMaker(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)

	if (!network.makerAddress) {
		chainConfigs.maker.initMsg.owner ||= chainConfigs.generalInfo.multisig;
		chainConfigs.maker.initMsg.factory_contract ||= network.factoryAddress;
		chainConfigs.maker.initMsg.staking_contract ||= network.stakingAddress;
		chainConfigs.maker.initMsg.astro_token ||= {
			token: {
				contract_addr: network.tokenAddress
			}
		};
		chainConfigs.maker.admin ||= chainConfigs.generalInfo.multisig;

		console.log('Deploying Maker...')
		let resp = await clientEnv.deployContract(
			chainConfigs.maker.admin,
			path.join(ARTIFACTS_PATH, 'astroport_maker.wasm'),
			chainConfigs.maker.initMsg,
			chainConfigs.maker.label
		)

		// @ts-ignore
		network.makerAddress = resp.shift().shift()
		console.log(`Maker Contract Address: ${network.makerAddress}`)
		writeArtifact(network, clientEnv.chainId)

		// Set maker address in factory
		console.log('Set the Maker and the proper owner address in the factory')
		await clientEnv.executeContract(network.factoryAddress, {
			"update_config": {
				fee_address: network.makerAddress
			}
		})
	}
}

async function uploadAndInitTreasury(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)

	if (!network.whitelistCodeID) {
		console.log('Register Treasury Contract...')
		network.whitelistCodeID = await clientEnv.uploadContract(path.join(ARTIFACTS_PATH, 'astroport_whitelist.wasm')!)
		writeArtifact(network, clientEnv.chainId)
	}

	if (!network.treasuryAddress) {
		chainConfigs.treasury.admin ||= chainConfigs.generalInfo.multisig;
		chainConfigs.treasury.initMsg.admins[0] ||= chainConfigs.generalInfo.multisig;

		console.log('Instantiate the Treasury...')
		let resp = await clientEnv.instantiateContract(
			chainConfigs.treasury.admin,
			network.whitelistCodeID,
			chainConfigs.treasury.initMsg,
			chainConfigs.treasury.label,
		);

		// @ts-ignore
		network.treasuryAddress = resp.shift().shift()
		console.log(`Treasury Contract Address: ${network.treasuryAddress}`)
		writeArtifact(network, clientEnv.chainId)
	}
}

async function uploadAndInitVesting(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)

	if (!network.vestingAddress) {
		chainConfigs.vesting.initMsg.vesting_token ||= { token: { contract_addr: network.tokenAddress } };
		chainConfigs.vesting.initMsg.owner ||= chainConfigs.generalInfo.multisig;
		chainConfigs.vesting.admin ||= chainConfigs.generalInfo.multisig;

		console.log('Deploying Vesting...')
		let resp = await clientEnv.deployContract(
			chainConfigs.vesting.admin,
			path.join(ARTIFACTS_PATH, 'astroport_vesting.wasm'),
			chainConfigs.vesting.initMsg,
			chainConfigs.vesting.label
		)

		// @ts-ignore
		network.vestingAddress = resp.shift().shift()
		console.log(`Vesting Contract Address: ${network.vestingAddress}`)
		writeArtifact(network, clientEnv.chainId)
	}
}

async function uploadAndInitGenerator(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)

	if (!network.generatorAddress) {
		chainConfigs.generator.initMsg.astro_token ||= { token: { contract_addr: network.tokenAddress } };
		chainConfigs.generator.initMsg.vesting_contract ||= network.vestingAddress;
		chainConfigs.generator.initMsg.factory ||= network.factoryAddress;
		chainConfigs.generator.initMsg.whitelist_code_id ||= network.whitelistCodeID;
		chainConfigs.generator.initMsg.owner ||= clientEnv.account.address;
		chainConfigs.generator.admin ||= chainConfigs.generalInfo.multisig;

		console.log('Deploying Generator...')
		let resp = await clientEnv.deployContract(
			chainConfigs.generator.admin,
			path.join(ARTIFACTS_PATH, 'astroport_generator.wasm'),
			chainConfigs.generator.initMsg,
			chainConfigs.generator.label
		)

		// @ts-ignore
		network.generatorAddress = resp.shift().shift()
		console.log(`Generator Contract Address: ${network.generatorAddress}`)

		writeArtifact(network, clientEnv.chainId)

		// Set generator address in factory
		await clientEnv.executeContract(network.factoryAddress, {
			update_config: {
				generator_address: network.generatorAddress,
			}
		})

		// Set new owner for generator
		if (chainConfigs.generator.change_owner) {
			console.log(
				'Propose owner for generator. Ownership has to be claimed within %s days',
				Number(chainConfigs.generator.proposeNewOwner.expires_in) / SECONDS_IN_DAY
			)
			await clientEnv.executeContract(
				network.generatorAddress,
				{
					"propose_new_owner": chainConfigs.generator.proposeNewOwner
				}
			)
		}

		console.log(await clientEnv.queryContract(network.factoryAddress, { config: {} }))
	}
}

async function setupVestingAccounts(clientEnv: ClientEnv) {
	let network = readArtifact(clientEnv.chainId)

	if (!network.vestingAddress) {
		throw new Error("Please deploy the vesting contract")
	}

	if (!network.vestingAccountsRegistered) {
		chainConfigs.vesting.registration.msg.register_vesting_accounts.vesting_accounts[0].address = network.generatorAddress;
		console.log('Register vesting accounts:', JSON.stringify(chainConfigs.vesting.registration.msg))
		await clientEnv.executeContract(network.tokenAddress, {
			"send": {
				contract: network.vestingAddress,
				amount: chainConfigs.vesting.registration.amount,
				msg: toEncodedBinary(chainConfigs.vesting.registration.msg)
			}
		})
		network.vestingAccountsRegistered = true
		writeArtifact(network, clientEnv.chainId)
	}

}

await main()
