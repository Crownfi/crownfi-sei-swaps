import { WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { QueryClient } from "@cosmjs/stargate";
import { SwapMarket, SwapRouterExpectation, UnifiedDenom, UnifiedDenomPair } from "@crownfi/sei-swaps-sdk";
import { Addr } from "@crownfi/sei-utils";

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

  async simulateSwap(from: UnifiedDenom, to: UnifiedDenom, amount: bigint) {
    await this.swapMarket.refresh();
    return this.swapMarket.simulateSwap({ denom: from, amount }, to);
  }

  async executeSwap(
    from: UnifiedDenom,
    to: UnifiedDenom,
    amount: bigint,
    receiver: Addr,
    slippageTolerance: number = env.SLIPPAGE_TOLERANCE_PERCENTAGE,
    expectation: SwapRouterExpectation | null = null,
  ) {
    const client = await useGetClient();
    const ixs = this.swapMarket.buildSwapIxs({ denom: from, amount }, to, receiver, slippageTolerance, expectation);
    if (!ixs)
      return;
    const receipt = await client.executeContractHackySequence(ixs);
    return receipt;
  }
}