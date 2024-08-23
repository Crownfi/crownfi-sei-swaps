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
  }

  toggleAmountLoading(type: "balance" | "available", loading: boolean) {
    // const { amount, spinner } = {
    //   balance: {
    //     amount: this.refs.balanceAmount,
    //     spinner: this.refs.balanceAmountSpinner,
    //   },
    //   available: {
    //     amount: this.refs.availableAmount,
    //     spinner: this.refs.availableAmountSpinner,
    //   },
    // }[type];

    // if (loading) {
    //   spinner.style.display = "block";
    //   amount.style.display = "none";
    // } else {
    //   spinner.style.display = "none";
    //   amount.style.display = "block";
    // }
  }

  async refreshAmount(type: "balance" | "available") {
    // const from = this.fromToken.getAttribute("token");
    // // const to = this.toToken.getAttribute("token");
    // if (!from) return;
    // if (type === "balance") {
    //   this.fromToken.setLoadingBalance(true);
    //   const { raw } = await useGetBalance(from);
    //   this.fromToken.balance = raw.toString();
    //   this.fromToken.setLoadingBalance(false);
    // } 
    //else {
    //   if (!to) return;
    //   const availableAmount = await swapService.getAvailableAmountForSwap(from, to);
    //   this.toToken.referenceAmount = availableAmount;
    //   this.refs.availableAmount.innerHTML = UIAmount(availableAmount, this.toToken.getAttribute("token")!, true);
    // }
  }

  async updateTokenAndOptions(
    from: string = this.fromToken.getAttribute("token") || "", 
    to: string = this.toToken.getAttribute("token") || "",
  ) {
    const isSameFrom = from === this.fromToken.getAttribute("token");
    const isSameTo = to === this.toToken.getAttribute("token");
    if (isSameFrom && isSameTo)
      return;
    this.toggleAmountLoading("balance", true);
    this.toggleAmountLoading("available", true);
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
    await this.refreshAmount("balance");
    await this.refreshAmount("available");
    this.toggleAmountLoading("balance", false);
    this.toggleAmountLoading("available", false);
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
  }
}

SwapComponent.registerElement();