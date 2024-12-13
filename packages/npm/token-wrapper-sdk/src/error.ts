export class WrapperContractDenomError extends Error {
	name!: "WrapperContractDenomError";
	constructor(
		public denom: string,
		public contractAddress: string,
	) {
		super(`The token ${denom} does not belong to contract ${contractAddress}`);
	}
}
WrapperContractDenomError.prototype.name = "WrapperContractDenomError";
