import { WasmExtension } from "@cosmjs/cosmwasm-stargate";
import { QueryClient } from "@cosmjs/stargate";
import { SwapMarket } from "@crownfi/sei-swaps-sdk";

export class SwapService {
  readonly swapMarket: SwapMarket;

  private constructor(
    readonly client: QueryClient & WasmExtension,
    readonly factoryContractAddress: string,
    readonly routerContractAddress: string,
  ) {
    this.swapMarket = new SwapMarket(client, factoryContractAddress, routerContractAddress);
  }

  static async create(
    client: QueryClient & WasmExtension,
    factoryContractAddress: string,
    routerContractAddress: string,
  ) {
    const swapMarket = new SwapMarket(client, factoryContractAddress, routerContractAddress);
    await swapMarket.refresh();
    return swapMarket;
  }

  async getPairs() {
    return this.swapMarket.getAllPairs();
  }
}