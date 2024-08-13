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
import { Addr, ClientEnv, getBalanceChangesFor, getUserTokenInfo } from "@crownfi/sei-utils";

import { UnifiedDenom, UnifiedDenomPair, matchTokenKind } from "./types.js";
import { coin } from "@cosmjs/amino";
import { bigIntMin } from "math-bigint";

import { WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { QueryClient } from "@cosmjs/stargate";

export type SwapMarketDepositCalcResult = {
	newShares: bigint;
	newShareValue: [[bigint, UnifiedDenom], [bigint, UnifiedDenom]];
};

export class SwapMarketPair {
	/** Name of the pair (Stable for 1.0) */
	readonly name: string;
	/** The assets in the pair (Stable for 1.0) */
	readonly assets: UnifiedDenomPair;
	/** The shares denom */
	readonly sharesDenom: string;

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
		public readonly contract: PoolPairContract<QueryClient & WasmExtension>,
		/** The amount of tokens deposited in the pool, maps with the `assets` property (Stable for 1.0) */
		public readonly totalDeposits: [bigint, bigint],
		makerFeeBasisPoints: number,
		poolFeeBasisPoints: number,
		// factoryConfig: PoolFactoryConfigJsonable,
		// pairInfo: UnifiedDenomPair,
		poolInfo: { assets: UnifiedDenomPair; total_shares: Uint128 }
	) {
		// this.totalDeposits = totalDeposits
		this.assets = poolInfo.assets;
		this.#poolFeeBasisPoints = poolFeeBasisPoints;
		this.#makerFeeBasisPoints = makerFeeBasisPoints;
		this.#totalShares = BigInt(poolInfo.total_shares);
		this.name = this.assets.map((denom) => getUserTokenInfo(denom).symbol).join("-");
		this.sharesDenom = "factory/" + contract.address + "/lp";

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

	static async create(
		endpoint: QueryClient & WasmExtension,
		pairAddress: string,
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

		const totalDeposits = await pairContract.queryShareValue({ amount: totalShares });
		const poolFeeBasisPoints = config.total_fee_bps - config.maker_fee_bps;

		return new SwapMarketPair(
			pairContract,
			[ BigInt(totalDeposits[0].amount), BigInt(totalDeposits[1].amount) ],
			config.maker_fee_bps,
			poolFeeBasisPoints,
			{ assets: poolAssets, total_shares: totalShares }
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
	 * Returns an approximate exchange rate between assets[0] and assets[1].
	 *
	 * Stable for `1.0`
	 *
	 * @param inverse return assets[1] -> assets[0] rate instead
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
	 * Performs a "dumb" exchange quote from assets[0] to assets[1] assuming infinite liquidity and no slippage
	 *
	 * Stable for `1.0`
	 *
	 * @param value input value
	 * @param inverse return assets[1] -> assets[0] rate instead
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

	/**
	 * Calculates the value of the shares amount specified
	 */
	shareValue(shares: bigint): [[bigint, UnifiedDenom], [bigint, UnifiedDenom]] {
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
	
	buildProvideLiquidityIxs(
		token0Amount: bigint,
		token1Amount: bigint,
		slippageTolerance: number = 0.01,
		receiver?: Addr | null,
		receiverPayload?: Buffer | null
	): ExecuteInstruction[] {
		const ixs: ExecuteInstruction[] = [];
		ixs.push(
			this.contract.buildProvideLiquidityIx({
				slippage_tolerance: slippageTolerance + "",
				receiver,
				receiver_payload: receiverPayload ? receiverPayload.toString("base64") : undefined
			}, [
				coin(token0Amount.toString(), this.assets[0]),
				coin(token1Amount.toString(), this.assets[1]),
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
		receiver?: Addr | null,
		receiverPayload?: Buffer | null
	): ExecuteInstruction[] {
		return [
			this.contract.buildWithdrawLiquidityIx({
				receiver,
				receiver_payload: receiverPayload ? receiverPayload.toString("base64") : undefined
			}, [
				coin(shares + "", this.sharesDenom)
			])
		]
	}

	/**
	 * Builds the ExecuteInstruction(s) needed to perform the swap.
	 *
	 * Stable for `1.0`
	 *
	 * @param offerAmount The amount of tokens to swap
	 * @param offerDenom The denom (or "cw20/{contractAddress}") to swap must match one of the pairs
	 * @param slippageTolerance The contract will throw an error and the transaction will be reverted if the exchange
	 * rate changes by the following amount, defaults to 1% (0.01).
	 * @param receiver If you want the resulting tokens to be sent to an address that differs from the message sender,
	 * specify it here.
	 *
	 * @returns Contract instructions to execute or null if the denom asked isn't available. Note that the specific
	 * instructions generated including the contracts sent to may change in future updates.
	 */
	buildSwapIxs(
		offerAmount: bigint,
		offerDenom: UnifiedDenom,
		slippageTolerance: number = 0.01,
		receiver?: Addr | null,
		receiverPayload?: Buffer | null
	): ExecuteInstruction[] {
		return [
			this.contract.buildSwapIx(
				{
					receiver,
					slippage_tolerance: slippageTolerance + "",
				},
				[
					coin(offerAmount.toString(), offerDenom),
				]
			),
		];
	}

	async simulateSwap(
		offerAmount: bigint,
		offerDenom: UnifiedDenom
	): Promise<PoolPairCalcSwapResult> {
		return this.contract.querySimulateSwap({
			offer: coin(offerAmount.toString(), offerDenom)
		});
	}

	async simulateNaiveSwap(
		offerAmount: bigint,
		offerDenom: UnifiedDenom
	): Promise<PoolPairCalcNaiveSwapResult> {
		return this.contract.querySimulateNaiveSwap({
			offer: coin(offerAmount.toString(), offerDenom)
		});
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
export class SwapMarket {
	readonly factoryContract: PoolFactoryContract<QueryClient & WasmExtension>;
	readonly routerContract: SwapRouterContract<QueryClient & WasmExtension>;

	#assetPairMap: { [pair: string]: SwapMarketPair };
	#marketingNameToPair: { [marketingName: string]: SwapMarketPair };

	constructor(endpoint: QueryClient & WasmExtension, factoryContractAddress: Addr, routerContractAddress: Addr) {
		this.factoryContract = new PoolFactoryContract(endpoint, factoryContractAddress);
		this.routerContract = new SwapRouterContract(endpoint, routerContractAddress);
		this.#assetPairMap = {};
		this.#marketingNameToPair = {};
	}

	/**
	 * Gets the default SwapMarket. That is, the one with contracts published by CrownFi.
	 *
	 * @param endpoint RPC Endpoint
	 * @param chainId network ID, if unspecified, the endpoint will be queried.
	 * @returns The SwapMarket with the default contracts
	 */
	static async getFromChainId(endpoint: QueryClient & WasmExtension, chainId: string): Promise<SwapMarket> {
		switch (chainId) {
			case "atlantic-2":
				return new SwapMarket(
					endpoint,
					"sei1nguta7v9s0tp0m07r46p7tsyg54rmuzjhcy0mkglxgekt2q3gdeqyhmyu7",
					"sei1vnjfpnsm70puc2umdujw6fc3p0gv98p2vdymnt4ammqv46ht7vyss6rjhm"
				);
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
		const [factoryConfig, pairs] = await Promise.all([
			this.factoryContract.queryConfig(),
			// FIXME: Skip over pairs we already know about
			this.factoryContract.queryPairs(),
		]);
		for (const pairInfo of pairs) {
			const pairKey = pairInfo.canonical_pair.join("\0");
			if (this.#assetPairMap[pairKey] == null) {
				const pair = await SwapMarketPair.create(this.factoryContract.endpoint, pairInfo.address);

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
	getDirectTradeMap(): Map<UnifiedDenom, UnifiedDenom[]> {
		const result: Map<UnifiedDenom, UnifiedDenom[]> = new Map();
		for (const pair of this.getAllPairs()) {
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
		return false;
	}

	#resolveMultiSwapRoute(
		from: UnifiedDenom,
		to: UnifiedDenom,
		_directPairs: Map<UnifiedDenom, UnifiedDenom[]> = this.getDirectTradeMap(),
		_alreadySeenFroms: Set<UnifiedDenom> = new Set()
	): [UnifiedDenom, UnifiedDenom][] | null {
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
		let subResult: [string, string][] | null = null;
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
	resolveMultiSwapRoute(from: UnifiedDenom, to: UnifiedDenom): [UnifiedDenom, UnifiedDenom][] | null {
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
	 * @param offerAmount The amount of tokens to swap
	 * @param offerDenom The denom (or "cw20/{contractAddress}") to swap
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
		offerAmount: bigint,
		offerDenom: UnifiedDenom,
		askDenom: UnifiedDenom,
		receiver: Addr,
		slippageTolerance: number = 0.01,
		expectation: SwapRouterExpectation | null = null,
	): ExecuteInstruction[] | null {
		const result: ExecuteInstruction[] = [];

		const route = this.resolveMultiSwapRoute(offerDenom, askDenom);

		if (route == null || route.length == 0) {
			return null;
		}

		const swappers = route.map(pair => {
			const pairAddress = this.getPair(pair)?.contract?.address;
			
			if (!pairAddress)
				throw new Error("Invalid pair");

			return pairAddress;
		});

		result.push(this.routerContract.buildExecuteSwapsIx({ 
			swappers,
			expectation,
			"intermediate_slippage_tolerance": slippageTolerance.toString(),
			receiver: { direct: receiver },
		}, [ coin(offerAmount.toString(), offerDenom)]));

		return result;
	}

	/**
	 * Simulates the swap. This requires a signable ClientEnv as an actual transaction simulation is performed.
	 *
	 * Stable for `1.0`
	 *
	 * @param client
	 * @param offerAmount
	 * @param offerDenom
	 * @param askDenom
	 * @param slippageTolerance
	 * @param receiver
	 * @returns
	 */
	async simulateSwap(
		offerAmount: bigint,
		offerDenom: UnifiedDenom,
		askDenom: UnifiedDenom
	): Promise<SwapMarketSwapSimResult> {	
		if (offerDenom == askDenom) {
			throw new Error("Trading input denom must differ from trading output denom");
		}
		const route = this.resolveMultiSwapRoute(offerDenom, askDenom);

		if (!route) {
			throw new Error("Market does not hold assets offered or requested");
		}

		const swaps = [];
		let result_amount = offerAmount;
		let naive_result_amount = offerAmount;

		for (const [from, to] of route) {
			const poolPair = this.getPair([from, to]);

			if (!poolPair)
				throw new Error("Pair not found");

			const swap = await poolPair.simulateSwap(result_amount, to);
			const naiveSwap = await poolPair.simulateNaiveSwap(result_amount, to);
			
			swaps.push(swap);
			
			result_amount = BigInt(swap.result_amount);
			naive_result_amount = BigInt(naiveSwap.result_amount);
		}

		const slip_amount = result_amount - naive_result_amount;

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
		}
		return value;
	}
}
