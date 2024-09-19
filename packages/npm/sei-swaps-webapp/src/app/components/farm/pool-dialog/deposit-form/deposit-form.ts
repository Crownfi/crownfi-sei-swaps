import { SwapMarketPair } from "@crownfi/sei-swaps-sdk";
import { BigIntCoin, UIAmount, stringDecimalToBigInt } from "@crownfi/sei-utils";
import { msgBoxIfThrow } from "@crownfi/css-gothic-fantasy";

import { swapService } from "../../../../index.js";
import { DepositFormComponentAutogen } from "./_autogen/deposit-form.js";
import { useGetBalance, UseGetBalanceOutput } from "../../../../../hooks/use-get-balance.js";
import { DebouncedCallbacks } from "../../../../../lib/debounced-callbacks.js";
import { useGetAccount } from "../../../../../hooks/use-get-account.js";
import { useGetTokenInfo } from "../../../../../hooks/use-get-token-info.js";

type DepositFinishedEventDetails = {
  offerFrom: BigIntCoin;
  offerTo: BigIntCoin;
};

export type DepositFinishedEvent = CustomEvent<DepositFinishedEventDetails>;

declare global {
	interface GlobalEventHandlersEventMap {
		"depositFinished": DepositFinishedEvent
	}
}

export class DepositForm extends DepositFormComponentAutogen {
  private fromBalance: UseGetBalanceOutput;
  private toBalance: UseGetBalanceOutput;
  private debouncedCallbacks: DebouncedCallbacks;

  constructor(readonly poolPair: SwapMarketPair) {
    super();
    this.fromBalance = { raw: 0n, decimal: "0" };
    this.toBalance = { raw: 0n, decimal: "0" };
    this.debouncedCallbacks = new DebouncedCallbacks();

    this.setListeners();
  }

  get denoms() {
    return {
      from: this.poolPair.unwrappedAssets[0],
      to: this.poolPair.unwrappedAssets[1],
    }
  }

  setDefaults() {
    this.refs.fromDepositAmount.value = "0";
    this.refs.toDepositAmount.value = "0";
    this.refs.sharesAmount.value = "0";
    this.refs.submitButton.disabled = true;
  }

  setListeners() {
    const debouncedCalculateShares = this.debouncedCallbacks.debounce(() => {
      this.calculateShares();
    });

    this.refs.fromMax.addEventListener("click", () => {
      this.refs.fromDepositAmount.value = this.fromBalance.decimal;
    });

    this.refs.toMax.addEventListener("click", () => {
      this.refs.toDepositAmount.value = this.toBalance.decimal;
    });

    this.refs.fromDepositAmount.addEventListener("input", () => {
      debouncedCalculateShares();
    });

    this.refs.fromDepositAmount.addEventListener("change", () => {
      debouncedCalculateShares();
    });

    this.refs.toDepositAmount.addEventListener("input", () => {
      debouncedCalculateShares();
    });

    this.refs.toDepositAmount.addEventListener("change", () => {
      debouncedCalculateShares();
    });

    this.addEventListener("submit", async () => {
      msgBoxIfThrow(async () => {
        const account = await useGetAccount();
        if (!account.isConnected || !account?.seiAddress)
          return;
        try {
          const fromInfo = await useGetTokenInfo(this.denoms.from);
          const toInfo = await useGetTokenInfo(this.denoms.to);
          const fromAmount = stringDecimalToBigInt(this.refs.fromDepositAmount.value, fromInfo.decimals);
          const toAmount = stringDecimalToBigInt(this.refs.toDepositAmount.value, toInfo.decimals);
          if (!fromAmount || !toAmount)
            throw new Error("Invalid amounts");
          const offerFrom = new BigIntCoin(fromAmount, this.denoms.from);
          const offerTo = new BigIntCoin(toAmount, this.denoms.to);
          await swapService.executeDeposit(
            offerFrom,
            offerTo,
          );
          await this.refreshBalances();
          this.dispatchEvent(new CustomEvent("depositFinished", { detail: { offerFrom, offerTo }, bubbles: true }));
          this.setDefaults();
        } finally {
          await this.refreshBalances();
        }
      });
    });
  }

  async calculateShares() {
    if (!this.refs.fromDepositAmount.value || !this.refs.toDepositAmount.value) {
      this.refs.submitButton.disabled = true;
      this.refs.sharesAmount.value = "0";
      return;
    }
    this.refs.submitButton.disabled = false;
    const shares = (await swapService.simulateDeposit(
      new BigIntCoin(this.refs.fromDepositAmount.value, this.denoms.from),
      new BigIntCoin(this.refs.toDepositAmount.value, this.denoms.to),
    )).newShares;
    this.refs.sharesAmount.value = UIAmount(shares, this.poolPair.sharesDenom, true, false);
  }

  async refreshBalances() {
    const fromBalance = await useGetBalance(this.denoms.from);
    this.refs.fromBalance.denom = this.denoms.from;
    this.refs.fromBalance.amount = fromBalance.raw;
    this.fromBalance = fromBalance;

    const toBalance = await useGetBalance(this.denoms.to);
    this.refs.toBalance.denom = this.denoms.to;
    this.refs.toBalance.amount = toBalance.raw;
    this.toBalance = toBalance;
  }

  async connectedCallback() {
    await this.poolPair.refresh();
    await this.refreshBalances();
  }
}

DepositForm.registerElement();