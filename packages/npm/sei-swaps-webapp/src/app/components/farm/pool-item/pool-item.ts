import { SwapMarketPair } from "@crownfi/sei-swaps-sdk";
import { stringDecimalToBigInt } from "@crownfi/sei-utils";

import { PoolItemComponentAutogen } from "./_autogen/pool-item.js";
import { swapService } from "../../../index.js";
import { useGetTokenInfo } from "../../../../hooks/use-get-token-info.js";

export class PoolItemComponent extends PoolItemComponentAutogen {
  constructor(readonly poolPair: SwapMarketPair) {
    super();
  }

  async connectedCallback() {
    this.classList.add("fantasy-menu-item-block");

    const fromDenom = this.poolPair.unwrappedAssets[0];
    const fromTokenInfo = await useGetTokenInfo(fromDenom);
    const toDenom = this.poolPair.unwrappedAssets[1];
    const toTokenInfo = await useGetTokenInfo(toDenom);
  
    const exchangeRateFrom = stringDecimalToBigInt(swapService.getExchangeRate(fromDenom, toDenom), fromTokenInfo.decimals);
    const exchangeRateTo = stringDecimalToBigInt(swapService.getExchangeRate(toDenom, fromDenom), toTokenInfo.decimals);
    const feeRate = this.poolPair.totalFeeBasisPoints;

    this.refs.fromIcon.setAttribute("denom", fromDenom);
    this.refs.toIcon.setAttribute("denom", toDenom);
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