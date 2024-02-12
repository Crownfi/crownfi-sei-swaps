import { PopupModalAutogen } from "./_autogen.js";

// PopupModalAutogen extends HTMLDialogElement
class PopupModalElement extends PopupModalAutogen {
	untilClosed: Promise<void>;
	private untilCloseCallback: () => void;
	constructor(content?: {heading: string, message: string}){
		super();
		if (content) {
			// content will be undefined if the element was already added to the DOM before it was registered
			this.heading = content.heading;
			this.message = content.message;
		}
		this.untilCloseCallback = () => {}; // Gotta satisfy TS until 2 lines down
		this.untilClosed = new Promise(resolve => {
			this.untilCloseCallback = resolve;
		});
		this.addEventListener("close", (ev) => {
			this.remove();
		});
		this.refs.dismissBtn.onclick = () => {this.close()};
	}
	protected onHeadingChanged(oldValue: string | null, newValue: string | null) {
		this.refs.heading.innerText = newValue + "";
	}
	protected onMessageChanged(oldValue: string | null, newValue: string | null) {
		this.refs.message.innerText = newValue + "";
	}
	connectedCallback() {
		this.showModal();
	}
	disconnectedCallback() {
		this.untilCloseCallback();
		this.untilClosed = new Promise(resolve => {
			this.untilCloseCallback = resolve;
		});
	}
}
PopupModalElement.registerElement();

export async function alert(heading: string, message: string) {

	const newModal = new PopupModalElement({
		heading,
		message
	});
	document.body.appendChild(newModal);
	await newModal.untilClosed;
}
