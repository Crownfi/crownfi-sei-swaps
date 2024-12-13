import { DropdownMenuItemElement } from "dropdown-menu-element";
import { TokenDropdownComponentAutogen } from "./_autogen/token-dropdown.js";
import { TokenDisplayElement } from "@crownfi/sei-webui-utils";

type TokenDropdownSelectedEventDetails = {
  id: string;
  denom: string;
};

export type TokenDropdownSelectedEvent = CustomEvent<TokenDropdownSelectedEventDetails>;

declare global {
	interface GlobalEventHandlersEventMap {
		"tokenDropdownSelected": TokenDropdownSelectedEvent
	}
}

export class TokenDropdrownComponent extends TokenDropdownComponentAutogen {  
  constructor() {
    super();
  }

  onSelectedChanged(oldValue: string, newValue: string) {
    this.refs.selectedToken.setAttribute("denom", newValue);
  }

  onOptionsChanged(oldValue: string, newValue: string): void {
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

  connectedCallback() {
    const id = this.getAttribute("id");
    this.classList.add("fantasy", "primary");
    this.addEventListener("dropdownOpen", ev => {
      this.refs.arrowIcon.classList.replace("cicon-fantasy-chevron-down", "cicon-fantasy-chevron-up");
    });
    this.addEventListener("dropdownClose", ev => {
      this.refs.arrowIcon.classList.replace("cicon-fantasy-chevron-up", "cicon-fantasy-chevron-down");
    });
    this.addEventListener("dropdownSelect", ev => {
      ev.stopPropagation();
      const denom = ev.detail.selectedValue;
      if (!id || !denom) return;
      const detail = {
        id,
        denom,
      } satisfies TokenDropdownSelectedEventDetails;
      this.dispatchEvent(new CustomEvent("tokenDropdownSelected", { detail, bubbles: true }));
    });
  }
}

TokenDropdrownComponent.registerElement();