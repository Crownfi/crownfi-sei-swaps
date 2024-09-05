import { SwapMarketPair, UnifiedDenom } from "@crownfi/sei-swaps-sdk";
import { swapService } from "../../index.js";
import { FarmComponentAutogen } from "./_autogen/farm.js";
import { PoolItemComponent } from "./pool-item/pool-item.js";
import { SortBy } from "../exports.js";
import { useGetBalance } from "../../../hooks/use-get-balance.js";
import { seiUtilEventEmitter } from "@crownfi/sei-utils";

type ShareBalances = {
  [key: UnifiedDenom]: bigint;
};

export class FarmComponent extends FarmComponentAutogen {
  defaultSort: SortBy = "alphabetical";
  poolPairs: SwapMarketPair[];
  sharesBalances: ShareBalances;

  constructor() {
    super();
    this.poolPairs = [];
    this.sharesBalances = {};
  }

  async refreshPoolPairs() {
    this.poolPairs = await swapService.getPairs();
    this.sharesBalances = Object.fromEntries(
      await Promise.all(this.poolPairs.map(async (pair) => [pair.name, (await useGetBalance(pair.sharesDenom)).raw]))
    );
  }

  getSortedList(sort: SortBy, list: SwapMarketPair[]) {
    const tmp = [...list];
    
    const sumDeposits = (pair: SwapMarketPair) => pair.totalDeposits[0] + pair.totalDeposits[1];
    const getShareBalance = (pair: SwapMarketPair) => this.sharesBalances[pair.name];
    const getFees = (pair: SwapMarketPair) => pair.totalFeeBasisPoints;

    const sortFn = {
      "alphabetical": (curr: SwapMarketPair, next: SwapMarketPair) => curr.name > next.name ? 1 : -1,
      "tvd": (curr: SwapMarketPair, next: SwapMarketPair) => sumDeposits(curr) > sumDeposits(next) ? -1 : 1,
      "uvd": (curr: SwapMarketPair, next: SwapMarketPair) => getShareBalance(curr) > getShareBalance(next) ? -1 : 1,
      "apy": (curr: SwapMarketPair, next: SwapMarketPair) => getFees(curr) > getFees(next) ? 1 : -1,
      "fees": (curr: SwapMarketPair, next: SwapMarketPair) => getFees(curr) > getFees(next) ? 1 : -1,
    }[sort];

    tmp.sort(sortFn);

    return tmp;
  }

  renderList(sort = this.defaultSort) {
    this.refs.poolsList.innerHTML = "";
    const separator = document.createElement("tr");
    separator.innerHTML = `<td style="padding: 4px; background: transparent;" colspan="7"></td>`;
    const sortedList = this.getSortedList(sort, this.poolPairs);
    for (const pair of sortedList) {
      this.refs.poolsList.appendChild(separator);
      this.refs.poolsList.appendChild(new PoolItemComponent(pair));
    }
  }

  async connectedCallback() {
    this.refs.sortBy.setAttribute("default", this.defaultSort);
    await this.refreshPoolPairs();
    this.renderList();

    this.addEventListener("sortByEvent", ev => {
      ev.stopPropagation();
      this.renderList(ev.detail.sortBy);
    });
  }
}

FarmComponent.registerElement();