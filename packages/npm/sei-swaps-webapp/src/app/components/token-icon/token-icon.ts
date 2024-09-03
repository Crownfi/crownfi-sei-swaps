import { useGetTokenInfo } from "../../../hooks/use-get-token-info.js";

export class TokenIcon extends HTMLImageElement {
  constructor() {
    super();
    this.setAttribute("is", "token-icon");
  }

  static get observedAttributes() {
    return ["denom"];
  }

  get denom() {
    return this.getAttribute("denom");
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (name === "denom" && oldValue !== newValue)
      this.loadIcon();
  }

  async loadIcon() {
    this.classList.add("loading-spinner-inline");
    if (!this.denom)
      return;
    const tokenInfo = await useGetTokenInfo(this.denom);
    this.setAttribute("src", tokenInfo.icon);
    this.classList.remove("loading-spinner-inline");
  }

  async connectedCallback() {
    this.style.height = "24px";
    await this.loadIcon();
  }
}

customElements.define("token-icon", TokenIcon, { extends: "img" });