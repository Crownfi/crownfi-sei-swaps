import { seiUtilEventEmitter } from "@crownfi/sei-utils";
import { useGetAccount } from "../../../hooks/use-get-account.js";
import { getTokensFromPairs } from "../../../utils/tokens-from-pairs.js";
import { swapService } from "../../index.js";
import { SwapFromTokenChangedAmountEventDetails, SwapFromTokenComponent } from "../exports.js";
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
    this.setInputsDisabled(true);
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

  async handleAmountChangedEvent(details: SwapFromTokenChangedAmountEventDetails) {
    const { denom, amount, isValid } = details;

    if (!denom || !this.toToken.token || !isValid || amount === 0n) {
      this.toToken.slippage = "0";
      this.toToken.amount = "0";
      this.refs.swapButton.setAttribute("disabled", "");
      return;
    }

    try {
      this.toToken.setLoading(true);

      const simulateSwapResult = await swapService.simulateSwap(denom, this.toToken.token, amount);

      this.toToken.slippage = simulateSwapResult.slip_amount;
      this.toToken.amount = simulateSwapResult.result_amount;

      this.refs.swapButton.removeAttribute("disabled");
    } finally {
      this.toToken.setLoading(false);
    }
  }

  setSwapButtonDisabled(isDisabled: boolean) {
    if (isDisabled)
      this.refs.swapButton.setAttribute("disabled", "");
    else
      this.refs.swapButton.removeAttribute("disabled");
  }

  setInputsDisabled(isDisabled: boolean) {
    this.fromToken.setDisabled(isDisabled);
    this.toToken.setDisabled(isDisabled);
  }

  setSwapButtonLoading(isLoading: boolean) {
    if (isLoading) {
      this.setInputsDisabled(true);
      this.setSwapButtonDisabled(true);
      this.refs.swapButtonSpinner.style.display = "block";
      return;
    }
    this.setInputsDisabled(false);
    this.setSwapButtonDisabled(false);
    this.refs.swapButtonSpinner.style.display = "none";
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

    this.addEventListener("swapFromTokenChangedAmount", ev => {
      this.handleAmountChangedEvent(ev.detail);
    });

    this.refs.swapButton.addEventListener("click", async () => {
      const account = await useGetAccount();
      if (!account.isConnected)
        return;
      this.setSwapButtonLoading(true);
      await swapService.executeSwap(this.fromToken.token!, this.toToken.token!, this.fromToken.amount, account.seiAddress!);
      this.fromToken.refreshBalance();
      this.fromToken.setDefaults();
      this.toToken.setDefaults();
      this.setSwapButtonLoading(false);
      this.setSwapButtonDisabled(true);
    });

    seiUtilEventEmitter.on("defaultProviderChanged", ({ account }) => {
      if (account)
        this.setInputsDisabled(false);
      else
        this.setInputsDisabled(true);
    });
  }
}

SwapComponent.registerElement();