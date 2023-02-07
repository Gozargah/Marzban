class CenteredBox {
	
	constructor() {
		this._centeredBox = document.querySelector('#centeredBox');

		this._centeredBoxVisibility = true;

		this.showCenteredBox = this.showCenteredBox.bind(this);
		this.hideCenteredBox = this.hideCenteredBox.bind(this);
		this.toggleCenteredBox = this.toggleCenteredBox.bind(this);
	}

	showCenteredBox = () => {
		this._centeredBox.classList.remove('hiddenBox');
		this._centeredBoxVisibility = !this._centeredBoxVisibility;
	}

	hideCenteredBox = () => {
		this._centeredBox.classList.add('hiddenBox');
		this._centeredBoxVisibility = !this._centeredBoxVisibility;
	}

	toggleCenteredBox = () => {

		if (this._centeredBoxVisibility) {
			// hide centered box
			this.hideCenteredBox();

		} else {
			// Show centered box
			this.showCenteredBox();
		}
	}
}