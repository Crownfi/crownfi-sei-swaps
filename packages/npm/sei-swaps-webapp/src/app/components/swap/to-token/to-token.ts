import { SwapToComponentAutogen } from "./_autogen/to-token.js";

export class SwapToComponent extends SwapToComponentAutogen {
  setLoading(isLoading: boolean) {
    if (isLoading) {
      this.refs.slippageAmount.innerText = "";
      this.refs.slippageAmount.classList.add("loading-spinner-inline");
      this.refs.toAmount.value = "0";
    } else {
      this.refs.slippageAmount.classList.remove("loading-spinner-inline");
    }
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