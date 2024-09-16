
import {ERC20_FUNC_APPROVE, EvmExecuteInstruction, IBigIntCoin, isValidEvmAddress, nativeDenomSortCompare, SeiChainId, toChecksumAddressEvm} from "@crownfi/sei-utils";
import {ExecuteInstruction, WasmExtension} from "@cosmjs/cosmwasm-stargate";
import {Coin, QueryClient} from "@cosmjs/stargate";
import { assertFactoryTokenSourceMatches, factoryTokenSourceMatches } from "./common.js";
import { Erc20WrapperContract } from "./base/erc_20_wrapper.js";
import { stringToCanonicalAddr } from "@crownfi/sei-js-core";

const knownContractAddresses: {[chainId: string]: string} = {
	"atlantic-2": "sei1p07lrqwadup97zg9snwu9tgcn6mxwl53d8lrgaldy8rsswvra07qe33fgc"
};

export class ERC20TokenWrapper<Q extends QueryClient & WasmExtension> {
	contract: Erc20WrapperContract<Q>;
	constructor(client: Q, contractAddress: string) {
		this.contract = new Erc20WrapperContract(client, contractAddress);
	}
	getFromChainId(chainId: SeiChainId) {
		let contractAddress = knownContractAddresses[chainId];
		if (!contractAddress && typeof localStorage !== "undefined") {
			contractAddress = localStorage.getItem("@crownfi/token-wrapper-sdk/erc20_contract_address/" + chainId) || "";
		}
		if (!contractAddress && typeof window !== "undefined" && "prompt" in window) {
			const result = window.prompt("Erc20WrapperContract address:");
			if (!result) {
				throw new Error("There's no default ERC20TokenWrapper contract address for " + chainId);
			}
			contractAddress = result;
			localStorage.setItem("@crownfi/token-wrapper-sdk/erc20_contract_address/" + chainId, contractAddress);
		}
		if (!contractAddress) {
			throw new Error("There's no default ERC20TokenWrapper contract address for " + chainId);
		}
	}

	/**
	 * Checks if the specified denom starts with "cw20/" followed by a sei1 contract address
	 * @param denom the denom to check
	 * @returns true if the string follows the format `cw20/{contract_address}`, false otherwise.
	 */
	isWrapable(denom: string): boolean {
		return /^erc20\/0x[a-fA-F0-9]{40}$/.test(denom);
	}

	/**
	 * Checks if the denom specified is likely to be minted from this contract.
	 * 
	 * If you wish to definitively check this, check if {@link unwrappedDenomOf} returns a non-null value instead.
	 * 
	 * @param denom the native denom to check
	 * @returns 
	 */
	isWrappedDenom(denom: string): boolean {
		return factoryTokenSourceMatches(
			denom,
			this.contract.address,
			subdenom => /^crwn[A-F0-9]{40}$/.test(subdenom)
		);
	}

	/**
	 * Works like {@link isWrappedDenom} but throws an error if the denom is not likely to come from this contract.
	 * 
	 * @param denom the native denom to check 
	 */
	assertWrappedDenom(denom: string) {
		assertFactoryTokenSourceMatches(
			denom,
			this.contract.address,
			subdenom => /^crwn[A-F0-9]{40}$/.test(subdenom)
		);
	}

	/**
	 * Takes the specified contract address (or denom in `erc20/{contract_address}` format) and returns the denom of the
	 * token this contract would mint in return.
	 * 
	 * @param erc20Addr the contract address or erc20 denom to check
	 * @returns the token factory token this contract would mint when given the specified erc20 token
	 */
	wrappedDenomOf(erc20Addr: string): string {
		if (erc20Addr.startsWith("erc20/")) {
			erc20Addr = erc20Addr.substring("erc20/".length);
		}
		if (!isValidEvmAddress(erc20Addr, true)) {
			throw new Error(erc20Addr + " is not a valid EVM address");
		}
		return `factory/${this.contract.address}/crwn${erc20Addr.substring(2).toUpperCase()}`;
	}

	/**
	 * Gets the ERC20 token address from the wrapped denom
	 * 
	 * This throws an error if the denom specified does not belong to this contract
	 * 
	 * @param wrappedDenom The token factory denom
	 * @returns The ERC20 contract address
	 */
	unwrappedDenomOf(wrappedDenom: string): string {
		this.assertWrappedDenom(wrappedDenom);
		return toChecksumAddressEvm(wrappedDenom.substring(wrappedDenom.length - 4), false);
	}

	/**
	 * Builds the instruction to wrap the CW20 tokens into token factory tokens.
	 * 
	 * @param amount amount of tokens to wrap
	 * @param erc20Addr the contract address or denom in `erc20/{contract_address}` to wrap
	 * @param recipient who to send the resulting wrapped tokens to, defaults to the sender.
	 * @returns the execute instructions to wrap the token
	 */
	buildWrapIxs(
		amount: number | bigint | string,
		erc20Addr: string,
		senderEvmAddr: string,
		recipient?: string
	): [EvmExecuteInstruction, ExecuteInstruction] {
		if (erc20Addr.startsWith("erc20/")) {
			erc20Addr = erc20Addr.substring("erc20/".length);
		}
		return [
			{
				contractAddress: erc20Addr,
				evmMsg: {
					function: ERC20_FUNC_APPROVE,
					params: [
						"0x" + Buffer.from(stringToCanonicalAddr(this.contract.address)).subarray(12).toString("hex"),
						amount
					],
				},
			},
			this.contract.buildWrapIx({
				amount: amount + "",
				token_addr: erc20Addr,
				evm_sender: Buffer.from(senderEvmAddr.substring(2), "hex").toString("base64"),
				recipient
			})
		];
	}

	/**
	 * Builds the instruction to unwrap the token factory tokens minted by this contract back into CW20 tokens.
	 * 
	 * @param wrappedTokens the coins to unwrap, they must be associated with this contract or this function throws an error
	 * @param recipientEvmAddr who to send the resulting unwrapped tokens to
	 * @returns the execute instructions to unwrap the token
	 */
	buildUnwrapIx(
		wrappedTokens: (Coin | IBigIntCoin)[],
		recipientEvmAddr: string
	): ExecuteInstruction {
		const funds = wrappedTokens.map(wrappedToken => {
			this.assertWrappedDenom(wrappedToken.denom);
			return {
				amount: wrappedToken.amount + "",
				denom: wrappedToken.denom
			};
		});
		funds.sort(nativeDenomSortCompare);
		return this.contract.buildUnwrapIx({
			evm_recipient: Buffer.from(recipientEvmAddr.substring(2), "hex").toString("base64")
		}, funds);
	}

	/**
	 * Builds the unwrap instruction without checking if the coins to be sent match this contract.
	 * 
	 * @param recipient who to send the resulting unwrapped tokens to, defaults to the sender.
	 * @returns the execute instructions to unwrap the token. Note that the `funds` property will be sent to an empty
	 * array, which is invalid.
	 */
	buildUnwrapIxUnchecked(
		recipientEvmAddr: string
	): ExecuteInstruction {
		return this.contract.buildUnwrapIx({
			evm_recipient: Buffer.from(recipientEvmAddr.substring(2), "hex").toString("base64")
		});
	}
}
