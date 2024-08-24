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

  async simulateSwap(from: UnifiedDenom, to: UnifiedDenom, offerAmount: bigint) {
    await this.swapMarket.refresh();
    return this.swapMarket.simulateSwap(offerAmount, from, to);
  }
}