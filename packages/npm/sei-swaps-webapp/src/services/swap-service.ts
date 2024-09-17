import { WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { QueryClient } from "@cosmjs/stargate";
import { SwapMarket, UnifiedDenom, UnifiedDenomPair } from "@crownfi/sei-swaps-sdk";
import { Addr, BigIntCoin } from "@crownfi/sei-utils";

import { useGetClient } from "../hooks/use-get-client.js";
import { env } from "../env/index.js";

export class SwapService {
  private constructor(
    protected swapMarket: SwapMarket
  ) {}

  static async create(
    client: QueryClient & WasmExtension,
    factoryContractAddress: string,
    routerContractAddress: string,
    cw20WrapperContractAddress: string,
    erc20WrappercontractAddress: string,
  ) {
    const swapMarket = new SwapMarket(
      client,
      factoryContractAddress,
      routerContractAddress,
      cw20WrapperContractAddress,
      erc20WrappercontractAddress
    );
    await swapMarket.refresh();
    return new SwapService(swapMarket);
  }

  async getPairs() {
    await this.swapMarket.refresh();
    return this.swapMarket.getAllPairs();
  }

  async getPair(pair: UnifiedDenomPair) {
    await this.swapMarket.refresh();
    return this.swapMarket.getPair(pair) ?? this.swapMarket.getPair(pair, true);
  }

  async getNormalizedValue(
    from: BigIntCoin,
		valuationDenom: UnifiedDenom
	): Promise<bigint> {
    await this.swapMarket.refresh();
		return this.swapMarket.exchangeValue(from.amount, from.denom, valuationDenom) ?? 0n;
	}

  async getNetworkSummary(evaluationDenom: UnifiedDenom) {
    const [
      totalValueLocked,
      totalVolumeTraded,
      lastDayTotalValueLocked
    ] = await Promise.all([
      this.swapMarket.getTotalValueLocked(evaluationDenom),
      this.swapMarket.normalizedTradeVolumeAllTime(evaluationDenom)
        .then(({ totalVolume }) => totalVolume)
        .catch(error => {
          console.debug("normalizedTradeVolumeAllTime error", error);
          return -1n;
        }),
      this.swapMarket.normalizedTradeVolumePastHours(evaluationDenom, 24)
        .then(({ totalVolume }) => totalVolume)
        .catch(error => {
          console.debug("normalizedTradeVolumePastHours error", error);
          return -1n;
        }),
    ]);

    return {
      totalValueLocked,
      totalVolumeTraded,
      lastDayTotalValueLocked,
    }
  }

  async getEstimatedAPYPast30Days(from: UnifiedDenom, to: UnifiedDenom) {
    await this.swapMarket.refresh();
    const pair = await this.getPair([from, to]);
    if (!pair)
      throw new Error("Invalid pair");
    return pair.getEstimatedAPYPastDays(30);
  }

  async simulateSwap(from: UnifiedDenom, to: UnifiedDenom, amount: bigint) {
    await this.swapMarket.refresh();
    return this.swapMarket.simulateSwap({ denom: from, amount }, to);
  }

  async simulateDeposit(from: BigIntCoin, to: BigIntCoin) {
    const pair = await this.getPair([from.denom, to.denom]);
    if (!pair)
      throw new Error("Invalid pair");
    await pair.refresh();
    return pair.calculateProvideLiquidity(from.amount, to.amount);
  }

  getExchangeRate(from: UnifiedDenom, to: UnifiedDenom) {
    return this.swapMarket.exchangeRate(from, to, false);
  }

  async executeSwap(
    from: UnifiedDenom,
    to: UnifiedDenom,
    amount: bigint,
    amountExpected: string,
    slippageTolerance: number = env.SLIPPAGE_TOLERANCE_PERCENTAGE,
  ) {
    const client = await useGetClient();
    const sender = client.account;
    if (!sender)
      throw new Error("Wallet not connected");
    const ixs = this.swapMarket.buildWrapableSwapIxs(
      sender,
      sender,
      { denom: from, amount }, 
      to, 
      slippageTolerance, 
      {
        slippage_tolerance: `${env.SLIPPAGE_TOLERANCE_PERCENTAGE}`,
        expected_amount: amountExpected
      }
    );
    if (!ixs)
      return;
    const receipt = await client.executeContractHackySequence(ixs);
    return receipt;
  }

  async executeDeposit(from: BigIntCoin, to: BigIntCoin, slippageTolerance: number = env.SLIPPAGE_TOLERANCE_PERCENTAGE) {
    const pair = await this.getPair([from.denom, to.denom]);
    if (!pair)
      throw new Error("Invalid pair");
    const client = await useGetClient();
    const sender = client.account;
    if (!sender)
      throw new Error("Wallet not connected");
    const ixs = pair.buildWrapAndProvideLiquidity(
      sender,
      sender,
      [from, to],
      slippageTolerance
    );
    const receipt = await client.executeContractHackySequence(ixs);
    return receipt;
  }

  async executeWithdraw(from: UnifiedDenom, to: UnifiedDenom, amount: bigint, receiver: Addr) {
    const pair = await this.getPair([from, to]);
    if (!pair)
      throw new Error("Invalid pair");
    const client = await useGetClient();
    const sender = client.account;
    if (!sender)
      throw new Error("Wallet not connected");
    const ixs = pair.buildWithdrawAndUnwrapLiquidityIxs(amount, sender);
    const receipt = await client.executeContractHackySequence(ixs);
    return receipt;
  }
}