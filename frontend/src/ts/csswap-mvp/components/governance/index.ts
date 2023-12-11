
import { QueryMsg as FactoryContractQueryMsg } from "../../contract_schema/factory/query";
import { FeeInfoResponse as FactoryContractFeeInfoResponse } from "../../contract_schema/factory/responses/fee_info"

import { getAppChainConfig } from "../../chain_config";
import { errorDialogIfRejected } from "../../util";
import { ClientEnv, getSelectedChain } from "../../wallet-env";
import { GovernanceComponentAutogen } from "./_autogen";

const knownPairTypes = [
	{xyk: {}} // ,
	// {stable: {}}
] as const;

export class GovernanceComponentElement extends GovernanceComponentAutogen {
	constructor() {
		super();
		this.refs.log.style.width = "600px";
		this.refs.log.style.height = "400px";
		this.doStuff();
	}
	doStuff() {
		errorDialogIfRejected(async () => {
			const client = await ClientEnv.get();
			const appConfig = getAppChainConfig(getSelectedChain());
			this.log("Using factory", appConfig.factoryAddress);
			
			const governanceFeeContracts = new Set();
			for (const pair_type of knownPairTypes) {
				const queryResponse = await client.queryContract(
					appConfig.factoryAddress,
					{
						fee_info: {
							pair_type
						}
					} satisfies FactoryContractQueryMsg
				) as FactoryContractFeeInfoResponse;
				this.log("Pair type of " + JSON.stringify(pair_type) + " has fee address " + queryResponse.fee_address);
				if (queryResponse.fee_address) {
					governanceFeeContracts.add(queryResponse.fee_address);
				}
				
				
			}
		});
	}
	log(...stuffs: any[]) {
		this.refs.log.value += stuffs.join(" ") + "\n"
	}
}
GovernanceComponentElement.registerElement();
