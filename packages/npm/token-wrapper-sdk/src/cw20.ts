import { ExecuteInstruction } from "@cosmjs/cosmwasm-stargate";
import { Coin } from "@cosmjs/stargate";
import sei from "@crownfi/sei-js-core";
import base32 from "hi-base32"

import { Cw20WrapperContract } from "./base/cw_20_wrapper"
import { CW20WrapperExecMsg, Nullable_Addr } from "./base/types"
import { SigningClient, Amount } from "./common";

export class CW20TokenWrapper extends Cw20WrapperContract {
	constructor(client: SigningClient, contract_address: string) {
		super(client["forceGetQueryClient"](), contract_address)
	}

	native_denom = (addr: string): string =>
		`factory/${this.address}/${base32.encode(sei.stringToCanonicalAddr(addr), true).substring(0, 44).toLowerCase()}`;

	cw20_address = (native_denom: string): Promise<Nullable_Addr> =>
		this.queryUnwrappedAddrOf({ denom: native_denom })

	wrap(amount: Amount, token_contract: string, sender: string, recipient?: string): ExecuteInstruction {
		const r = recipient ?? sender
		const acc_canonical_addr = sei.stringToCanonicalAddr(r)

		return this.executeIxCw20(Buffer.from(acc_canonical_addr), token_contract, amount)
	}

	unwrap = (tokens: Coin[]): ExecuteInstruction =>
		({ contractAddress: this.address, msg: { unwrap: {} } satisfies CW20WrapperExecMsg, funds: tokens })
}
