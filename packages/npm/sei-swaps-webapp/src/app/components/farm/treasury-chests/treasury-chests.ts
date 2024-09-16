import { bigIntToStringDecimal } from "@crownfi/sei-utils";

import { useGetTokenInfo } from "../../../../hooks/use-get-token-info.js";
import { swapService } from "../../../index.js";
import { TreasuryChestsComponentAutogen } from "./_autogen/treasury-chests.js";
import { getCurrency } from "../../../../utils/get-currency.js";

export class TreasuryChests extends TreasuryChestsComponentAutogen {
  private loader = '<img class="loading-spinner" width="32" />';
  private error = '<span class="cicon cicon-size-medium cicon-cry"></span>';

  valueOrError(value: string) {
    return +value < 0 ? this.error : value;
  }

  async refresh(currency = getCurrency()) {
    this.refs.tvlAmount.innerHTML = this.loader;
    this.refs.tvtAmount.innerHTML = this.loader;
    this.refs.tvlLastDayAmount.innerHTML = this.loader;

    const currencyInfo = await useGetTokenInfo(currency);
    const summary = await swapService.getNetworkSummary(currency);
    const tvl = bigIntToStringDecimal(summary.totalValueLocked, currencyInfo.decimals, true);
    const tvt = bigIntToStringDecimal(summary.totalVolumeTraded, currencyInfo.decimals, true);
    const tvlLastDay = bigIntToStringDecimal(summary.lastDayTotalValueLocked, currencyInfo.decimals, true);

    this.refs.tvlAmount.innerHTML = this.valueOrError(tvl);
    this.refs.tvtAmount.innerHTML = this.valueOrError(tvt);
    this.refs.tvlLastDayAmount.innerHTML = this.valueOrError(tvlLastDay);
  }

  async connectedCallback() {
    this.refresh();

    document.addEventListener("currencySelected", ev => {
      this.refresh(ev.detail.denom);
    });
  }
}

TreasuryChests.registerElement();