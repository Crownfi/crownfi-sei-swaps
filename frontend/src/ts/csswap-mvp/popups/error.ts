import { isProbablyTxError, makeTxExecErrLessFugly } from "../util";
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
			this.refs.errorDetails.value = content.details + "";
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
		this.refs.errorDetails.scrollTop = 0;
		// No idea why I need this.
		setTimeout(() => {
			this.refs.errorDetails.scrollTo({top: 0, behavior: "instant"});
			this.refs.errorDetails.scrollTop = 0;
		}, 1);
		
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
		if (typeof error.name == "string" && typeof error.message == "string") {
			if (isProbablyTxError(error)) {
				// Note, this regex was only tested on atlantic-2
				const errorParts = makeTxExecErrLessFugly(error.message);
				if (errorParts) {
					const {messageIndex, errorSource, errorDetail} = errorParts;
					return new PopupModalElement({
						heading: "Transaction Execution Error",
						message: "Message #" + messageIndex + " failed.\n" + errorSource + ": " + errorDetail,
						details: "--error details--\n" +
							"name: " + error.name + "\n" +
							"message: " + (error.message + "").replace(/\t/g, "    ") + "\n" +
							"stack: " + (error.stack + "").replace(/\t/g, "    ") + "\n" +
							"\n\n--properties--\n" + JSON.stringify(error, undefined, "    ")
					});
				}
				return new PopupModalElement({
					heading: "RPC Error",
					message: error.message,
					details: "--error details--\n" +
						"name: " + error.name + "\n" +
						"message: " + (error.message + "").replace(/\t/g, "    ") + "\n" +
						"stack: " + (error.stack + "").replace(/\t/g, "    ") + "\n" +
						"\n\n--properties--\n" + JSON.stringify(error, undefined, "    ")
				});
			}
			return new PopupModalElement({
				heading: error.name,
				message: error.message,
				details: "--error details--\n" +
					"name: " + error.name + "\n" +
					"message: " + (error.message + "").replace(/\t/g, "    ") + "\n" +
					"stack: " + (error.stack + "").replace(/\t/g, "    ") + "\n" +
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
