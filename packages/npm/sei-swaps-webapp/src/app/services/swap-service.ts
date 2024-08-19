import { WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { QueryClient } from "@cosmjs/stargate";
import { SwapMarket, UnifiedDenom, UnifiedDenomPair } from "@crownfi/sei-swaps-sdk";

export class SwapService {
  private constructor(
    protected swapMarket: SwapMarket
  ) {}

  static async create(
    client: QueryClient & WasmExtension,
    factoryContractAddress: string,
    routerContractAddress: string,
  ) {
    const swapMarket = new SwapMarket(client, factoryContractAddress, routerContractAddress);
    await swapMarket.refresh();
    return new SwapService(swapMarket);
  }

  getPairs() {
    return this.swapMarket.getAllPairs();
  }

  getPair(pair: UnifiedDenomPair) {
    return this.swapMarket.getPair(pair) ?? this.swapMarket.getPair(pair, true);
  }

  async getAvailableAmountForSwap(from: UnifiedDenom, to: UnifiedDenom) {
    await this.swapMarket.refresh();
    const tradeMap = this.swapMarket.resolveMultiSwapRoute(from, to);
    const lastPair = tradeMap?.at(-1);
    if (!tradeMap || !lastPair)
      return BigInt(0);
    const pair = this.getPair(lastPair);
    if (!pair)
      return BigInt(0);
    return pair.totalDeposits[1];
  }
}