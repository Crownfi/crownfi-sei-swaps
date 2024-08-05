import { ExecuteInstruction, WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { Coin, QueryClient } from "@cosmjs/stargate";
import * as sei from "@crownfi/sei-js-core";
import base32 from "hi-base32";

import { Cw20WrapperContract } from "./base/cw_20_wrapper.js";
import { CW20WrapperExecMsg, Nullable_Addr } from "./base/types.js";
import { SigningClient, Amount, validate_native_denom_factory, check_native_denom_factory } from "./common.js";

export class CW20TokenWrapper<Q extends QueryClient & WasmExtension> extends Cw20WrapperContract<Q> {
	constructor(client: Q, contract_address: string) {
		super(client, contract_address);
	}

	native_denom = (addr: string): string =>
		`factory/${this.address}/${base32
			.encode(sei.stringToCanonicalAddr(addr), true)
			.substring(0, 44)
			.toLowerCase()}`;

	validate_native_denom = validate_native_denom_factory(this.address);

	check_native_denom = check_native_denom_factory(this.address);

	real_address = (native_denom: string): Promise<Nullable_Addr> => {
		this.validate_native_denom(native_denom);
		return this.queryUnwrappedAddrOf({ denom: native_denom });
	};

	wrap(amount: Amount, token_contract: string, sender: string, recipient?: string): ExecuteInstruction {
		const r = recipient ?? sender;
		const acc_canonical_addr = sei.stringToCanonicalAddr(r);

		return this.executeIxCw20(Buffer.from(acc_canonical_addr), token_contract, amount);
	}

	unwrap_unchecked = (tokens: Coin[]): ExecuteInstruction => ({
		contractAddress: this.address,
		msg: { unwrap: {} } satisfies CW20WrapperExecMsg,
		funds: tokens,
	});

	unwrap(tokens: Coin[]) {
		if (tokens.length === 0) throw new Error("Empty set of tokens being sent to contract.");
		tokens.forEach((x) => this.validate_native_denom(x.denom));
		return this.unwrap_unchecked(tokens);
	}
}
