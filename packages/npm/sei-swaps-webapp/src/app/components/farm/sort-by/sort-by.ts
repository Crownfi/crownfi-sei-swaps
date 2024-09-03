import { SortByComponentAutogen } from "./_autogen/sort-by.js";

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
  connectedCallback() {
    this.classList.add("button", "fantasy", "row", "gap-1");

    this.addEventListener("dropdownSelect", ev => {
      ev.stopPropagation();
      const sortBy = (ev.detail.selectedElement.children.item(1) as HTMLInputElement)?.value as SortBy;
      if (!sortBy) return;
      const detail = {
        sortBy
      } satisfies StorByEventDetails;
      this.dispatchEvent(new CustomEvent("sortByEvent", { detail, bubbles: true }));
    });
  }
}

SortByComponent.registerElement();