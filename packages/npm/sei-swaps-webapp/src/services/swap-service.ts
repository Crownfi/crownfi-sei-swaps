import { WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { Coin, QueryClient } from "@cosmjs/stargate";
import { SwapMarket, SwapRouterExpectation, UnifiedDenom, UnifiedDenomPair } from "@crownfi/sei-swaps-sdk";
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