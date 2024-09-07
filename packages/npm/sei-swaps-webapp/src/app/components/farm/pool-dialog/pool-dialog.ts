import { SwapMarketPair } from "@crownfi/sei-swaps-sdk";
import { PoolDialogComponentAutogen } from "./_autogen/pool-dialog.js";

export class PoolDialogComponent extends PoolDialogComponentAutogen {
  constructor(readonly poolPair: SwapMarketPair) {
    super();
    this.addEventListener("close", () => {
      this.remove();
    });
  }

  connectedCallback() {
    this.refs.poolName.innerText = this.poolPair.name;
  }
}

PoolDialogComponent.registerElement();