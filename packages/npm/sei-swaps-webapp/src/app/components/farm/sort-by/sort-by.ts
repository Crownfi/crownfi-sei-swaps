import { DebouncedCallbacks } from "../../../../lib/debounced-callbacks.js";
import { SortByComponentAutogen } from "./_autogen/sort-by.js";

export type SortBy = "alphabetical" | "tvd" | "uvd" | "apy" | "fees";

type SortByEventDetails = {
  sortBy: SortBy;
};

export type SortByEvent = CustomEvent<SortByEventDetails>;

declare global {
	interface GlobalEventHandlersEventMap {
		"sortByEvent": SortByEvent
	}
}

export class SortByComponent extends SortByComponentAutogen {
  private selected: string | null = null;
  debouncedCallbacks: DebouncedCallbacks;

  constructor() {
    super();
    this.debouncedCallbacks = new DebouncedCallbacks();
  }

  handleChecked(checked: string | null) {
    if (!checked)
      return;

    const ref = {
      "alphabetical": this.refs.alphabetical,
      "tvd": this.refs.tvd,
      "uvd": this.refs.uvd,
      "apy": this.refs.apy,
      "fees": this.refs.fees,
    }[checked];

    if (ref)
      ref.checked = true;
  }

  onDefaultChanged() {
    this.selected = this.default;
    this.handleChecked(this.default);
  }

  dispatchSortByEvent() {
    const debouncedDispatch = this.debouncedCallbacks.debounce((el: this, sortBy: string) => {
      el.dispatchEvent(new CustomEvent("sortByEvent", { 
        detail: {
          sortBy,
        },
        bubbles: true,
      }));
    });

    if (this.selected)
      debouncedDispatch(this, this.selected);
  }

  connectedCallback() {
    this.classList.add("button", "fantasy", "row", "gap-1");

    this.addEventListener("dropdownOpen", () => {
      this.handleChecked(this.selected);
    });

    this.addEventListener("dropdownSelect", ev => {
      ev.stopPropagation();
      const sortBy = (ev.detail.selectedElement.children.item(1) as HTMLInputElement)?.value as SortBy;
      if (!sortBy) 
        return;
      this.selected = sortBy;
      this.dispatchSortByEvent();
    });
  }
}

SortByComponent.registerElement();