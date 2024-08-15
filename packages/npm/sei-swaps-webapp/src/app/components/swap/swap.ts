import { getTokensFromPairs } from "../../../utils/tokens-from-pairs.js";
import { swapService } from "../../index.js";
import { SwapItemComponent } from "../exports.js";
import { SwapComponentAutogen } from "./_autogen/swap.js";

export class SwapComponent extends SwapComponentAutogen {
  private fromToken: SwapItemComponent;
  private toToken: SwapItemComponent;
  private tokens: string[];

  constructor() {
    super();
    this.fromToken = new SwapItemComponent();
    this.toToken = new SwapItemComponent();
    this.tokens = [];
  }

  updateTokenAndOptions(
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
    this.refs.fromToken.innerHTML = "";
    this.refs.fromToken.appendChild(this.fromToken);
    this.refs.toToken.innerHTML = "";
    this.refs.toToken.appendChild(this.toToken);
  }

  async connectedCallback() {
    const pairs = await swapService.getPairs();
    this.tokens = getTokensFromPairs(pairs);
    this.updateTokenAndOptions(this.tokens[0], this.tokens[1]);
    this.addEventListener("dropdownSelect", ev => {
      const isFrom = (ev.target as HTMLElement).parentElement?.parentElement === this.fromToken;
      const value = ev.detail.selectedValue;
      this.updateTokenAndOptions(isFrom && value || undefined, !isFrom && value || undefined);
    });
  }
}

SwapComponent.registerElement();