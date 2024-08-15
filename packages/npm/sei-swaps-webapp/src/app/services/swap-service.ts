import { WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { QueryClient } from "@cosmjs/stargate";
import { SwapMarket } from "@crownfi/sei-swaps-sdk";

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

  async getPairs() {
    return this.swapMarket.getAllPairs();
  }
}