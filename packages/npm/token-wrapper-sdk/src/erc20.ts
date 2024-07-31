import { ExecuteInstruction, WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { Coin, QueryClient } from "@cosmjs/stargate";
import * as sei from "@crownfi/sei-js-core";
import * as seiutils from "@crownfi/sei-utils";
import { EvmExecuteInstruction } from "@crownfi/sei-utils";

import { ERC20WrapperExecMsg } from "./base/types.js";
import { Erc20WrapperContract } from "./base/erc_20_wrapper.js";
import { Amount, SigningClient, check_native_denom_factory, validate_native_denom_factory } from "./common.js";

export class ERC20TokenWrapper<Q extends QueryClient & WasmExtension> extends Erc20WrapperContract<Q> {
	constructor(client: Q, contract_address: string) {
		super(client, contract_address);
	}

	private assert_evm_addr(values: Record<any, string>) {
		for (const entry in values)
			if (!seiutils.isValidEvmAddress(values[entry]))
				throw new Error(`Invalid EVM address for ${entry}: ${values[entry]}.`);
	}

	native_denom = (addr: string): string => `factory/${this.address}/crwn${addr.replace("0x", "").toUpperCase()}`;

	validate_native_denom = validate_native_denom_factory(this.address);

	check_native_denom = check_native_denom_factory(this.address);

	real_address(native_denom: string): string {
		this.validate_native_denom(native_denom);
		const response = "0x" + native_denom.substring(native_denom.length - 40);
		this.assert_evm_addr({ response });
		return response;
	}

	wrap(
		amount: Amount,
		contract: string,
		sender: string,
		recipient?: string
	): [EvmExecuteInstruction, ExecuteInstruction] {
		this.assert_evm_addr({ contract, sender });

		const approve_instruction: EvmExecuteInstruction = {
			contractAddress: contract,
			evmMsg: {
				function: seiutils.ERC20_FUNC_APPROVE,
				params: [sei.stringToCanonicalAddr(this.address).fill(0, 0, 12), amount],
			},
		};

		const wrap_instruction = {
			contractAddress: this.address,
			msg: {
				wrap: {
					amount: String(amount),
					token_addr: contract,
					evm_sender: sender,
					recipient,
				},
			} satisfies ERC20WrapperExecMsg,
		};

		return [approve_instruction, wrap_instruction];
	}

	unwrap_unchecked = (tokens: Coin[], recipient: string): ExecuteInstruction => ({
		contractAddress: this.address,
		msg: {
			unwrap: { evm_recipient: recipient },
		} satisfies ERC20WrapperExecMsg,
		funds: tokens,
	});

	unwrap(tokens: Coin[], recipient: string) {
		if (tokens.length === 0) throw new Error("Empty set of tokens being sent to contract.");
		tokens.forEach((tkn) => this.validate_native_denom(tkn.denom));
		this.assert_evm_addr({ recipient });
	}
}
