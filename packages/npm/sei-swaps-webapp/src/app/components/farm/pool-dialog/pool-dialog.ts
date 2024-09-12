import { SwapMarketPair } from "@crownfi/sei-swaps-sdk";
import { PoolDialogComponentAutogen } from "./_autogen/pool-dialog.js";
import { useGetTokenInfo } from "../../../../hooks/use-get-token-info.js";
import { bigIntToStringDecimal, stringDecimalToBigInt } from "@crownfi/sei-utils";
import { swapService } from "../../../index.js";
import { DepositForm } from "./deposit-form/deposit-form.js";
import { WithdrawForm } from "./withdraw-form/withdraw-form.js";

export class PoolDialogComponent extends PoolDialogComponentAutogen {
  constructor(readonly poolPair: SwapMarketPair) {
    super();

    this.setListeners();
  }

  showDepositForm() {
    this.refs.formContainer.innerHTML = '';
    this.refs.formContainer.appendChild(new DepositForm(this.poolPair));
  }

  showWithdrawForm() {
    this.refs.formContainer.innerHTML = '';
    this.refs.formContainer.appendChild(new WithdrawForm(this.poolPair));
  }

  setListeners() {
    this.addEventListener("close", () => {
      this.remove();
    });

    this.refs.closeButton.addEventListener("click", () => {
      this.close();
    });

    this.refs.operationDeposit.addEventListener("change", ev => {
      if ((ev.target as HTMLInputElement).checked)
        this.showDepositForm();
    });

    this.refs.operationWithdraw.addEventListener("change", ev => {
      if ((ev.target as HTMLInputElement).checked)
        this.showWithdrawForm();
    });

    this.addEventListener("depositFinished", () => {
      this.renderData();
    });

    this.addEventListener("withdrawFinished", () => {
      this.renderData();
    });
  }

  async renderData() {
    await this.poolPair.refresh();
    const fromDenom = this.poolPair.assets[0];
    const toDenom = this.poolPair.assets[1];

    const fromTokenInfo = await useGetTokenInfo(this.poolPair.assets[0]);
    const exchangeRateFrom = stringDecimalToBigInt(swapService.getExchangeRate(fromDenom, toDenom), fromTokenInfo.decimals);
    this.refs.fromSymbol.innerText = fromTokenInfo.symbol;
    this.refs.fromName.innerText = fromTokenInfo.name;
    this.refs.fromIcon.setAttribute("denom", fromTokenInfo.base);
    this.refs.exchangeRateFrom.denom = fromDenom;
    this.refs.exchangeRateFrom.amount = exchangeRateFrom;
    this.refs.totalDepositsFrom.denom = fromDenom;
    this.refs.totalDepositsFrom.amount = this.poolPair.totalDeposits[0];
    
    const toTokenInfo = await useGetTokenInfo(this.poolPair.assets[1]);
    const exchangeRateTo = stringDecimalToBigInt(swapService.getExchangeRate(toDenom, fromDenom), toTokenInfo.decimals);
    this.refs.toSymbol.innerText = toTokenInfo.symbol;
    this.refs.toName.innerText = toTokenInfo.name;
    this.refs.toIcon.setAttribute("denom", toTokenInfo.base);
    this.refs.exchangeRateTo.denom = toDenom;
    this.refs.exchangeRateTo.amount = exchangeRateTo;
    this.refs.totalDepositsTo.denom = toDenom;
    this.refs.totalDepositsTo.amount = this.poolPair.totalDeposits[1];

    const sharesTokenInfo = await useGetTokenInfo(this.poolPair.sharesDenom);
    this.refs.poolSharesValue.innerText = bigIntToStringDecimal(this.poolPair.totalShares, sharesTokenInfo.decimals);
    const sharesValues = this.poolPair.shareValue(this.poolPair.totalShares);
    this.refs.shareValueFrom.denom = fromDenom;
    this.refs.shareValueFrom.amount = sharesValues[0][0];
    this.refs.shareValueTo.denom = toDenom;
    this.refs.shareValueTo.amount = sharesValues[1][0];
  }

  async connectedCallback() {
    await this.renderData();
    this.showDepositForm();
  }
}

PoolDialogComponent.registerElement();