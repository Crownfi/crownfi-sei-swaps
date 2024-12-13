import { confirm } from "@crownfi/css-gothic-fantasy";

import { ConfirmSwapDialogComponentAutogen } from "./_autogen/confirm-swap.js";
import { Coin } from "@crownfi/sei-swaps-sdk";

type ConfirmSwapDialogConfirmProps = {
  from: Coin,
  to: Coin,
};

export class ConfirmSwapDialog extends ConfirmSwapDialogComponentAutogen {
  static async confirm({ from, to }: ConfirmSwapDialogConfirmProps) {
    const dialog = new ConfirmSwapDialog();

    dialog.refs.from.denom = from.denom;
    dialog.refs.from.amount = from.amount;
    dialog.refs.to.denom = to.denom;
    dialog.refs.to.amount = to.amount;

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