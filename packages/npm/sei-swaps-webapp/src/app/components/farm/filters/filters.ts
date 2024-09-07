import { DebouncedCallbacks } from "../../../../lib/debounced-callbacks.js";
import { FarmFiltersComponentAutogen } from "./_autogen/filters.js";

export type FarmFiltersEventDetail = {
  myPools: boolean;
  crownfiEndorsed: boolean;
};

export type FarmFiltersEvent = CustomEvent<FarmFiltersEventDetail>;

declare global {
	interface GlobalEventHandlersEventMap {
		"farmFiltersEvent": FarmFiltersEvent
	}
}

export class FarmFiltersComponent extends FarmFiltersComponentAutogen {
  debouncedCallbacks: DebouncedCallbacks;

  constructor() {
    super();
    this.debouncedCallbacks = new DebouncedCallbacks();
  }

  dispatchFilterEvent() {
    const myPools = this.refs.myPools.checked;
    const crownfiEndorsed = this.refs.crownfiEndorsed.checked;

    const debouncedDispatch = this.debouncedCallbacks.debounce(() => {
      this.dispatchEvent(new CustomEvent("farmFiltersEvent", { 
        detail: {
          myPools,
          crownfiEndorsed,
        },
        bubbles: true,
      }));
    });

    debouncedDispatch();
  }

  connectedCallback() {
    this.classList.add("button", "fantasy", "row", "gap-1");

    this.refs.myPools.addEventListener("change", ev => {
      this.dispatchFilterEvent();
    });
  }
}

FarmFiltersComponent.registerElement();