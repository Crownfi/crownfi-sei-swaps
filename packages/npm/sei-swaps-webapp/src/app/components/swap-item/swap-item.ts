import { DropdownMenuItemElement } from "dropdown-menu-element";
import { SwapItemComponentAutogen } from "./_autogen/swap-item.js";
import { TokenDisplayElement } from "@crownfi/sei-webui-utils";

export class SwapItemComponent extends SwapItemComponentAutogen {
  constructor() {
    super();
  }

  onTokenChanged(oldValue: string, newValue: string) {
    this.refs.selectedToken.setAttribute("denom", newValue);
  }

  onTokensChanged(oldValue: string, newValue: string): void {
    const tokens = newValue.split(",");
    this.refs.tokensDropdown.innerHTML = "";

    for (const token of tokens) {
      const option = new DropdownMenuItemElement();
      const tokenDisplay = new TokenDisplayElement();

      tokenDisplay.setAttribute("denom", token);
      option.value = token;
      option.appendChild(tokenDisplay);
      this.refs.tokensDropdown.appendChild(option);
    }
  }
}

SwapItemComponent.registerElement();