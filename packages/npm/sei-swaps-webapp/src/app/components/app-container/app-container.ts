import { SwapComponent } from "../exports.js";
import { AppContainerComponentAutogen } from "./_autogen/app-container.js";

export class AppContainer extends AppContainerComponentAutogen {
  constructor() {
    super();
  }

  connectedCallback() {
    this.listenToTabChanged();

    this.refs.appTabs.setAttribute("selected-value", "swap");
  }

  listenToTabChanged() {
    this.refs.appTabs.addEventListener("fantasyTabSelected", ev => {
      this.refs.appContent.innerHTML = "";

      if (ev.detail.value === "swap") {
        this.refs.appContent.appendChild(new SwapComponent());
      } else
        this.refs.appContent.innerHTML = ev.detail.value || "";
    });
  }
}

AppContainer.registerElement();