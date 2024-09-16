import { swapService } from "../../../index.js";
import { TreasuryChestsComponentAutogen } from "./_autogen/treasury-chests.js";
import { getCurrency } from "../../../../utils/get-currency.js";
import { TokenDisplayElement } from "@crownfi/sei-webui-utils";

export class TreasuryChests extends TreasuryChestsComponentAutogen {
  private loader = '<img class="loading-spinner" width="32" />';
  private error = '<span class="cicon cicon-size-medium cicon-cry"></span>';

  setValue(el: TokenDisplayElement, currency: string, value: bigint) {
    if (value < 0n) {
      el.denom = "";
      el.amount = "";
      el.innerHTML = this.error;
      return;
    }
    el.denom = currency;
    el.amount = value;
  }

  async refresh(currency = getCurrency()) {
    this.refs.tvlAmount.innerHTML = this.loader;
    this.refs.tvtAmount.innerHTML = this.loader;
    this.refs.tvlLastDayAmount.innerHTML = this.loader;

    const summary = await swapService.getNetworkSummary(currency);
    console.log("summary", summary)

    this.setValue(this.refs.tvlAmount, currency, summary.totalValueLocked);
    this.setValue(this.refs.tvtAmount, currency, summary.totalVolumeTraded);
    this.setValue(this.refs.tvlLastDayAmount, currency, summary.lastDayTotalValueLocked);
  }

  async connectedCallback() {
    this.refresh();

    document.addEventListener("currencySelected", ev => {
      this.refresh(ev.detail.denom);
    });
  }
}

TreasuryChests.registerElement();