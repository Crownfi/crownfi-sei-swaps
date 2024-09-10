import { SwapMarketPair } from "@crownfi/sei-swaps-sdk";
import { DepositFormComponentAutogen } from "./_autogen/deposit-form.js";
import { useGetBalance, UseGetBalanceOutput } from "../../../../../hooks/use-get-balance.js";

export class DepositForm extends DepositFormComponentAutogen {
  private fromBalance: UseGetBalanceOutput;
  private toBalance: UseGetBalanceOutput;

  constructor(readonly poolPair: SwapMarketPair) {
    super();
    this.fromBalance = { raw: 0n, decimal: "0" };
    this.toBalance = { raw: 0n, decimal: "0" };

    this.setListeners();
  }

  setListeners() {
    this.refs.fromMax.addEventListener("click", () => {
      this.refs.fromDepositAmount.value = this.fromBalance.decimal;
    });

    this.refs.toMax.addEventListener("click", () => {
      this.refs.toDepositAmount.value = this.toBalance.decimal;
    });
  }

  async refreshBalances() {
    const fromBalance = await useGetBalance(this.poolPair.assets[0]);
    this.refs.fromBalance.denom = this.poolPair.assets[0];
    this.refs.fromBalance.amount = fromBalance.raw;
    this.fromBalance = fromBalance;

    const toBalance = await useGetBalance(this.poolPair.assets[1]);
    this.refs.toBalance.denom = this.poolPair.assets[1];
    this.refs.toBalance.amount = toBalance.raw;
    this.toBalance = toBalance;
  }

  async connectedCallback() {
    await this.poolPair.refresh();
    await this.refreshBalances();
  }
}

DepositForm.registerElement();