import { confirm } from "@crownfi/css-gothic-fantasy";

import { ConfirmSwapDialogComponentAutogen } from "./_autogen/confirm-swap.js";
import { Coin } from "@crownfi/sei-swaps-sdk";

type ConfirmSwapDialogConfirmProps = {
  from: Coin,
  to: Coin,
};

export class ConfirmSwapDialog extends ConfirmSwapDialogComponentAutogen {
  onFromDenomChanged(oldValue: string | null, newValue: string): void {
    this.refs.from.denom = newValue;
  }

  onFromAmountChanged(oldValue: string | null, newValue: string): void {
    this.refs.from.amount = newValue;
  }

  onToDenomChanged(oldValue: string | null, newValue: string): void {
    this.refs.to.denom = newValue;
  }

  onToAmountChanged(oldValue: string | null, newValue: string): void {
    this.refs.to.amount = newValue;
  }

  static async confirm({ from, to }: ConfirmSwapDialogConfirmProps) {
    const dialog = new ConfirmSwapDialog();

    dialog.fromDenom = from.denom;
    dialog.fromAmount = from.amount;
    dialog.toDenom = to.denom;
    dialog.toAmount = to.amount;
    
    return confirm(
      "Swap Details",
      dialog,
      undefined,
      undefined,
      "Cancel",
      "Confirm"
    )
  }
}

ConfirmSwapDialog.registerElement();