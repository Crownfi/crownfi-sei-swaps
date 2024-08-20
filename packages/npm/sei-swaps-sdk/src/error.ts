export class InvalidDenomError extends Error {
	name!: "InvalidDenomError";
	invalidDenom: string;
	validDenoms: readonly string[];
	constructor(invalidDenom: string, validDenoms: string[]) {
		if (validDenoms.length > 1) {
			super(`Invalid denom ${invalidDenom} must be one of: ${validDenoms.join(", ")}`);
		} else if (!validDenoms.length) {
			super(`Denom ${invalidDenom} was passed where no denoms where expected`);
		} else {
			super(`Denom ${invalidDenom} was passed where ${validDenoms[0]} was expected`);
		}
		this.invalidDenom = invalidDenom;
		this.validDenoms = validDenoms;
	}
}
InvalidDenomError.prototype.name = "InvalidDenomError";
