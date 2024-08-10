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
      this.refs.appContent.innerHTML = ev.detail.value || "";
    });
  }
}

AppContainer.registerElement();