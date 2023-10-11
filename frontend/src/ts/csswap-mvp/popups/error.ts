import { ErrorModalAutogen } from "./_autogen";

// PopupModalAutogen extends HTMLDialogElement
class PopupModalElement extends ErrorModalAutogen {
	untilClosed: Promise<void>;
	private untilCloseCallback: () => void;
	constructor(content?: {heading: string, message: string, details: string}){
		super();
		if (content) {
			// content will be undefined if the element was already added to the DOM before it was registered
			this.heading = content.heading;
			this.message = content.message;
			this.details = content.details;
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
	protected onHeadingChanged(_: string | null, newValue: string | null) {
		this.refs.heading.innerText = newValue + "";
	}
	protected onMessageChanged(_: string | null, newValue: string | null) {
		this.refs.message.innerText = newValue + "";
	}
	protected onDetailsChanged(_: string | null, newValue: string | null) {
		this.refs.errorDetails.value = newValue + "";
	}
	connectedCallback() {
		this.showModal();
		this.refs.errorDetails.scrollTo({top: 0, behavior: "instant"});
	}
	disconnectedCallback() {
		this.untilCloseCallback();
		this.untilClosed = new Promise(resolve => {
			this.untilCloseCallback = resolve;
		});
	}
}
PopupModalElement.registerElement();

export async function showError(error: any) {
	const newModal = (() => {
		if (error.name && error.message) {
			return new PopupModalElement({
				heading: error.name,
				message: error.message,
				details: "--error details--\n" + error.stack +
					"\n\n--properties--\n" + JSON.stringify(error, undefined, "    ")
			});
		}else{
			return new PopupModalElement({
				heading: "Non-error error",
				message: "An unknown error has occurred. Potentially useful details are below",
				details: "--error details--\n" + error +
					"\n\n--properties--\n" + JSON.stringify(error, undefined, "    ")
			});
		}
	})();
	document.body.appendChild(newModal);
	await newModal.untilClosed;
}
