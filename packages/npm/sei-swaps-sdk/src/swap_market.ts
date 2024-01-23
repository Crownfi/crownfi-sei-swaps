import { CosmWasmClient, ExecuteInstruction } from "@cosmjs/cosmwasm-stargate";
import { AstroFactoryContract, AstroPairContract } from "./index.js"
import { Addr, ClientEnv, getUserTokenInfo, updateUserTokenInfo } from "@crownfi/sei-utils";
import { amountWithDenomToAstroAsset, astroAssetInfoToUniDenom, astroAssetToAmountWithDenom, uniDenomToAstroAssetInfo } from "./astro_legacy_conversions.js";
import { Asset, AstroFactoryConfigResponse, AstroPairPoolResponse, AstroPairType, AstroRouterContract, PairInfo } from "./base/index.js";
import { UnifiedDenom, UnifiedDenomPair, matchIfCW20Token } from "./types.js";
import { Coin } from "@cosmjs/amino";


export type SwapMarketDepositSimResult = {
	newShares: bigint,
	newShareValue: [[bigint, UnifiedDenom], [bigint, UnifiedDenom]]
	slippage: number,
	instructions: ExecuteInstruction[]
}

export class SwapMarketPair {
	readonly contract: AstroPairContract
	/** Name of the pair (Stable for 1.0) */
	readonly name: string
	/** The assets in the pair (Stable for 1.0) */
	readonly assets: UnifiedDenomPair
	/** The amount of tokens deposited in the pool, maps with the `assets` property (Stable for 1.0) */
	readonly totalDeposits: [bigint, bigint]
	/** Maker fee in basis points. 10000‱ = 100% (Stable for 1.0) */
	get makerFeeBasisPoints() {return this.#makerFeeBasisPoints}
	#makerFeeBasisPoints: number
	/** Pool fee in basis points. 10000‱ = 100% (Stable for 1.0) */
	get poolFeeBasisPoints() {return this.#poolFeeBasisPoints}
	#poolFeeBasisPoints: number
	/** The denom of the shares */
	get sharesDenom() {return this.#sharesDenom}
	#sharesDenom: UnifiedDenom
	/** The denom of the shares */
	get totalShares() {return this.#totalShares}
	#totalShares: bigint
	/** Total fee. (Stable for 1.0) */
	get totalFeeBasisPoints() {
		return this.makerFeeBasisPoints + this.poolFeeBasisPoints;
	}

	#astroPairType: AstroPairType
	constructor(
		contract: AstroPairContract,
		factoryConfig: AstroFactoryConfigResponse,
		pairInfo: PairInfo,
		poolInfo: AstroPairPoolResponse
	) {
		this.contract = contract;
		this.assets = (poolInfo.assets as [Asset, Asset])
			// You'd think that the .map type definition would account for fixed-length arrays, but nope.
			.map(asset => astroAssetInfoToUniDenom(asset.info)) as [UnifiedDenom, UnifiedDenom];
		this.totalDeposits = (poolInfo.assets as [Asset, Asset])
			.map(asset => BigInt(asset.amount)) as [bigint, bigint];
		this.name = this.assets.map(denom => getUserTokenInfo(denom).name).join("-");
		
		this.#astroPairType = pairInfo.pair_type;
		this.#sharesDenom = "cw20/" + pairInfo.liquidity_token;
		this.#totalShares = BigInt(poolInfo.total_share);
		const factoryPairConfig = factoryConfig.pair_configs.find(v => {
			// Ugh, the "single property with empty object" convention for rust handling Rust enums sucks.
			// Can't wait until we migrate away from astroport-derived contracts...
			JSON.stringify(v.pair_type) == JSON.stringify(this.#astroPairType)
		})!;
		this.#makerFeeBasisPoints = factoryPairConfig.maker_fee_bps;
		this.#poolFeeBasisPoints = factoryPairConfig.total_fee_bps - factoryPairConfig.maker_fee_bps;
	}
	/**
	 * Resolves the promise if the factory contract is compatible with this library.
	 * Otherwise, the promise is rejected with a `ContractVersionNotSatisfiedError`.
	 * 
	 * Stable for `1.0`
	 */
	async checkVersion() {
		await this.contract.checkVersion({
			"astroport-pair": "^1.4",
			"crownfi-astro-pair": "^0.9"
		});
	}
	/**
	 * Used for bulk-refreshing multiple pools
	 * @internal
	 */
	async _refresh(factoryConfig: AstroFactoryConfigResponse) {
		const poolInfo = await this.contract.queryPool();
		if (poolInfo.assets.length != 2) {
			// This should never happen...
			// but the contract uses a Vec<Asset> instead of an [Asset; 2] so here we are
			throw new Error("The pool \"pair\" should contain 2 assets.");
		}
		const poolInfoAssets = poolInfo.assets as [Asset, Asset];
		for (let i = 0; i < poolInfoAssets.length; i += 1) {
			const [amount, denom] = astroAssetToAmountWithDenom(poolInfo.assets[i]);
			if (this.assets[i] != denom) {
				throw new Error("The pair somehow changed the asset it was containing")
			}
			this.totalDeposits[i] = amount;
		}
		this.#totalShares = BigInt(poolInfo.total_share);

		const factoryPairConfig = factoryConfig.pair_configs.find(v => {
			// Ugh, the "single property with empty object" convention for rust handling Rust enums sucks.
			// Can't wait until we migrate away from astroport-derived contracts...
			JSON.stringify(v.pair_type) == JSON.stringify(this.#astroPairType)
		})!;
		this.#makerFeeBasisPoints = factoryPairConfig.maker_fee_bps;
		this.#poolFeeBasisPoints = factoryPairConfig.total_fee_bps - factoryPairConfig.maker_fee_bps;
	}
	/**
	 * Refreshes the pool value, total shares, and fees.
	 * 
	 * There is no need to call this function if you call `refresh()` on the `SwapMarket` used to construct this class.
	 * 
	 * Stable for `1.0`
	 */
	async refresh() {
		const factoryContract = new AstroFactoryContract(
			this.contract.endpoint,
			(await this.contract.queryConfig()).factory_addr
		);
		await this._refresh(await factoryContract.queryConfig());
	}
	/**
	 * Returns an approximate exchange rate between token0 and token1.
	 */
	exchangeRate(): number {
		return Number(this.totalDeposits[0]) / Number(this.totalDeposits[1])
	}
	/**
	 * Calculates the value of the shares amount specified
	 */
	shareValue(shares: bigint): [[bigint, UnifiedDenom], [bigint, UnifiedDenom]] {
		if (this.totalShares == 0n) {
			return [
				[0n, this.assets[0]],
				[0n, this.assets[1]]
			]
		}
		return [
			[this.totalDeposits[0] * shares / this.totalShares, this.assets[0]],
			[this.totalDeposits[1] * shares / this.totalShares, this.assets[1]]
		]
	}
	buildProvideLiquidityIxs(
		token0Amount: bigint,
		token1Amount: bigint,
		slippageTolerance: number = 0.01,
		receiver?: Addr | null,
	): ExecuteInstruction[] {
		const funds: Coin[] = []
		const ixs: ExecuteInstruction[] = [];
		matchIfCW20Token(
			this.assets[0],
			(contractAddress) => {
				ixs.push({
					contractAddress,
					msg: {
						increase_allowance: {
							amount: token0Amount + "",
							spender: this.contract.address
						}
					}/* satisfies CW20ExecuteMsg */
				});
			},
			(denom) => {
				funds.push({
					amount: token0Amount + "",
					denom
				});
			}
		);
		matchIfCW20Token(
			this.assets[1],
			(contractAddress) => {
				ixs.push({
					contractAddress,
					msg: {
						increase_allowance: {
							amount: token1Amount + "",
							spender: this.contract.address
						}
					}/* satisfies CW20ExecuteMsg */
				});
			},
			(denom) => {
				funds.push({
					amount: token1Amount + "",
					denom
				});
			}
		);
		ixs.push(
			this.contract.buildProvideLiquidityIx({
				assets: [
					amountWithDenomToAstroAsset(token0Amount, this.assets[0]),
					amountWithDenomToAstroAsset(token1Amount, this.assets[1])
				],
				slippage_tolerance: slippageTolerance + "",
				receiver
			})
		);
		return ixs;
	}

	async simulateProvideLiquidity(
		client: ClientEnv,
		token0Amount: bigint,
		token1Amount: bigint
	): Promise<SwapMarketDepositSimResult> {
		throw new Error("TODO: simulateProvideLiquidity");
	}

	buildWithdrawLiquidityIxs(
		shares: bigint
	): ExecuteInstruction[] {
		// Still returning an array cuz there's fancy stuff that's in store for the major contracts upgrade
		return [
			this.contract.buildWithdrawLiquidityCw20Ix(this.sharesDenom, shares)
		];
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
	): ExecuteInstruction[] {
		return matchIfCW20Token(
			offerDenom,
			(contractAddress) => [
				this.contract.buildSwapCw20Ix(
					contractAddress,
					offerAmount,
					{
						max_spread: slippageTolerance + "",
						to: receiver
					}
				)
			],
			(denom) => [
				this.contract.buildSwapIx(
					{
						offer_asset: amountWithDenomToAstroAsset(offerAmount, denom),
						max_spread: slippageTolerance + "",
						to: receiver
					},
					[
						{
							amount: offerAmount + "",
							denom
						}
					]
				)
			]
		);
	}

	async simulateSwap(
		client: ClientEnv,
		offerAmount: bigint,
		offerDenom: UnifiedDenom,
		slippageTolerance: number = 0.01,
		receiver?: Addr | null,
	): Promise<SwapMarketSwapSimResult> {
		throw new Error("TODO: simulateSwap");
	}
}

export type SwapMarketSwapSimResult = {
	amount: bigint,
	slippage: number,
	instructions: ExecuteInstruction[]
}

/**
 * Represents the whole swap market.
 * The existance of this class is stable for `1.0`
 * 
 * After constructing this class, the `refresh` method must be called once for this class to be usable.
 */
export class SwapMarket {
	readonly factoryContract: AstroFactoryContract
	readonly routerContract: AstroRouterContract
	#assetPairMap: {[pair: string]: SwapMarketPair}
	#marketingNameToPair: {[marketingName: string]: SwapMarketPair}
	constructor(
		endpoint: CosmWasmClient,
		factoryContractAddress: Addr,
		routerContractAddress: Addr
	) {
		this.factoryContract = new AstroFactoryContract(endpoint, factoryContractAddress);
		this.routerContract = new AstroRouterContract(endpoint, routerContractAddress);
		this.#assetPairMap = {};
		this.#marketingNameToPair = {};
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
			"crownfi-factory": "^0.9"
		});
	}
	/**
	 * Finds all available trading pairs. If the pair is already known to exist, its corrosponding
	 */
	async refresh(): Promise<void> {
		const [factoryConfig, {pairs}] = await Promise.all([
			this.factoryContract.queryConfig(),
			// FIXME: Skip over pairs we already know about
			this.factoryContract.queryPairs(),
			updateUserTokenInfo()
		]);
		for (const pairInfo of pairs) {
			const pairKey = pairInfo.asset_infos.map(astroAssetInfoToUniDenom).join("\0");
			if (this.#assetPairMap[pairKey] == null) {
				const pairContract = new AstroPairContract(this.factoryContract.endpoint, pairInfo.contract_addr);
				const poolInfo = await pairContract.queryPool();
				this.#assetPairMap[pairKey] = new SwapMarketPair(
					pairContract,
					factoryConfig,
					pairInfo,
					poolInfo
				);
			} else {
				await this.#assetPairMap[pairKey]._refresh(factoryConfig);
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
		return this.#assetPairMap[pair.join("\0")] ??
			(tryInverse ? (this.#assetPairMap[pair[1] + "\0" + pair[0]] ?? null) : null);
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
			}else{
				result.set(pair.assets[0], [pair.assets[1]])
			}
			if (result.has(pair.assets[1])) {
				result.get(pair.assets[1])?.push(pair.assets[0]);
			}else{
				result.set(pair.assets[1], [pair.assets[0]])
			}
		}
		return result;
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
			if (
				potentialSubResult != null &&
				(subResult == null || subResult.length > potentialSubResult.length)
			) {
				subResult = potentialSubResult
			}
		}
		if (subResult == null) {
			return null;
		}
		return [
			[from, subResult[0][0]],
			...subResult
		];
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
	resolveMultiSwapRoute(
		from: UnifiedDenom,
		to: UnifiedDenom,
	): [UnifiedDenom, UnifiedDenom][] | null {
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
		slippageTolerance: number = 0.01,
		receiver?: Addr | null,
	): ExecuteInstruction[] | null {
		const result: ExecuteInstruction[] = [];
		const route = this.resolveMultiSwapRoute(offerDenom, askDenom);
		if (route == null || route.length == 0) {
			return null;
		}
		if (route.length == 1) {
			return this.getPair([offerDenom, askDenom], true)!.buildSwapIxs(
				offerAmount,
				offerDenom,
				slippageTolerance,
				receiver
			);
		}
		const operations = route.map(v => {
			return {
				astro_swap: {
					offer_asset_info: uniDenomToAstroAssetInfo(v[0]),
					ask_asset_info: uniDenomToAstroAssetInfo(v[1])
				}
			}
		});
		return matchIfCW20Token(
			offerDenom,
			(contractAddress) => [
				this.routerContract.buildExecuteSwapOperationsCw20Ix(
					contractAddress,
					offerAmount,
					{
						max_spread: slippageTolerance + "",
						operations
					}
				)
			],
			(denom) => [
				this.routerContract.buildExecuteSwapOperationsIx(
					{
						max_spread: slippageTolerance + "",
						operations
					},
					[{
						amount: offerAmount + "",
						denom
					}]
				)
			]
		);
		
	}

	async simulateSwap(
		client: ClientEnv,
		offerAmount: bigint,
		offerDenom: UnifiedDenom,
		askDenom: UnifiedDenom,
		slippageTolerance: number = 0.01,
		receiver?: Addr | null,
	): Promise<SwapMarketSwapSimResult> {
		throw new Error("TODO: simulateSwap");
	}
}
