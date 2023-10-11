const q = document.querySelector.bind(document);

export function setLoading(isLoading: boolean){
	const loadCover = q("#loading-cover") as HTMLElement;
	// TODO: Block tab navigation
	// TOOD: Fade animation
	if (isLoading) {
		loadCover.style.display = "";
	}else{
		loadCover.style.display = "none";
	}
}
