import { TokenDisplayElement } from "@crownfi/sei-webui-utils";
import { DropdownMenuItemElement } from "dropdown-menu-element";

import { env } from "../../../env/index.js";
import { getTokensFromPairs } from "../../../utils/tokens-from-pairs.js";
import { swapService } from "../../index.js";
import { CurrencySelectorAutogen } from "./_autogen/currency-selector.js";

type CurrencySelectedEventDetails = {
  denom: string;
};

export type CurrencySelectedEvent = CustomEvent<CurrencySelectedEventDetails>;

declare global {
	interface GlobalEventHandlersEventMap {
		"currencySelected": CurrencySelectedEvent
	}
}

export class CurrencySelector extends CurrencySelectorAutogen {
  private _selectedDenom: string = "";

  constructor() {
    super();
    const preferredCurrency = localStorage.getItem("preferred-currency");
    this.selectedDenom = preferredCurrency || env.NORMALIZE_CURRENCY;
  }

  get selectedDenom() {
    return this._selectedDenom;
  }

  set selectedDenom(denom: string) {
    this._selectedDenom = denom;
    localStorage.setItem("preferred-currency", this.selectedDenom);
  }

  handleCurrencyChanged(denom: string) {
    this.selectedDenom = denom;
  }

  async refreshOptions() {
    this.refs.selectedCurrency.denom = this.selectedDenom;
    this.refs.currencySelector.innerHTML = "";
    const denoms = getTokensFromPairs(await swapService.getPairs()).filter(denom => denom !== this.selectedDenom);

    for (const denom of denoms) {
      const option = new DropdownMenuItemElement();
      const tokenDisplay = new TokenDisplayElement();

      tokenDisplay.setAttribute("denom", denom);
      option.value = denom;
      option.appendChild(tokenDisplay);
      this.refs.currencySelector.appendChild(option);
    }
  }

  async connectedCallback() {
    this.dispatchEvent(new CustomEvent("currencySelected", { 
      detail: { denom: this.selectedDenom }, 
      bubbles: true, 
      cancelable: false
    }));

    this.refreshOptions();
    this.addEventListener("dropdownSelect", ev => {
      ev.stopPropagation();
      const denom = ev.detail.selectedValue;
      if (!denom) return;
      this.handleCurrencyChanged(denom);
      this.refreshOptions();
      const detail = { denom } satisfies CurrencySelectedEventDetails;
      this.dispatchEvent(new CustomEvent("currencySelected", { detail, bubbles: true, cancelable: false }));
    });
  }
}

CurrencySelector.registerElement();