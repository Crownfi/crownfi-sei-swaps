import { MOBILE_BREAKPOINT } from "../../../lib/constants.js";
import { NavbarComponentAutogen } from "./_autogen/navbar.js";

export class NavbarComponent extends NavbarComponentAutogen {
  private observer: ResizeObserver;
  private isMobile: boolean | null;

  constructor() {
    super();
    this.isMobile = null;
    this.observer = new ResizeObserver(entries => this.reactToResize(entries));
  }

  reactToResize(entries: ResizeObserverEntry[]) {
    const firstEntry = entries.at(0);
    if (!firstEntry)
      return;
    const isMobile = firstEntry?.contentRect.width <= MOBILE_BREAKPOINT;
    if (this.isMobile !== null && isMobile === this.isMobile)
      return;
    const dropdownMenu = this.refs.walletButton.querySelector('dropdown-menu');
    if (dropdownMenu)
      dropdownMenu?.setAttribute("open-position", isMobile ? "element-top-centered" : "element-bottom-centered");
  }

  connectedCallback() {
    this.observer.observe(window.document.body)
  }

  disconnectedCallback() {
    this.observer.disconnect();
  }
}

NavbarComponent.registerElement();