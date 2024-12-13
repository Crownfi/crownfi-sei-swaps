import { bigIntToStringDecimal } from "@crownfi/sei-utils";
import { SwapToComponentAutogen } from "./_autogen/to-token.js";

export class SwapToComponent extends SwapToComponentAutogen {
  decimals: number;

  constructor() {
    super();
    this.decimals = 6;
  }

  setLoading(isLoading: boolean) {
    if (isLoading) {
      this.refs.slippageAmount.innerText = "";
      this.refs.slippageAmount.classList.add("loading-spinner-inline");
      this.refs.toAmount.value = "0";
    } else {
      this.refs.slippageAmount.classList.remove("loading-spinner-inline");
    }
  }

  setDisabled(isDisabled: boolean) {
    if (isDisabled) {
      this.refs.dropdown.setAttribute("disabled", "");
      return;
    }
    this.refs.dropdown.removeAttribute("disabled");
  }

  setDefaults() {
    this.slippage = "0";
    this.amount = "0";
  }

  onSlippageChanged() {
    if (this.slippage === null)
      return;
    this.refs.slippageAmount.innerText = bigIntToStringDecimal(BigInt(this.slippage), this.decimals, true);
  }

  onAmountChanged() {
    if (this.amount === null)
      return;
    this.refs.toAmount.value = bigIntToStringDecimal(BigInt(this.amount), this.decimals, true);
  }

  onTokenChanged() {
    if (!this.token)
      return;
    this.refs.dropdown.setAttribute("selected", this.token);
  }

  onTokensChanged() {
    if (!this.tokens)
      return;
    this.refs.dropdown.setAttribute("options", this.tokens);
  }
}

SwapToComponent.registerElement();