import { UnifiedDenom, UnifiedDenomPair } from "./types.js";

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

export class MarketPairNotFoundError extends Error {
	name!: "MarketPairNotFoundError";
	pair: UnifiedDenomPair;
	constructor(pair: UnifiedDenomPair) {
		super("The trading pair " + pair.join("<>") + " could not be found")
		this.pair = pair;
	}
}
MarketPairNotFoundError.prototype.name = "MarketPairNotFoundError";

export class UnsatisfiableSwapRouteError extends Error {
	name!: "UnsatisfiableSwapRouteError";
	constructor(
		public from: UnifiedDenom,
		public to: UnifiedDenom
	) {
		super("The swap market has no means to trade between " + from + " and " + to);
	}
}
