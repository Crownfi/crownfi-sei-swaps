import { SwapMarketPair } from "@crownfi/sei-swaps-sdk";
import { PoolItemComponentAutogen } from "./_autogen/pool-item.js";

export class PoolItemComponent extends PoolItemComponentAutogen {
  constructor(readonly poolPair: SwapMarketPair) {
    super();
  }

  connectedCallback() {
    this.classList.add("fantasy-menu-item-block");
    const fromDenom = this.poolPair.assets[0];
    const toDenom = this.poolPair.assets[1];
    const exchangeRateFrom = this.poolPair.exchangeRate();
    const exchangeRateTo = this.poolPair.exchangeRate(true);
    const feeRate = this.poolPair.totalFeeBasisPoints;

    this.refs.poolsFrom.denom = fromDenom;
    this.refs.poolsTo.denom = toDenom;
    this.refs.exchangeRateFrom.denom = fromDenom;
    this.refs.exchangeRateFrom.amount = exchangeRateFrom;
    this.refs.exchangeRateTo.denom = toDenom;
    this.refs.exchangeRateTo.amount = exchangeRateTo;
    this.refs.totalDepositsFrom.denom = fromDenom;
    this.refs.totalDepositsFrom.amount = this.poolPair.totalDeposits[0];
    this.refs.totalDepositsTo.denom = toDenom;
    this.refs.totalDepositsTo.amount = this.poolPair.totalDeposits[1];
    this.refs.feeRate.innerText = `${feeRate.toFixed(2)}%`;
  }
}

PoolItemComponent.registerElement();