const q = document.querySelector.bind(document);

export function setLoading(isLoading: boolean, text: string = ""){
	const loadCover = q("#loading-cover") as HTMLElement;
	const loadingText = q("#loading-text") as (HTMLElement | null);
	// TODO: Block tab navigation
	// TOOD: Fade animation
	if (isLoading) {
		loadCover.style.display = "";
		if (loadingText) {
			loadingText.innerText = text;
		}
	}else{
		loadCover.style.display = "none";
		if (loadingText) {
			loadingText.innerText = "";
		}
	}
	
}
