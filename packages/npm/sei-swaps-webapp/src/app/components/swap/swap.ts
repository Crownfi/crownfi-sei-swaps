import { getTokensFromPairs } from "../../../utils/tokens-from-pairs.js";
import { swapService } from "../../index.js";
import { SwapFromTokenComponent } from "../exports.js";
import { SwapComponentAutogen } from "./_autogen/swap.js";
import { SwapToComponent } from "./to-token/to-token.js";

export class SwapComponent extends SwapComponentAutogen {
  private fromToken: SwapFromTokenComponent;
  private toToken: SwapToComponent;
  private tokens: string[];

  constructor() {
    super();
    this.fromToken = new SwapFromTokenComponent();
    this.toToken = new SwapToComponent();
    this.tokens = [];

    this.refs.fromToken.innerHTML = "";
    this.refs.fromToken.appendChild(this.fromToken);
    this.refs.toToken.innerHTML = "";
    this.refs.toToken.appendChild(this.toToken);
  }

  async updateTokenAndOptions(
    from: string = this.fromToken.getAttribute("token") || "", 
    to: string = this.toToken.getAttribute("token") || "",
  ) {
    const isSameFrom = from === this.fromToken.getAttribute("token");
    const isSameTo = to === this.toToken.getAttribute("token");
    if (isSameFrom && isSameTo)
      return;
    if (!isSameFrom)
      this.fromToken.setAttribute("token", from);
    if (!isSameTo)
      this.toToken.setAttribute("token", to);
    const options = this.tokens.filter(token => token !== from && token !== to);
    this.fromToken.setAttribute("tokens", options.join(","));
    this.toToken.setAttribute("tokens", options.join(","));
  }

  async connectedCallback() {
    const pairs = await swapService.getPairs();
    this.tokens = getTokensFromPairs(pairs);
    this.updateTokenAndOptions(this.tokens[0], this.tokens[1]);
    this.addEventListener("tokenDropdownSelected", ev => {
      const { id, denom } = ev.detail;
      const isFrom = this.fromToken.refs.dropdown.getAttribute("id") === id;
      this.updateTokenAndOptions(isFrom && denom || undefined, !isFrom && denom || undefined);
    });
    this.addEventListener("swapFromTokenChangedAmount", async ev => {
      const { amount, isValid } = ev.detail;
      if (!this.fromToken.token || !this.toToken.token || !isValid || !amount)
        return;
      const simulateSwapResult = await swapService.simulateSwap(this.fromToken.token, this.toToken.token, amount);
      console.log("simulateSwapResult", simulateSwapResult);
    })
  }
}

SwapComponent.registerElement();