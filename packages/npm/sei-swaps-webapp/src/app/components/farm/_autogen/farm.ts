// auto-generated by C.E.W.T.
// DO NOT EDIT BY HAND!!
export class EmptySeparatorRefs {
	#element: HTMLElement | ShadowRoot;
	constructor(element: HTMLElement | ShadowRoot) {
		this.#element = element;
	}
}
let _templateEmptySeparator: HTMLTemplateElement | null = null;
function getEmptySeparatorTemplate(): HTMLTemplateElement {
	if (_templateEmptySeparator == null) {
		 _templateEmptySeparator = document.createElement("template")
		 _templateEmptySeparator.innerHTML = "\n  <td style=\"padding: 4px; background: transparent;\" colspan=\"7\"></td>\n";
	}
	return _templateEmptySeparator;
}
export class EmptySeparatorAutogen extends HTMLTableRowElement {
	readonly refs: EmptySeparatorRefs;
	constructor() {
		super();
		if (this.childElementCount == 0) {
			this.appendChild(
				getEmptySeparatorTemplate()
					.content
					.cloneNode(true)
			);
		}
		this.setAttribute("is", "empty-separator"); // allow for easy query selecting
		this.refs = new EmptySeparatorRefs(this);
	}
	connectedCallback() {
		// To be overridden by child class
	}
	disconnectedCallback() {
		// To be overridden by child class
	}
	adoptedCallback() {
		// To be overridden by child class
	}
	public static registerElement() {
		customElements.define("empty-separator", this, { extends: "tr"});
	}
}
export class FilterSeparatorRefs {
	#element: HTMLElement | ShadowRoot;
	constructor(element: HTMLElement | ShadowRoot) {
		this.#element = element;
	}
}
let _templateFilterSeparator: HTMLTemplateElement | null = null;
function getFilterSeparatorTemplate(): HTMLTemplateElement {
	if (_templateFilterSeparator == null) {
		 _templateFilterSeparator = document.createElement("template")
		 _templateFilterSeparator.innerHTML = "\n  <td style=\"padding: 4px; background: transparent;\" colspan=\"7\">\n    <hr class=\"pattern-stretch-auto\">\n  </td>\n";
	}
	return _templateFilterSeparator;
}
export class FilterSeparatorAutogen extends HTMLTableRowElement {
	readonly refs: FilterSeparatorRefs;
	constructor() {
		super();
		if (this.childElementCount == 0) {
			this.appendChild(
				getFilterSeparatorTemplate()
					.content
					.cloneNode(true)
			);
		}
		this.setAttribute("is", "filter-separator"); // allow for easy query selecting
		this.refs = new FilterSeparatorRefs(this);
	}
	connectedCallback() {
		// To be overridden by child class
	}
	disconnectedCallback() {
		// To be overridden by child class
	}
	adoptedCallback() {
		// To be overridden by child class
	}
	public static registerElement() {
		customElements.define("filter-separator", this, { extends: "tr"});
	}
}
export class FarmComponentRefs {
	#element: HTMLElement | ShadowRoot;
	constructor(element: HTMLElement | ShadowRoot) {
		this.#element = element;
	}
	#searchInput?: HTMLInputElement;
	get searchInput() {
		if (this.#searchInput === undefined) {
			this.#searchInput = this.#element.querySelector("[cewt-ref=\"search-input\"]:not(:scope [is] *)")!;
		}
		return this.#searchInput;
	}
	#filterButton?: HTMLButtonElement;
	get filterButton() {
		if (this.#filterButton === undefined) {
			this.#filterButton = this.#element.querySelector("[cewt-ref=\"filter-button\"]:not(:scope [is] *)")!;
		}
		return this.#filterButton;
	}
	#sortBy?: HTMLButtonElement;
	get sortBy() {
		if (this.#sortBy === undefined) {
			this.#sortBy = this.#element.querySelector("[cewt-ref=\"sort-by\"]:not(:scope [is] *)")!;
		}
		return this.#sortBy;
	}
	#poolsList?: HTMLTableSectionElement;
	get poolsList() {
		if (this.#poolsList === undefined) {
			this.#poolsList = this.#element.querySelector("[cewt-ref=\"pools-list\"]:not(:scope [is] *)")!;
		}
		return this.#poolsList;
	}
}
let _templateFarmComponent: HTMLTemplateElement | null = null;
function getFarmComponentTemplate(): HTMLTemplateElement {
	if (_templateFarmComponent == null) {
		 _templateFarmComponent = document.createElement("template")
		 _templateFarmComponent.innerHTML = "\n  <div class=\"mb-4\">\n    <div is=\"treasury-chests-component\"></div>\n  </div>\n\n  <div class=\"row mb-4 align-items-center justify-content-between\">\n    <div class=\"row gap-1 align-items-center\">\n      <div class=\"fantasy-input-group search\">\n        <span></span>\n        <input type=\"text\" placeholder=\"Search...\" cewt-ref=\"search-input\">\n        <span class=\"cicon cicon-fantasy-search cicon-size-small primary cicon-gradient\"></span>\n      </div>\n  \n      <button is=\"farm-filters-component\" cewt-ref=\"filter-button\"></button>\n    </div>\n\n    <button is=\"sort-by-component\" cewt-ref=\"sort-by\"></button>\n  </div>\n\n  <table>\n    <thead>\n      <tr>\n        <th class=\"overlapping-icons\">\n          <i class=\"cicon cicon-size-xsmall cicon-fantasy-crown primary\"></i>\n          <i class=\"cicon cicon-size-xsmall cicon-fantasy-crown primary\"></i>\n        </th>\n\n        <th>\n          Pools\n        </th>\n\n        <th>\n          Exchange Rate\n        </th>\n\n        <th>\n          Total Deposits\n        </th>\n\n        <th>\n          Fee Rate\n        </th>\n\n        <th>\n          APY\n        </th>\n\n        <th></th>\n      </tr>\n    </thead>\n\n    <tbody cewt-ref=\"pools-list\">\n      \n    </tbody>\n  </table>\n";
	}
	return _templateFarmComponent;
}
export class FarmComponentAutogen extends HTMLDivElement {
	readonly refs: FarmComponentRefs;
	constructor() {
		super();
		if (this.childElementCount == 0) {
			this.appendChild(
				getFarmComponentTemplate()
					.content
					.cloneNode(true)
			);
		}
		this.setAttribute("is", "farm-component"); // allow for easy query selecting
		this.refs = new FarmComponentRefs(this);
	}
	connectedCallback() {
		// To be overridden by child class
	}
	disconnectedCallback() {
		// To be overridden by child class
	}
	adoptedCallback() {
		// To be overridden by child class
	}
	public static registerElement() {
		customElements.define("farm-component", this, { extends: "div"});
	}
}
