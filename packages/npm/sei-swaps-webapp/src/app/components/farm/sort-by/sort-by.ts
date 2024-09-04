import { SortByComponentAutogen, SortByComponentRefs } from "./_autogen/sort-by.js";

export type SortBy = "alphabetical" | "tvd" | "uvd" | "apy" | "fees";

type StorByEventDetails = {
  sortBy: SortBy;
};

export type SortByEvent = CustomEvent<StorByEventDetails>;

declare global {
	interface GlobalEventHandlersEventMap {
		"sortByEvent": SortByEvent
	}
}

export class SortByComponent extends SortByComponentAutogen {
  private selected: string | null = null;

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

  connectedCallback() {
    this.classList.add("button", "fantasy", "row", "gap-1");

    this.addEventListener("dropdownOpen", () => {
      this.handleChecked(this.selected);
    });

    this.addEventListener("dropdownSelect", ev => {
      ev.stopPropagation();
      const sortBy = (ev.detail.selectedElement.children.item(1) as HTMLInputElement)?.value as SortBy;
      if (!sortBy) return;
      this.selected = sortBy;
      const detail = {
        sortBy
      } satisfies StorByEventDetails;
      this.dispatchEvent(new CustomEvent("sortByEvent", { detail, bubbles: true }));
    });
  }
}

SortByComponent.registerElement();