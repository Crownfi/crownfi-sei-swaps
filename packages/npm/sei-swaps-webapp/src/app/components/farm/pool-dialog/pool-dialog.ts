import { SwapMarketPair } from "@crownfi/sei-swaps-sdk";
import { bigIntToStringDecimal, BigIntCoin } from "@crownfi/sei-utils";

import { PoolDialogComponentAutogen } from "./_autogen/pool-dialog.js";
import { useGetTokenInfo } from "../../../../hooks/use-get-token-info.js";
import { swapService } from "../../../index.js";
import { DepositForm } from "./deposit-form/deposit-form.js";
import { WithdrawForm } from "./withdraw-form/withdraw-form.js";
import { getCurrency } from "../../../../utils/get-currency.js";

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
    const currency = getCurrency();
    const fromDenom = this.poolPair.unwrappedAssets[0];
    const toDenom = this.poolPair.unwrappedAssets[1];

    const fromTokenInfo = await useGetTokenInfo(fromDenom);
    this.refs.fromSymbol.innerText = fromTokenInfo.symbol;
    this.refs.fromName.innerText = fromTokenInfo.name;
    this.refs.fromIcon.setAttribute("denom", fromTokenInfo.base);
    this.refs.exchangeRateFromIcon.setAttribute("denom", fromDenom);
    this.refs.exchangeRateFromAmount.innerText = swapService.getExchangeRate(fromDenom, toDenom).toFixed(5);
    this.refs.totalDepositsFromIcon.setAttribute("denom", fromDenom);
    this.refs.totalDepositsFromAmount.innerText = bigIntToStringDecimal(this.poolPair.totalDeposits[0], fromTokenInfo.decimals, true);

    const [fromDepositNormalized, toDepositNormalized] = await Promise.all([
      swapService.getNormalizedValue(new BigIntCoin({
        denom: fromDenom,
        amount: this.poolPair.totalDeposits[0]
      }), currency),
      swapService.getNormalizedValue(new BigIntCoin({
        denom: toDenom,
        amount: this.poolPair.totalDeposits[1]
      }), currency)
    ]);

    this.refs.totalDepositsNormalized.amount = (fromDepositNormalized + toDepositNormalized);
    this.refs.totalDepositsNormalized.denom = currency;
    
    const toTokenInfo = await useGetTokenInfo(toDenom);
    this.refs.toSymbol.innerText = toTokenInfo.symbol;
    this.refs.toName.innerText = toTokenInfo.name;
    this.refs.toIcon.setAttribute("denom", toTokenInfo.base);
    this.refs.exchangeRateToIcon.setAttribute("denom", toDenom);
    this.refs.exchangeRateToAmount.innerText = swapService.getExchangeRate(toDenom, fromDenom).toFixed(5);
    this.refs.totalDepositsToIcon.setAttribute("denom", toDenom);
    this.refs.totalDepositsToAmount.innerText = bigIntToStringDecimal(this.poolPair.totalDeposits[1], toTokenInfo.decimals, true);

    const sharesTokenInfo = await useGetTokenInfo(this.poolPair.sharesDenom);
    this.refs.poolSharesValue.innerText = bigIntToStringDecimal(this.poolPair.totalShares, sharesTokenInfo.decimals, true);
    const sharesValues = this.poolPair.shareValue(this.poolPair.totalShares);
    this.refs.shareValueFromIcon.setAttribute("denom", fromDenom);
    this.refs.shareValueFromAmount.innerText = bigIntToStringDecimal(sharesValues[0][0], fromTokenInfo.decimals, true);
    this.refs.shareValueToIcon.setAttribute("denom", toDenom);
    this.refs.shareValueToAmount.innerText = bigIntToStringDecimal(sharesValues[1][0], toTokenInfo.decimals, true);

    const [fromShareNormalized, toShareNormalized] = await Promise.all([
      swapService.getNormalizedValue(new BigIntCoin({
        denom: fromDenom,
        amount: sharesValues[0][0]
      }), currency),
      swapService.getNormalizedValue(new BigIntCoin({
        denom: toDenom,
        amount: sharesValues[1][0]
      }), currency)
    ]);

    this.refs.shareValuesNormalized.amount = (fromShareNormalized + toShareNormalized);
    this.refs.shareValuesNormalized.denom = currency;
  }

  async connectedCallback() {
    await this.renderData();
    this.showDepositForm();
  }
}

PoolDialogComponent.registerElement();