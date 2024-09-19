import { SwapMarketPair } from "@crownfi/sei-swaps-sdk";
import { msgBoxIfThrow } from "@crownfi/css-gothic-fantasy";

import { WithdrawFormComponentAutogen } from "./_autogen/withdraw-form.js";
import { DebouncedCallbacks } from "../../../../../lib/debounced-callbacks.js";
import { useGetBalance, UseGetBalanceOutput } from "../../../../../hooks/use-get-balance.js";
import { useGetAccount } from "../../../../../hooks/use-get-account.js";
import { swapService } from "../../../../index.js";
import { stringDecimalToBigInt, UnifiedDenom } from "@crownfi/sei-utils";
import { useGetTokenInfo } from "../../../../../hooks/use-get-token-info.js";

type WithdrawFinishedEventDetails = {
  amount: BigInt;
  denom: UnifiedDenom;
};

export type WithdrawFinishedEvent = CustomEvent<WithdrawFinishedEventDetails>;

declare global {
	interface GlobalEventHandlersEventMap {
		"withdrawFinished": WithdrawFinishedEvent
	}
}

export class WithdrawForm extends WithdrawFormComponentAutogen {
  private debouncedCallbacks: DebouncedCallbacks;
  private sharesBalance: UseGetBalanceOutput;

  constructor(readonly poolPair: SwapMarketPair) {
    super();
    this.sharesBalance = { raw: 0n, decimal: "0" };
    this.debouncedCallbacks = new DebouncedCallbacks();

    this.setListeners();
  }

  get denoms() {
    return {
      from: this.poolPair.unwrappedAssets[0],
      to: this.poolPair.unwrappedAssets[1],
    }
  }

  setListeners() {
    const simulateWithdrawDebounced = this.debouncedCallbacks.debounce(async () => {
      const exceedsBalance = +this.refs.sharesAmountInput.value > +this.sharesBalance.decimal;
      this.refs.submitButton.disabled = exceedsBalance;
      if (!exceedsBalance)
        await this.simulateWithdraw();
      else {
        this.refs.receiveToken0.amount = 0;
        this.refs.receiveToken1.amount = 0;
      }
    });

    this.refs.maxButton.addEventListener("click", () => {
      if (this.refs.sharesAmountInput.value === this.sharesBalance.decimal)
        return;
      this.refs.sharesAmountInput.value = this.sharesBalance.decimal;
      simulateWithdrawDebounced();
    });

    this.refs.sharesAmountInput.addEventListener("change", () => {
      simulateWithdrawDebounced();
    });

    this.refs.sharesAmountInput.addEventListener("input", () => {
      simulateWithdrawDebounced();
    });

    this.addEventListener("submit", () => {
      msgBoxIfThrow(async () => {
        const account = await useGetAccount();
        if (!account.isConnected || !account?.seiAddress)
          return;
        try {
          if (+this.refs.sharesAmountInput.value > +this.sharesBalance.decimal)
            throw new Error("Exceeds Balance");

          const sharesInfo = await useGetTokenInfo(this.poolPair.sharesDenom);
          const withdrawAmount = stringDecimalToBigInt(this.refs.sharesAmountInput.value, sharesInfo.decimals);
          if (!withdrawAmount)
            throw new Error("Invalid Amount");
          await swapService.executeWithdraw(
            this.denoms.from,
            this.denoms.to,
            withdrawAmount,
            account.seiAddress,
          );
          await this.refreshBalance();
          this.setDefaults();
          this.dispatchEvent(new CustomEvent("withdrawFinished", { 
            detail: { amount: withdrawAmount, denom: this.poolPair.sharesDenom },
            bubbles: true
          }));
        } finally {
          await this.refreshBalance();
        }
      });
    });
  }

  setDefaults() {
    this.refs.sharesAmountInput.value = "0";
    this.refs.receiveToken0.amount = 0;
    this.refs.receiveToken1.amount = 0;
    this.refs.submitButton.disabled = true;
  }

  async simulateWithdraw() {
    await this.poolPair.refresh();
		const sharesValue = this.poolPair.shareValue(BigInt(this.refs.sharesAmountInput.value));
    this.refs.receiveToken0.amount = sharesValue[0][0];
    this.refs.receiveToken1.amount = sharesValue[1][0];
  }

  async refreshBalance() {
    const balance = await useGetBalance(this.poolPair.sharesDenom);
    this.sharesBalance = balance;
    this.refs.sharesBalance.innerText = balance.decimal;
  }

  connectedCallback() {
    this.refs.receiveToken0.denom = this.denoms.from;
    this.refs.receiveToken1.denom = this.denoms.to;
    this.refreshBalance();
  }
}

WithdrawForm.registerElement();