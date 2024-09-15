import { ExecuteInstruction } from "@cosmjs/cosmwasm-stargate";
import {
	PoolPairContract,
	PoolFactoryContract,
	Uint128,
	SwapRouterContract,
	SwapRouterSimulateSwapsResponse,
	PoolPairCalcSwapResult,
	PoolPairCalcNaiveSwapResult,
	SwapRouterExpectation,
	SwapReceiver,
} from "./index.js";
import { Addr, BigIntCoin, IBigIntCoin, getUserTokenInfo, SeiClientAccountData, EvmExecuteInstruction } from "@crownfi/sei-utils";

import { AddrWithPayload, UnifiedDenom, UnifiedDenomPair, matchTokenKind } from "./types.js";
import { Coin, coin } from "@cosmjs/amino";
import { bigIntMin } from "math-bigint";

import { WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { QueryClient } from "@cosmjs/stargate";
import { InvalidDenomError, MarketPairNotFoundError, UnsatisfiableSwapRouteError } from "./error.js";
import { MultiTokenWrapper } from "@crownfi/token-wrapper-sdk";

// Copypasta'd from stackvoerflow
// https://stackoverflow.com/questions/9383593/extracting-the-exponent-and-mantissa-of-a-javascript-number/78431217#78431217
function getNumberParts(x: number) {
	const asDouble = new Float64Array(1);
	const asBytes = new Uint8Array(asDouble.buffer);

	asDouble[0] = x;

	const sign = asBytes[7] >> 7;
	const exponent = ((asBytes[7] & 0x7f) << 4 | asBytes[6] >> 4);

	asBytes[7] = 0x43;
	asBytes[6] &= 0x0f;
	asBytes[6] |= 0x30;

	return {
		negative: Boolean(sign),
		exponent: BigInt(exponent - 1023),
		mantissa: BigInt(asDouble[0]) - 2n ** 52n
	};
}
function bigIntMulNumber(input: bigint, num: number) {
	const {
		negative,
		exponent,
		mantissa
	} = getNumberParts(num);
	return ((input * (0x10000000000000n + mantissa)) << (exponent - 52n)) * (negative ? -1n : 1n);
}
function normalizePayloadCoin(amount: string | bigint | Coin | IBigIntCoin, fallbackDenom: string): Coin {
	return (typeof amount == "object" ? new BigIntCoin(amount) : new BigIntCoin(amount, fallbackDenom)).intoCosmCoin();
}
function assertValidDenom(amount: string | bigint | Coin | IBigIntCoin, ...validDenoms: string[]) {
	if (typeof amount == "object" && validDenoms.indexOf(amount.denom) === -1) {
		throw new InvalidDenomError(amount.denom, validDenoms);
	}
}

export type SwapMarketAssetVolumeResult = {
	/** The trade volume of each individual asset */
	coins: Coin[],
	/** The earliest data point used to calculate the volume. This may be less than what was requested. */
	from: Date,
	/** The latest data point used to calculate the volume.  */
	to: Date
}
export type SwapMarketNormalizedVolumeResult = {
	/** Volume normalized to the currency requested */
	amount: bigint,
	/** The earliest data point used to calculate the volume. This may be less than what was requested. */
	from: Date,
	/** The latest data point used to calculate the volume. */
	to: Date
}
export type SwapMarketMultiNormalizedVolumeResult = {
	/** The volume of each pair normalized to the currency requested */
	pairVolumes: {pair: UnifiedDenomPair, amount: bigint}[]
	/** Total volume normalized to the currency requested */
	totalVolume: bigint,
	/** The earliest data point used to calculate the volume. This may be less than what was requested. */
	from: Date,
	/** The latest data point used to calculate the volume. */
	to: Date
}
export type SwapMarketExchangeRateResult = {
	/**
	 * The highest exchange ratio for the returned time period.
	 * 
	 * The contract stores this in a lossy format, and is more accurate as the exchange ratio approaches 1:1.
	 * Ratios beyond approx. 2000000000:1 are will be shown as 0 or Infinity.
	 * 
	 * Rough accuracy guide:
	 * - near 1:1 - 10 significant digits
	 * - 1:1 to 10:1 - 9 significant digits
	 * - 10:1 to 100:1 - 8 significant digits
	 * - 100:1 to 1000:1 - 7 significant digits
	 * - 1000:1 to 10000:1 - 6 significant digits
	 * - 10000:1 to 100000:1 - 5 significant digits
	 * - ...
	 * - 10000000:1 to 100000000:1 - 2 significant digits
	 */
	rateHigh: number,
	/** Average exchange rate for the returned time period. This should be as accurate as an f64 can be. */
	rateAverage: number,
	/**
	 * The lowest exchange ratio for the returned time period.
	 * 
	 * The contract stores this in a lossy format, and is more accurate as the exchange ratio approaches 1:1.
	 * Ratios beyond approx. 2000000000:1 are will be shown as 0 or Infinity.
	 * 
	 * Rough accuracy guide:
	 * - near 1:1 - 10 significant digits
	 * - 1:1 to 10:1 - 9 significant digits
	 * - 10:1 to 100:1 - 8 significant digits
	 * - 100:1 to 1000:1 - 7 significant digits
	 * - 1000:1 to 10000:1 - 6 significant digits
	 * - 10000:1 to 100000:1 - 5 significant digits
	 * - ...
	 * - 10000000:1 to 100000000:1 - 2 significant digits
	 */
	rateLow: number,
	/** The earliest data point used to calculate the min/max/avg exchange rates. */
	from: Date,
	/** The latest data point used to calculate the min/max/avg exchange rates. */
	to: Date
}
export type SwapMarketDepositCalcResult = {
	newShares: bigint;
	newShareValue: [[bigint, UnifiedDenom], [bigint, UnifiedDenom]];
};

export enum SwapMarketPairMatch {
	/** The denoms provided do not match with the {@link SwapMarketPair.assets | SwapMarketPair's assets property} */
	Unmatched = 0,
	/** 
	 * The denoms provided match with {@link SwapMarketPair.assets | SwapMarketPair's assets property} in the order
	 * provided.
	 */
	Match = 1,
	/** 
	 * The denoms provided match with {@link SwapMarketPair.assets | SwapMarketPair's assets property} in the opposite
	 * order compared to what was provided.
	 */
	InverseMatch = 2
}

export class SwapMarketPair<Q extends QueryClient & WasmExtension = QueryClient & WasmExtension> {
	/** Name of the pair (Stable for 1.0) */
	readonly name: string;
	/** The assets in the pair (Stable for 1.0) */
	readonly assets: UnifiedDenomPair;
	/** The shares denom */
	readonly sharesDenom: UnifiedDenom;
	/** The assets in the pair, in lexicographical order */
	readonly canonAssets: UnifiedDenomPair;
	/** The assets in the pair, normalized to their unwrapped form */
	readonly unwrappedAssets: UnifiedDenomPair;

	#validAssets: UnifiedDenom[]

	/** Maker fee in basis points. 10000‱ = 100% (Stable for 1.0) */
	get makerFeeBasisPoints() {
		return this.#makerFeeBasisPoints;
	}
	#makerFeeBasisPoints: number;
	/** Pool fee in basis points. 10000‱ = 100% (Stable for 1.0) */
	get poolFeeBasisPoints() {
		return this.#poolFeeBasisPoints;
	}
	#poolFeeBasisPoints: number;
	/** The denom of the shares */
	// get sharesDenom() {
	// 	return this.#sharesDenom;
	// }
	// #sharesDenom: UnifiedDenom;
	/** The denom of the shares */
	get totalShares() {
		return this.#totalShares;
	}
	#totalShares: bigint;
	/** Total fee. (Stable for 1.0) */
	get totalFeeBasisPoints() {
		return this.makerFeeBasisPoints + this.poolFeeBasisPoints;
	}

	// #pairKind: [TknKind, TknKind]
	// #astroPairType: AstroPairType
	protected constructor(
		public readonly contract: PoolPairContract<Q>,
		/** The amount of tokens deposited in the pool, maps with the `assets` property (Stable for 1.0) */
		public readonly totalDeposits: [bigint, bigint],
		makerFeeBasisPoints: number,
		poolFeeBasisPoints: number,
		// factoryConfig: PoolFactoryConfigJsonable,
		// pairInfo: UnifiedDenomPair,
		poolInfo: { assets: UnifiedDenomPair; totalShares: Uint128; unwrappedAssets: UnifiedDenomPair },
		public tokenWrapper: MultiTokenWrapper<Q>
	) {
		// this.totalDeposits = totalDeposits
		this.assets = poolInfo.assets;
		this.unwrappedAssets = poolInfo.unwrappedAssets;
		this.#poolFeeBasisPoints = poolFeeBasisPoints;
		this.#makerFeeBasisPoints = makerFeeBasisPoints;
		this.#totalShares = BigInt(poolInfo.totalShares);
		this.name = this.assets.map((denom) => getUserTokenInfo(denom).symbol).join("-");
		this.sharesDenom = "factory/" + contract.address + "/lp";
		this.canonAssets = [...poolInfo.assets].sort() as UnifiedDenomPair;
		this.#validAssets = [
			...poolInfo.assets
		];
		if (this.assets[0] != this.unwrappedAssets[0]) {
			this.#validAssets.push(this.unwrappedAssets[0]);
		}
		if (this.assets[1] != this.unwrappedAssets[1]) {
			this.#validAssets.push(this.unwrappedAssets[1]);
		}
		Object.freeze(this.assets);
		Object.freeze(this.canonAssets);

		// this.totalDeposits = poolInfo.assets.map((asset) => BigInt(asset)) as [bigint, bigint];

		// this.#astroPairType = pairInfo.pair_type;
		// this.#sharesDenom = "cw20/" + pairInfo.liquidity_token;
		// this.#totalShares = BigInt(poolInfo.total_share);
		// const factoryPairConfig = factoryConfig.pair_configs.find((v) => {
		// 	// Ugh, the "single property with empty object" convention for rust handling Rust enums sucks.
		// 	// Can't wait until we migrate away from astroport-derived contracts...
		// 	return JSON.stringify(v.pair_type) == JSON.stringify(this.#astroPairType);
		// });
		// if (factoryPairConfig === undefined) {
		// 	// Some assertion
		// 	throw new Error(
		// 		"Couln't find factoryPairConfig " +
		// 		JSON.stringify(this.#astroPairType) +
		// 		" in " +
		// 		JSON.stringify(factoryConfig.pair_configs)
		// 	);
		// }

		// this.#makerFeeBasisPoints = factoryConfig.default_maker_fee_bps;
		// this.#poolFeeBasisPoints = factoryConfig.default_total_fee_bps - factoryConfig.default_maker_fee_bps;
	}

	static async create<Q extends QueryClient & WasmExtension>(
		endpoint: Q,
		pairAddress: string,
		tokenWrapper: MultiTokenWrapper<Q>
	) {
		const pairContract = new PoolPairContract(endpoint, pairAddress);

		const [
			config,
			totalShares,
			poolAssets,
		] = await Promise.all([
			pairContract.queryConfig(),
			pairContract.queryTotalShares(),
			pairContract.queryPairDenoms(),
		]);
		const unwrappedAssets = tokenWrapper == undefined ? poolAssets : await Promise.all([
			tokenWrapper.normalizeToUnwrappedDenom(poolAssets[0]),
			tokenWrapper.normalizeToUnwrappedDenom(poolAssets[1])
		]);

		const totalDeposits = await pairContract.queryShareValue({ amount: totalShares });
		const poolFeeBasisPoints = config.total_fee_bps - config.maker_fee_bps;

		return new SwapMarketPair(
			pairContract,
			[ BigInt(totalDeposits[0].amount), BigInt(totalDeposits[1].amount) ],
			config.maker_fee_bps,
			poolFeeBasisPoints,
			{ assets: poolAssets, totalShares, unwrappedAssets },
			tokenWrapper
		);
	}

	/**
	 * Resolves the promise if the factory contract is compatible with this library.
	 * Otherwise, the promise is rejected with a `ContractVersionNotSatisfiedError`.
	 *
	 * Stable for `1.0`
	 */
	async checkVersion() {
		await this.contract.checkVersion({
			"crownfi-astro-pair": "^0.9",
		});
	}
	/**
	 * Refreshes the pool value, total shares, and fees.
	 *
	 * There is no need to call this function if you call `refresh()` on the `SwapMarket` used to construct this class.
	 *
	 * Stable for `1.0`
	 */
	async refresh() {
		const totalShares = await this.contract.queryTotalShares();
		this.#totalShares = BigInt(totalShares);
		const config = await this.contract.queryConfig();
		this.#makerFeeBasisPoints = config.maker_fee_bps;
		this.#poolFeeBasisPoints = config.total_fee_bps - config.maker_fee_bps;

		const totalDeposits = await this.contract.queryShareValue({ amount: totalShares });
		this.totalDeposits[0] = BigInt(totalDeposits[0].amount);
		this.totalDeposits[1] = BigInt(totalDeposits[1].amount);
	}
	/**
	 * Returns an approximate exchange rate between `this.assets[0]` and `this.assets[1]`.
	 *
	 * Stable for `1.0`
	 *
	 * @param inverse return `assets[1]` -> `assets[0]` rate instead
	 * @returns The approximate exchange rate
	 */
	exchangeRate(inverse?: boolean): number {
		if (inverse) {
			return Number(this.totalDeposits[0]) / Number(this.totalDeposits[1]);
		} else {
			return Number(this.totalDeposits[1]) / Number(this.totalDeposits[0]);
		}
	}

	/**
	 * Performs a "dumb" exchange quote from `assets[0]` to `assets[1]` assuming infinite liquidity and no slippage
	 *
	 * Stable for `1.0`
	 *
	 * @param value input value
	 * @param inverse return `assets[1]` -> `assets[0]` rate instead
	 * @param includeFees subtract swap fees from the input
	 */
	exchangeValue(value: bigint, inverse?: boolean, includeFees?: boolean) {
		if (includeFees) {
			value = (value * (10000n - BigInt(this.totalFeeBasisPoints))) / 10000n;
		}
		if (inverse) {
			return (value * this.totalDeposits[0]) / this.totalDeposits[1];
		} else {
			return (value * this.totalDeposits[1]) / this.totalDeposits[0];
		}
	}

	otherDenom(denom: string, unwrapped?: boolean): string | null {
		if (this.assets[0] == denom || this.unwrappedAssets[0] == denom) {
			return unwrapped ? this.unwrappedAssets[1] : this.assets[1];
		} else if (this.assets[1] == denom || this.unwrappedAssets[1] == denom) {
			return unwrapped ? this.unwrappedAssets[0] : this.assets[0];
		}
		return null;
	}

	/**
	 * Calculates the value of the shares amount specified
	 */
	shareValue(shares: bigint): [[bigint, UnifiedDenom], [bigint, UnifiedDenom]] {
		// TODO: unwrapped?: boolean param to return the unwrapped representation of the denom
		if (this.totalShares == 0n) {
			return [
				[0n, this.assets[0]],
				[0n, this.assets[1]],
			];
		}
		return [
			[(this.totalDeposits[0] * shares) / this.totalShares, this.assets[0]],
			[(this.totalDeposits[1] * shares) / this.totalShares, this.assets[1]],
		];
	}

	/**
	 * Checks of the specified `pair` matches {@link assets | this.assets}.
	 * @param pair The array of denoms to check. This should be a {@link UnifiedDenomPair}.
	 * @returns How the provided `pair` matches with `this.assets`. Will return {@link SwapMarketPairMatch.Unmatched}
	 * if `pair` is not a {@link UnifiedDenomPair}.
	 */
	isPair(pair: UnifiedDenom[]): SwapMarketPairMatch {
		if (pair.length != 2) {
			return SwapMarketPairMatch.Unmatched;
		}
		if (pair[0] == this.assets[0] && pair[1] == this.assets[1]) {
			return SwapMarketPairMatch.Match;
		}
		if (pair[1] == this.assets[0] && pair[0] == this.assets[1]) {
			return SwapMarketPairMatch.InverseMatch;
		}
		return SwapMarketPairMatch.Unmatched;
	}
	buildWrapAndProvideLiquidity(
		sender: SeiClientAccountData,
		receiver: SeiClientAccountData,
		liquidityTokens: [Coin | IBigIntCoin, Coin | IBigIntCoin],
		slippageTolerance: number = 0.01,
	): (EvmExecuteInstruction | ExecuteInstruction)[] {
		const result = [];
		for (const liquidityToken of liquidityTokens) {
			assertValidDenom(liquidityToken.denom, ...this.#validAssets);
			if (this.tokenWrapper.isWrapable(liquidityToken.denom)) {
				result.push(
					...this.tokenWrapper.buildWrapIxs(
						liquidityToken.amount,
						liquidityToken.denom,
						sender,
						sender
					)
				);
			}
		}
		const normalizedLiqTokens = liquidityTokens.map(v => {
			return {
				denom: this.tokenWrapper.normalizeToWrappedDenom(v.denom),
				amount: v.amount
			};
		});
		if (normalizedLiqTokens[0].denom != this.assets[0]) {
			normalizedLiqTokens.reverse();
		}
		result.push(
			...this.buildProvideLiquidityIxs(
				normalizedLiqTokens[0].amount,
				normalizedLiqTokens[1].amount,
				slippageTolerance,
				receiver.seiAddress
			)
		);
		return result;
		// This does assume that wrapped tokens are 1:1
	}
	buildProvideLiquidityIxs(
		token0Amount: string | bigint | Coin | IBigIntCoin,
		token1Amount: string | bigint | Coin | IBigIntCoin,
		slippageTolerance: number = 0.01,
		receiver?: Addr | AddrWithPayload
	): ExecuteInstruction[] {
		const ixs: ExecuteInstruction[] = [];
		// TODO: Unwrapped token variant should be considered valid
		// TODO: If passed denom is unwrapped variant, prepend wrap instructions.
		assertValidDenom(token0Amount, this.assets[0]);
		assertValidDenom(token1Amount, this.assets[1]);
		ixs.push(
			this.contract.buildProvideLiquidityIx({
				slippage_tolerance: slippageTolerance + "",
				receiver: typeof receiver == "string" ? receiver : receiver?.address,
				receiver_payload: typeof receiver == "object" ? receiver?.payload?.toString("base64") : undefined
			}, [
				normalizePayloadCoin(token0Amount, this.assets[0]),
				normalizePayloadCoin(token1Amount, this.assets[1])
			])
		);

		return ixs;
	}

	calculateProvideLiquidity(token0Amount: bigint, token1Amount: bigint): SwapMarketDepositCalcResult {
		if (this.totalDeposits[0] == 0n || this.totalDeposits[1] == 0n) {
			// Honestly, this is an edgecase which isn't worth thinking about in publicly facing pools
			return {
				newShares: 1000n,
				newShareValue: [
					[token0Amount, this.assets[0]],
					[token1Amount, this.assets[1]],
				],
			};
		}
		// The contract calculates the minting of new shares before deposit using this algorithm
		const newShares = bigIntMin(
			(token0Amount * this.totalShares) / this.totalDeposits[0],
			(token1Amount * this.totalShares) / this.totalDeposits[1]
		);
		const totalSharesAfter = this.totalShares + newShares;
		const totalDeposit0After = this.totalDeposits[0] + token0Amount;
		const totalDeposit1After = this.totalDeposits[1] + token1Amount;

		return {
			newShares,
			newShareValue: [
				[(totalDeposit0After * newShares) / totalSharesAfter, this.assets[0]],
				[(totalDeposit1After * newShares) / totalSharesAfter, this.assets[1]],
			],
		};
	}

	buildWithdrawLiquidityIxs(
		shares: bigint,
		receiver?: Addr | AddrWithPayload
	): ExecuteInstruction[] {
		// TODO: Requested denoms param which signals whether or not to append an unwrap instruction
		return [
			this.contract.buildWithdrawLiquidityIx({
				receiver: typeof receiver == "string" ? receiver : receiver?.address,
				receiver_payload: typeof receiver == "object" ? receiver?.payload?.toString("base64") : undefined
			}, [
				coin(shares + "", this.sharesDenom)
			])
		]
	}

	buildWithdrawAndUnwrapLiquidityIxs(
		shares: bigint,
		receiver: SeiClientAccountData
	): ExecuteInstruction[] {
		const leftWrapKind = this.tokenWrapper.wrappedDenomKind(this.assets[0]);
		const rightWrapKind = this.tokenWrapper.wrappedDenomKind(this.assets[1]);
		if (leftWrapKind == rightWrapKind) {
			if (leftWrapKind == 0) {
				return this.buildWithdrawLiquidityIxs(
					shares,
					receiver.seiAddress
				);
			} else {
				const unwrapIx = this.tokenWrapper.buildUnwrapIxsUnchecked(leftWrapKind, receiver);
				return this.buildWithdrawLiquidityIxs(
					shares,
					{
						address: unwrapIx.contractAddress,
						payload: Buffer.from(JSON.stringify(unwrapIx.msg))
					}
				);
			}
		}
		const leftUnwrapIx = leftWrapKind == 0 ?
			undefined :
			this.tokenWrapper.buildUnwrapIxsUnchecked(leftWrapKind, receiver);
		const rightUnwrapIx = rightWrapKind == 0 ?
			undefined :
			this.tokenWrapper.buildUnwrapIxsUnchecked(rightWrapKind, receiver);
		return [
			this.contract.buildWithdrawAndSplitLiquidityIx({
				left_coin_receiver: leftUnwrapIx ? leftUnwrapIx.contractAddress : receiver.seiAddress,
				left_coin_receiver_payload: leftUnwrapIx ? Buffer.from(
					JSON.stringify(leftUnwrapIx.msg)
				).toString("base64") : undefined,
				right_coin_receiver: rightUnwrapIx ? rightUnwrapIx.contractAddress : receiver.seiAddress,
				right_coin_receiver_payload: rightUnwrapIx ? Buffer.from(
					JSON.stringify(rightUnwrapIx.msg)
				).toString("base64") : undefined
			}, [coin(shares + "", this.sharesDenom)])
		];
	}

	/**
	 * Builds the ExecuteInstruction(s) needed to perform the swap.
	 *
	 * Stable for `1.0`
	 *
	 * @param offer The tokens to swap
	 * @param slippageTolerance The contract will throw an error and the transaction will be reverted if the exchange
	 * rate changes by the following amount, defaults to 1% (0.01).
	 * @param receiver If you want the resulting tokens to be sent to an address that differs from the message sender,
	 * specify it here.
	 *
	 * @returns Contract instructions to execute or null if the denom asked isn't available. Note that the specific
	 * instructions generated including the contracts sent to may change in future updates.
	 */
	buildSwapIxs(
		offer: Coin | IBigIntCoin,
		slippageTolerance: number = 0.01,
		receiver?: Addr | AddrWithPayload
	): ExecuteInstruction[] {
		// TODO: If passed denom is unwrapped variant, prepend wrap instructions.
		return [
			this.contract.buildSwapIx(
				{
					receiver: typeof receiver == "string" ? receiver : receiver?.address,
					receiver_payload: typeof receiver == "object" ? receiver?.payload?.toString("base64") : undefined,
					slippage_tolerance: slippageTolerance + "",
				},
				[{amount: offer.amount + "", denom: offer.denom}]
			),
		];
	}

	buildWrapableSwapIxs(
		sender: SeiClientAccountData,
		receiver: SeiClientAccountData,
		offer: Coin | IBigIntCoin,
		unwrapOnReceive: boolean,
		slippageTolerance: number = 0.01,
		expectedResult?: bigint | string | null
	): (EvmExecuteInstruction | ExecuteInstruction)[] {
		assertValidDenom(offer.denom, ...this.#validAssets);
		const result = [];
		if (this.tokenWrapper.isWrapable(offer.denom)) {
			result.push(
				...this.tokenWrapper.buildWrapIxs(
					offer.amount,
					offer.denom,
					sender,
					sender
				)
			);
		}
		const actualOffer = {
				amount: offer.amount + "",
				denom: this.tokenWrapper.normalizeToWrappedDenom(offer.denom)
		};

		const resultWrapKind = this.tokenWrapper.wrappedDenomKind(this.otherDenom(actualOffer.denom, true)!);
		const resultUnwrapIx = (!unwrapOnReceive || resultWrapKind == 0) ?
			undefined :
			this.tokenWrapper.buildUnwrapIxsUnchecked(resultWrapKind, receiver);
		
		result.push(
			this.contract.buildSwapIx(
				{
					receiver: resultUnwrapIx ? resultUnwrapIx.contractAddress : receiver.seiAddress,
					receiver_payload: resultUnwrapIx ? Buffer.from(
						JSON.stringify(resultUnwrapIx.msg)
					).toString("base64") : undefined,
					slippage_tolerance: slippageTolerance + "",
					expected_result: expectedResult == null ? undefined : expectedResult + ""
				},
				[actualOffer]
			),
		);
		return result;
	}

	async simulateSwap(
		offer: Coin | IBigIntCoin
	): Promise<PoolPairCalcSwapResult> {
		// TODO: convert offer to wrapped variant if it is an erc20 or cw20 token.
		return this.contract.querySimulateSwap({
			offer: {amount: offer.amount + "", denom: offer.denom}
		});
	}

	async simulateNaiveSwap(
		offer: Coin | IBigIntCoin
	): Promise<PoolPairCalcNaiveSwapResult> {
		// TODO: convert offer to wrapped variant if it is an erc20 or cw20 token.
		return this.contract.querySimulateNaiveSwap({
			offer: {amount: offer.amount + "", denom: offer.denom}
		});
	}

	/**
	 * @returns the total volume since the first trade happened
	 */
	async assetTradeVolumeAllTime(): Promise<SwapMarketAssetVolumeResult & {coins: [Coin, Coin]}> {
		// The contract query volume functions return the volume of each token in lexicographical order, not marketing
		// order.
		const result = await this.contract.queryTotalVolumeSum();
		// TODO: Convert returned denoms to unwrapped variants if specified
		return {
			coins: result.volume.map((amount, index) => {
				return {amount, denom: this.canonAssets[index]}
			}) as [Coin, Coin],
			from: new Date(result.from_timestamp_ms),
			to: new Date(result.to_timestamp_ms)
		}
	}
	/**
	 * If `hours` is a number greater than 0, this returns the total volume in the past specified hours, updated every
	 * hour (UTC). For example, a value of `12` will get the volume for the previous 12 hours.
	 * 
	 * If 0 or undefined, this will return the trading volume since the UTC hour started.
	 * 
	 * Note that the contract may not store data older than 24 hours.
	 * @param hours how far back to look
	 */
	async assetTradeVolumePastHours(hours?: number): Promise<SwapMarketAssetVolumeResult & {coins: [Coin, Coin]}> {
		const result = await this.contract.queryHourlyVolumeSum({past_hours: hours});
		// TODO: Convert returned denoms to unwrapped variants if specified
		return {
			coins: result.volume.map((amount, index) => {
				return {amount, denom: this.canonAssets[index]}
			}) as [Coin, Coin],
			from: new Date(result.from_timestamp_ms),
			to: new Date(result.to_timestamp_ms)
		}
	}
	/**
	 * If `hours` is a number greater than 0, this returns the total volume in the past specified hours, updated every
	 * hour (UTC). For example, a value of `12` will get the volume for the previous 12 hours.
	 * 
	 * If 0 or undefined, this will return the trading volume since the UTC hour started.
	 * 
	 * Note that the contract may not store data older than 24 hours.
	 * @param days how far back to look
	 */
	async assetTradeVolumePastDays(days?: number): Promise<SwapMarketAssetVolumeResult & {coins: [Coin, Coin]}> {
		const result = await this.contract.queryDailyVolumeSum({past_days: days});
		// TODO: Convert returned denoms to unwrapped variants if specified
		return {
			coins: result.volume.map((amount, index) => {
				return {amount, denom: this.canonAssets[index]}
			}) as [Coin, Coin],
			from: new Date(result.from_timestamp_ms),
			to: new Date(result.to_timestamp_ms)
		}
	}

	/**
	 * @param denom the currency to normalize the volume to, must be on of the denoms supported by the pool.
	 * @returns the total volume since the first trade happened
	 */
	async normalizedTradeVolumeAllTime(
		denom: UnifiedDenom
	): Promise<SwapMarketNormalizedVolumeResult> {
		const result = await this.contract.queryTotalVolumeSum();
		// TODO: convert the provided denom to the wrapped variant if applicable
		// findInverse: -1 = invalid, 0 = false, 1 = true
		const inverse = this.canonAssets.findIndex(supportedDenom => supportedDenom === denom);
		if (inverse == -1) {
			throw new InvalidDenomError(denom, this.canonAssets);
		}
		return {
			// If you convert the average rate of the other token to the one requested, the math simplifies to this.
			amount: BigInt(result.volume[inverse]) * 2n,
			from: new Date(result.from_timestamp_ms),
			to: new Date(result.to_timestamp_ms)
		}
	}

	/**
	 * If `hours` is a number greater than 0, this returns the total volume in the past specified hours, updated every
	 * hour (UTC). For example, a value of `12` will get the volume for the previous 12 hours.
	 * 
	 * If 0 or undefined, this will return the trading volume since the UTC hour started.
	 * 
	 * Note that the contract may not store data older than 24 hours.
	 * @param denom the currency to normalize the volume to, must be on of the denoms supported by the pool.
	 * @param hours how far back to look
	 */
	async normalizedTradeVolumePastHours(
		denom: UnifiedDenom,
		hours?: number
	): Promise<SwapMarketNormalizedVolumeResult> {
		const result = await this.contract.queryHourlyVolumeSum({past_hours: hours});
		// TODO: convert the provided denom to the wrapped variant if applicable
		// findInverse: -1 = invalid, 0 = false, 1 = true
		const inverse = this.canonAssets.findIndex(supportedDenom => supportedDenom === denom);
		if (inverse == -1) {
			throw new InvalidDenomError(denom, this.canonAssets);
		}
		return {
			// If you convert the average rate of the other token to the one requested, the math simplifies to this.
			amount: BigInt(result.volume[inverse]) * 2n,
			from: new Date(result.from_timestamp_ms),
			to: new Date(result.to_timestamp_ms)
		}
	}

	/**
	 * If `days` is a number greater than 0, this returns the total volume in the past specified days, updated every
	 * midnight (UTC). For example, a value of `7` will get the volume for the previous 7 days.
	 * 
	 * If 0 or undefined, this will return the trading volume since midnight (UTC).
	 * 
	 * Note that the contract may not store data older than 30 days.
	 * @param denom the currency to normalize the volume to, must be on of the denoms supported by the pool.
	 * @param days how far back to look
	 */
	async normalizedTradeVolumePastDays(
		denom: UnifiedDenom,
		days?: number
	): Promise<SwapMarketNormalizedVolumeResult> {
		const result = await this.contract.queryDailyVolumeSum({past_days: days});
		// TODO: convert the provided denom to the wrapped variant if applicable
		// findInverse: -1 = invalid, 0 = false, 1 = true
		const inverse = this.canonAssets.findIndex(supportedDenom => supportedDenom === denom);
		if (inverse == -1) {
			throw new InvalidDenomError(denom, this.canonAssets);
		}
		return {
			// If you convert the average rate of the other token to the one requested, the math simplifies to this.
			amount: BigInt(result.volume[inverse]) * 2n,
			from: new Date(result.from_timestamp_ms),
			to: new Date(result.to_timestamp_ms)
		}
	}
}

export type SwapMarketSwapSimResult = SwapRouterSimulateSwapsResponse & {
	swaps: PoolPairCalcSwapResult[];
};

/**
 * Represents the whole swap market.
 * The existance of this class is stable for `1.0`
 *
 * After constructing this class, the `refresh` method must be called once for this class to be usable.
 */
export class SwapMarket<Q extends QueryClient & WasmExtension = QueryClient & WasmExtension> {
	readonly tokenWrapper: MultiTokenWrapper<Q>;
	readonly factoryContract: PoolFactoryContract<Q>;
	readonly routerContract: SwapRouterContract<Q>;

	#assetPairMap: { [pair: string]: SwapMarketPair };
	#marketingNameToPair: { [marketingName: string]: SwapMarketPair };
	#unwrappedToWrapped: { [wrappedDenom: UnifiedDenom]: UnifiedDenom };

	constructor(
		endpoint: Q,
		factoryContractAddress: Addr,
		routerContractAddress: Addr,
		cw20WrapperAddress: Addr,
		erc20WrapperAddress: Addr
	) {
		this.tokenWrapper = new MultiTokenWrapper(endpoint, cw20WrapperAddress, erc20WrapperAddress);
		this.factoryContract = new PoolFactoryContract(endpoint, factoryContractAddress);
		this.routerContract = new SwapRouterContract(endpoint, routerContractAddress);
		this.#assetPairMap = {};
		this.#marketingNameToPair = {};
		this.#unwrappedToWrapped = {};
	}

	/**
	 * Gets the default SwapMarket. That is, the one with contracts published by CrownFi.
	 *
	 * @param endpoint RPC Endpoint
	 * @param chainId network ID, if unspecified, the endpoint will be queried.
	 * @returns The SwapMarket with the default contracts
	 */
	static async getFromChainId<Q extends QueryClient & WasmExtension>(
		endpoint: QueryClient & WasmExtension,
		chainId: string
	): Promise<SwapMarket<Q>> {
		switch (chainId) {
			/*
			case "atlantic-2":
				return new SwapMarket(
					endpoint,
					"sei1nguta7v9s0tp0m07r46p7tsyg54rmuzjhcy0mkglxgekt2q3gdeqyhmyu7",
					"sei1vnjfpnsm70puc2umdujw6fc3p0gv98p2vdymnt4ammqv46ht7vyss6rjhm"
				);
			*/
			default:
				throw new Error("SwapMarket contract addresses aren't known for chain: " + chainId);
		}
	}
	/**
	 * Resolves the promise if the factory contract is compatible with this library.
	 * Otherwise, the promise is rejected with a `ContractVersionNotSatisfiedError`.
	 *
	 * Stable for `1.0`
	 */
	async checkVersion() {
		await this.factoryContract.checkVersion({
			"astroport-factory": "^1.6",
			"crownfi-factory": "^0.9",
		});
	}
	/**
	 * Finds all available trading pairs. If the pair is already known to exist, its corrosponding
	 */
	async refresh(): Promise<void> {
		const pairs = await this.factoryContract.queryPairs();
		for (const pairInfo of pairs) {
			const pairKey = pairInfo.canonical_pair.join("\0");
			if (this.#assetPairMap[pairKey] == null) {
				const pair = await SwapMarketPair.create(this.factoryContract.endpoint, pairInfo.address, this.tokenWrapper);
				for (let i = 0; i < pair.assets.length; i += 1) {
					if (pair.assets[i] != pair.unwrappedAssets[i]) {
						this.#unwrappedToWrapped[pair.unwrappedAssets[i]] = pair.assets[i];
					}
				}
				this.#assetPairMap[pairKey] = pair;
				this.#marketingNameToPair[pair.name] = pair;
			} else {
				await this.#assetPairMap[pairKey].refresh();
			}
		}
	}
	/**
	 * Stable for `1.0`
	 */
	getAllPairs(): SwapMarketPair[] {
		return Object.values(this.#assetPairMap);
	}
	/**
	 * Gets the `SwapMarketPair` corresponding with the specified assets.
	 *
	 * @param pair The pair to look up
	 * @param tryInverse Try looking for the reverse-pairing if the one specified isn't found
	 * @returns
	 */
	getPair(pair: UnifiedDenomPair, tryInverse: boolean = false): SwapMarketPair | null {
		pair = pair.map(asset => this.#unwrappedToWrapped[asset] || asset) as UnifiedDenomPair;
		return (
			this.#assetPairMap[pair.join("\0")] ??
			(tryInverse ? this.#assetPairMap[pair[1] + "\0" + pair[0]] ?? null : null)
		);
	}
	/**
	 * Stable for `1.0`
	 */
	getPairFromName(marketingName: string): SwapMarketPair | null {
		return this.#marketingNameToPair[marketingName] ?? null;
	}
	/**
	 * Returns a mapping of denom to a list of other denoms they can be directly traded with
	 *
	 * Stable for `1.0`
	 */
	getDirectTradeMap(pairs: SwapMarketPair[] = this.getAllPairs()): Map<UnifiedDenom, UnifiedDenom[]> {
		const result: Map<UnifiedDenom, UnifiedDenom[]> = new Map();
		for (const pair of pairs) {
			if (result.has(pair.assets[0])) {
				result.get(pair.assets[0])?.push(pair.assets[1]);
			} else {
				result.set(pair.assets[0], [pair.assets[1]]);
			}
			if (result.has(pair.assets[1])) {
				result.get(pair.assets[1])?.push(pair.assets[0]);
			} else {
				result.set(pair.assets[1], [pair.assets[0]]);
			}
		}
		return result;
	}
	/**
	 * Checks if this market holds the specified asset(s)
	 *
	 * Stable for `1.0`
	 * @param asset asset or multiple assets to check (as multiple args)
	 * @returns true if all the specified assets are in the market
	 */
	hasAsset(...asset: UnifiedDenom[]): boolean {
		for (const k in this.#assetPairMap) {
			const [pairAsset0, pairAsset1] = k.split("\0");
			let assetIndex = asset.indexOf(pairAsset0);
			if (assetIndex >= 0) {
				asset.splice(assetIndex, 1);
			}
			assetIndex = asset.indexOf(pairAsset1);
			if (assetIndex >= 0) {
				asset.splice(assetIndex, 1);
			}
			if (asset.length == 0) {
				return true;
			}
		}
		for (let i = 0; i < asset.length; i += 1) {
			if (!this.#unwrappedToWrapped[asset[i]]) {
				return false;
			}
		}
		return true;
	}

	#resolveMultiSwapRoute(
		from: UnifiedDenom,
		to: UnifiedDenom,
		_directPairs: Map<UnifiedDenom, UnifiedDenom[]> = this.getDirectTradeMap(),
		_alreadySeenFroms: Set<UnifiedDenom> = new Set()
	): UnifiedDenomPair[] | null {
		if (_alreadySeenFroms.has(from)) {
			return null; // We've already been here.
		}
		// Ideally we'd use some sort of node pathfinding algorithm with fees + gas being used as the distance
		// weights... But this is MVP so we're targetting lowest hops with brute force, baby!
		// That will be fine as long as we have 1 or 2 common tokens among all our pools.
		_alreadySeenFroms.add(from);

		const directTos = _directPairs.get(from);
		if (directTos == null) {
			return null;
		}
		let subResult: UnifiedDenomPair[] | null = null;
		for (let i = 0; i < directTos.length; i += 1) {
			const directTo = directTos[i];
			if (directTo == to) {
				// Can't get smaller than 0
				return [[from, to]];
			}
			// EXPONENTIAL TIME COMPLEXITY LET'S GOOOOOOO
			const potentialSubResult = this.#resolveMultiSwapRoute(directTo, to, _directPairs, _alreadySeenFroms);
			if (potentialSubResult != null && (subResult == null || subResult.length > potentialSubResult.length)) {
				subResult = potentialSubResult;
			}
		}
		if (subResult == null) {
			return null;
		}
		return [[from, subResult[0][0]], ...subResult];
	}

	/**
	 * Does what the function says
	 *
	 * Stable for `1.0`
	 *
	 * @param from
	 * @param to
	 * @returns individual swaps to make represented as [from, to], or null if the "from" or "to" isn't in this market.
	 * This also returns an empty array if "from" and "to" is identical. But don't rely on this to determine the
	 * existance of the asset in this market.
	 */
	resolveMultiSwapRoute(from: UnifiedDenom, to: UnifiedDenom): UnifiedDenomPair[] | null {
		from = this.#unwrappedToWrapped[from] || from;
		to = this.#unwrappedToWrapped[to] || to;
		if (from == to) {
			return [];
		}
		return this.#resolveMultiSwapRoute(from, to);
	}

	/**
	 * Builds the ExecuteInstruction(s) needed to perform the swap.
	 *
	 * Stable for `1.0`
	 *
	 * @param offerAmount The tokens to swap
	 * @param askDenom The tokens you want in return
	 * @param slippageTolerance The contract will throw an error and the transaction will be reverted if the exchange
	 * rate changes by the following amount, defaults to 1% (0.01).
	 * @param receiver If you want the resulting tokens to be sent to an address that differs from the message sender,
	 * specify it here.
	 *
	 * @returns Contract instructions to execute. If the denom asked isn't available, or if `offerDenom` is equal to
	 * `askDenom`, this returns null. Note that the specific instructions generated including the contracts sent to
	 * may change in future updates.
	 */
	buildSwapIxs(
		offer: Coin | IBigIntCoin,
		askDenom: UnifiedDenom,
		receiver: Addr,
		slippageTolerance: number = 0.01,
		expectation: SwapRouterExpectation | null = null,
	): ExecuteInstruction[] | null {
		const result: ExecuteInstruction[] = [];
		const route = this.resolveMultiSwapRoute(offer.denom, askDenom);
		if (route == null || route.length == 0) {
			return null;
		}
		if (route.length == 1) {
			return this.getPair(route[0], true)!.buildSwapIxs(
				offer,
				slippageTolerance,
				receiver
			);
		}

		const swappers = route.map(pair => {
		const pairAddress = this.getPair(pair, true)?.contract?.address;
			
			if (!pairAddress)
				throw new Error("Invalid pair");

			return pairAddress;
		});

		result.push(this.routerContract.buildExecuteSwapsIx({ 
			swappers,
			expectation,
			intermediate_slippage_tolerance: slippageTolerance.toString(),
			receiver: { direct: receiver },
		}, [ coin(offer.amount.toString(), offer.denom)]));

		return result;
	}

	buildWrapableSwapIxs(
		sender: SeiClientAccountData,
		receiver: SeiClientAccountData,
		offer: Coin | IBigIntCoin,
		askDenom: UnifiedDenom,
		slippageTolerance: number = 0.01,
		expectation: SwapRouterExpectation | null = null,
	): (EvmExecuteInstruction | ExecuteInstruction)[] | null {
		const result: (EvmExecuteInstruction | ExecuteInstruction)[] = [];
		const route = this.resolveMultiSwapRoute(offer.denom, askDenom);
		if (route == null || route.length == 0) {
			return null;
		}
		if (route.length == 1) {
			return this.getPair(route[0], true)!.buildWrapableSwapIxs(
				sender,
				receiver,
				offer,
				this.tokenWrapper.isWrapable(askDenom),
				expectation == null ? undefined : Number(expectation.slippage_tolerance),
				expectation == null ? undefined : expectation.expected_amount,
			);
		}
		if (this.tokenWrapper.isWrapable(offer.denom)) {
			result.push(
				...this.tokenWrapper.buildWrapIxs(
					offer.amount,
					offer.denom,
					sender,
					sender
				)
			);
		}
		const swappers = route.map(pair => {
			const pairAddress = this.getPair(pair, true)?.contract?.address;
			if (!pairAddress)
				throw new Error("Should not happen: Route returned an invalid pair");

			return pairAddress;
		});
		result.push(this.routerContract.buildExecuteSwapsIx({ 
			swappers,
			expectation,
			intermediate_slippage_tolerance: slippageTolerance.toString(),
			receiver: matchTokenKind<SwapReceiver>(
				askDenom,
				cw20Addr => {
					return {
						wasm_unwrap: {
							contract: cw20Addr,
							receiver: receiver.seiAddress
						}
					};
				},
				erc20Addr => {
					return {
						evm_unwrap: {
							contract: erc20Addr,
							evm_receiver: Buffer.from(receiver.evmAddress.substring(2), "hex").toString("base64")
						}
					};
				},
				_ => {
					return {
						direct: receiver.seiAddress
					};
				}
			),
		}, [coin(offer.amount.toString(), offer.denom)]));
		return result;
	}

	/**
	 * Simulates the swap. This requires a signable ClientEnv as an actual transaction simulation is performed.
	 *
	 * Stable for `1.0`
	 *
	 * @param client
	 * @param offer
	 * @param askDenom
	 * @param slippageTolerance
	 * @param receiver
	 * @returns
	 */
	async simulateSwap(
		offer: Coin | IBigIntCoin,
		askDenom: UnifiedDenom
	): Promise<SwapMarketSwapSimResult> {	
		if (offer.denom == askDenom) {
			throw new Error("Trading input denom must differ from trading output denom");
		}
		const route = this.resolveMultiSwapRoute(offer.denom, askDenom);

		if (!route) {
			throw new Error("Market does not hold assets offered or requested");
		}

		const swaps = [];
		let result_amount = BigInt(offer.amount);
		let naive_result_amount = BigInt(offer.amount);

		for (const [from, to] of route) {
			const poolPair = this.getPair([from, to], true);

			if (!poolPair)
				throw new Error("Pair not found");

			const swap = await poolPair.simulateSwap({amount: result_amount, denom: to});
			const naiveSwap = await poolPair.simulateNaiveSwap({amount: result_amount, denom: to});
			
			swaps.push(swap);
			
			result_amount = BigInt(swap.result_amount);
			naive_result_amount = BigInt(naiveSwap.result_amount);
		}

		const slip_amount = naive_result_amount - result_amount;

		return {
			result_amount: result_amount.toString(),
			result_denom: askDenom,
			slip_amount: slip_amount.toString(),
			swaps
		};
	}

	/**
	 * Returns an approximate exchange reate between the specified assets
	 *
	 * Stable for `1.0`
	 *
	 * @param fromDenom
	 * @param toDenom
	 * @param includeFees include swap fees (not transaction fees)
	 * @returns The exchange rate or NaN if either of the assets aren't in the market
	 */
	exchangeRate(fromDenom: UnifiedDenom, toDenom: UnifiedDenom, includeFees?: boolean): number {
		fromDenom = this.#unwrappedToWrapped[fromDenom] ?? fromDenom;
		toDenom = this.#unwrappedToWrapped[toDenom] ?? toDenom;
		if (fromDenom == toDenom) {
			return 1;
		}
		const route = this.resolveMultiSwapRoute(fromDenom, toDenom);
		if (route == null || route.length == 0) {
			return NaN;
		}
		let result = 1;
		for (const directExchange of route) {
			const pair = this.getPair(directExchange, true)!;
			let directRate = pair.exchangeRate(pair.assets[1] == fromDenom);
			if (includeFees) {
				directRate *= (10000 - pair.totalFeeBasisPoints) / 10000;
			}
			result *= directRate;
		}
		return result;
	}

	/**
	 * Performs a "dumb" exchange quote assuming infinite liquidity and no slippage
	 *
	 * @param value
	 * @param fromDenom
	 * @param toDenom
	 * @param includeFees include swap fees (not transaction fees)
	 * @returns The exchange value or null if either of the assets aren't in the market
	 */
	exchangeValue(value: bigint, fromDenom: UnifiedDenom, toDenom: UnifiedDenom, includeFees?: boolean): bigint | null {
		fromDenom = this.#unwrappedToWrapped[fromDenom] ?? fromDenom;
		toDenom = this.#unwrappedToWrapped[toDenom] ?? toDenom;
		if (fromDenom == toDenom) {
			return value;
		}
		const route = this.resolveMultiSwapRoute(fromDenom, toDenom);
		if (route == null || route.length == 0) {
			return null;
		}
		for (const directExchange of route) {
			const pair = this.getPair(directExchange, true)!;
			value = pair.exchangeValue(value, pair.assets[1] == fromDenom, includeFees);
			fromDenom = pair.assets[Number(pair.assets[0] == fromDenom)];
		}
		return value;
	}

	/**
	 * Returns the total value of all assets deposited in the specified denom.
	 * 
	 * @param valuationDenom The denom to get the total value in
	 * @param pairs the pairs to get the TVL from, defaults to {@link getAllPairs | `this.getAllPairs()`}
	 * @returns the total value
	 */
	getTotalValueLocked(
		valuationDenom: UnifiedDenom,
		pairs: SwapMarketPair[] = this.getAllPairs()
	): bigint {
		valuationDenom = this.#unwrappedToWrapped[valuationDenom] ?? valuationDenom;
		let approxTVL = 0n;
		for (const pair of pairs) {
			// If it didn't happen to you yet, this should be your "santa isn't real" moment with the finance industry.
			approxTVL += this.exchangeValue(pair.totalDeposits[0], pair.assets[0], valuationDenom) ?? 0n;
			approxTVL += this.exchangeValue(pair.totalDeposits[1], pair.assets[1], valuationDenom) ?? 0n;
		}
		return approxTVL;
	}
	async #normalizedTradeVolume(
		volumeQuery: (pair: SwapMarketPair) => Promise<SwapMarketAssetVolumeResult & {coins: [Coin, Coin]}>,
		enforceConsistentToTime: boolean,
		valuationDenom: UnifiedDenom,
		pairs?: UnifiedDenomPair[],
	): Promise<SwapMarketMultiNormalizedVolumeResult> {
		valuationDenom = this.#unwrappedToWrapped[valuationDenom] ?? valuationDenom;
		const marketPairs = pairs == null ?
			this.getAllPairs() :
			pairs.map(pairId => {
				const pair = this.getPair(pairId, true);
				if (pair == null) {
					throw new MarketPairNotFoundError(pairId);
				}
				return pair;
			});

		// This set is intended to store pairs which weren't specified in the pairs arg, but are still required to to
		// the conversion to the specified valuationDenom.
		const pairsNeededForValuation: Set<string> = new Set();

		const multiHops: {[denom: UnifiedDenom]: UnifiedDenomPair[]} = {};
		for (const pair of marketPairs) {
			if (pair.assets[0] == valuationDenom || pair.assets[1] == valuationDenom) {
				// These are the simplest to handle later.
				continue;
			}
			pair.assets.forEach(pairAsset => {
				if (multiHops[pairAsset] == null) {
					let route = this.#resolveMultiSwapRoute(
						pairAsset,
						valuationDenom,
						this.getDirectTradeMap(marketPairs)
					);
					if (!route) {
						// Assuming the pairs provided is a partial list, try to see if we can use the full pair list
						// to calculate the "value"
						route = this.#resolveMultiSwapRoute(
							pairAsset,
							valuationDenom
						);
						if (!route) {
							throw new UnsatisfiableSwapRouteError(pairAsset, valuationDenom);
						}
						for (const routeSegment of route) {
							// Duplicates will be deleted later
							pairsNeededForValuation.add(routeSegment.sort().join("\0"));
						}
					}
					multiHops[pairAsset] = route;
				}
			});
		}
		for (const pair of marketPairs) {
			pairsNeededForValuation.delete(pair.canonAssets.join("\0"));
		}
		// Now we need volume info for all the pair provided and also //volumeQuery
		const canonPairToVolume: {[pair: string]: Awaited<ReturnType<typeof volumeQuery>> | undefined} = {};
		const allVolumeResults = await Promise.all(
			marketPairs.concat(
				[...pairsNeededForValuation].map(pairStr => {
					const pair = this.getPair(pairStr.split("\0") as UnifiedDenomPair);
					if (pair == null) {
						throw new Error("This shouldn't happen: Could not get pair even though it was in the route");
					}
					return pair;
				})
			).map(async marketPair => {
				const result = await volumeQuery(marketPair);
				canonPairToVolume[marketPair.canonAssets.join("\0")] = await volumeQuery(marketPair);
				return result;
			})
		);
		if (enforceConsistentToTime) {
			// In this case, this is probably a call where a range was specified instead of just "until current time".
			// It is possible that we ticked over to the next UTC hour, day, etc. while allVolumes was being retrieved.
			const toTime = allVolumeResults.at(0)?.to.getTime() ?? NaN;
			for (const volumeResults of allVolumeResults) {
				if (volumeResults.to.getTime() != toTime) {
					// FIXME: Only get data again for data which doesn't fit the required criteria
					return this.#normalizedTradeVolume(
						volumeQuery,
						enforceConsistentToTime,
						valuationDenom,
						pairs
					);
				}
			}
		}
		// And now that we got all the volume results, we can finally calculate the results!
		const doVolumeMultiRoute = function(fromDenom: UnifiedDenom, amount: bigint): bigint {
			const route = multiHops[fromDenom];
			if (!route) {
				throw new Error("This shouldn't happen: doVolumeMultiRoute was called without a route");
			}
			for (const directExchange of route) {
				directExchange.sort();
				const pairVolume = canonPairToVolume[directExchange.join("\0")];
				if (pairVolume == null) {
					throw new Error("This shouldn't happen: Couldn't get pair volume even though it was in the route");
				}
				const coinIndex = Number(pairVolume.coins[1].denom == fromDenom);
				const coinInverseIndex = Number(!coinIndex);
				amount = amount *
					BigInt(pairVolume.coins[coinInverseIndex].amount) /
					BigInt(pairVolume.coins[coinIndex].amount);
				fromDenom = pairVolume.coins[coinInverseIndex].denom;
			}
			return amount;
		};
		const pairVolumes: {pair: UnifiedDenomPair, amount: bigint}[] = [];
		let totalVolume = 0n;
		let fromMs = Infinity;
		let toMs = -Infinity;
		//multiHops
		for (const marketPair of marketPairs) {
			const marketPairVolume = canonPairToVolume[marketPair.canonAssets.join("\0")];
			if (marketPairVolume == null) {
				throw new Error("This shouldn't happen: We apparently didn't get the total volume we needed");
			}
			let volume = 0n;
			if (marketPairVolume.coins[0].denom == valuationDenom) {
				// Yes, this is how the math works.
				volume = BigInt(marketPairVolume.coins[0].amount) * 2n;
			} else if (marketPairVolume.coins[1].denom == valuationDenom) {
				// Yes, this is how the math works.
				volume = BigInt(marketPairVolume.coins[1].amount) * 2n;
			} else {
				volume = doVolumeMultiRoute(
					marketPairVolume.coins[0].denom,
					BigInt(marketPairVolume.coins[0].amount)
				) + doVolumeMultiRoute(
					marketPairVolume.coins[1].denom,
					BigInt(marketPairVolume.coins[1].amount)
				);
			}
			pairVolumes.push({
				pair: [...marketPair.assets] as UnifiedDenomPair,
				amount: volume
			});
			totalVolume += volume;
		}
		return {
			pairVolumes,
			totalVolume,
			from: new Date(fromMs),
			to: new Date(toMs)
		};
	}
	/**
	 * Gets the total volume since the first trade happened in the market, normalized to the specified currency.
	 * 
	 * @param valuationDenom The currency to normalize to. This currency must be in the market.
	 * @param pairs The pairs to use, if unspecified, all pairs in the market will be used.
	 * @returns The volume statistics, the individual pair volumes will map to the `pairs` provided.
	 */
	async normalizedTradeVolumeAllTime(
		valuationDenom: UnifiedDenom,
		pairs?: UnifiedDenomPair[]
	): Promise<SwapMarketMultiNormalizedVolumeResult> {
		return this.#normalizedTradeVolume(
			marketPair => marketPair.assetTradeVolumeAllTime(),
			false,
			valuationDenom,
			pairs
		);
	}
	/**
	 * If `hours` is a number greater than 0, this returns the total volume in the past specified hours, updated every
	 * hour (UTC). For example, a value of `12` will get the volume for the previous 12 hours.
	 * 
	 * If 0 or undefined, this will return the trading volume since the UTC hour started.
	 * 
	 * Note that the contract may not store data older than 24 hours.
	 * 
	 * @param valuationDenom The currency to normalize to. This currency must be in the market.
	 * @param pairs The pairs to use, if unspecified, all pairs in the market will be used.
	 * @returns The volume statistics, the individual pair volumes will map to the `pairs` provided.
	 */
	async normalizedTradeVolumePastHours(
		valuationDenom: UnifiedDenom,
		hours?: number,
		pairs?: UnifiedDenomPair[]
	) {
		return this.#normalizedTradeVolume(
			marketPair => marketPair.assetTradeVolumePastHours(hours),
			false,
			valuationDenom,
			pairs
		);
	}
	/**
	 * If `days` is a number greater than 0, this returns the total volume in the past specified days, updated every
	 * midnight (UTC). For example, a value of `7` will get the volume for the previous 7 days.
	 * 
	 * If 0 or undefined, this will return the trading volume since midnight (UTC).
	 * 
	 * Note that the contract may not store data older than 30 days.
	 * 
	 * @param valuationDenom The currency to normalize to. This currency must be in the market.
	 * @param pairs The pairs to use, if unspecified, all pairs in the market will be used.
	 * @returns The volume statistics, the individual pair volumes will map to the `pairs` provided.
	 */
	async normalizedTradeVolumePastDays(
		valuationDenom: UnifiedDenom,
		days?: number,
		pairs?: UnifiedDenomPair[]
	) {
		return this.#normalizedTradeVolume(
			marketPair => marketPair.assetTradeVolumePastDays(days),
			false,
			valuationDenom,
			pairs
		);
	}
}
