import { q } from "@aritz-cracker/browser-utils";
import { HTMLDivTransitionfulElement } from "@crownfi/css-gothic-fantasy";
import { SwapComponent } from "../exports.js";
import { FarmComponent } from "../farm/farm.js";
import { AppContainerComponentAutogen } from "./_autogen/app-container.js";

export class AppContainer extends AppContainerComponentAutogen {
  constructor() {
    super();
  }

  connectedCallback() {
    this.listenToTabChanged();
    this.refs.appTabs.setAttribute("selected-value", "farm");
  }

  listenToTabChanged() {
    this.refs.appTabs.addEventListener("fantasyTabSelected", ev => {
      const tab = ev.detail.value;
      const transitionContainer = q("#transition-container") as HTMLDivTransitionfulElement;
      const element = tab === "swap" ? new SwapComponent() : new FarmComponent();
      transitionContainer.transitionSwapLastElement(element, "none");
    });
  }
}

AppContainer.registerElement();