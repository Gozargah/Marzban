class SearchBoxShow {
	
	constructor() {

		this._searchBox = document.querySelector('#searchBox');
		this._searchBoxContainer = document.querySelector('#searchBoxContainer');
		this._centeredBoxOverlay = document.querySelector('#centeredBoxOverlay');

		this._searchBoxVisility = false;

		this.showSearchBox = this.showSearchBox.bind(this);
		this.hideSearchBox = this.hideSearchBox.bind(this);
		this.toggleSearchBox = this.toggleSearchBox.bind(this);
	}

	getSearchBoxVisibility = () => {
		return this._searchBoxVisility;
	}

	showSearchBox = () => {
		this._searchBoxContainer.classList.add('showSearchBox');

		// Focus
		this._searchBox.focus();

		this._searchBoxVisility = !this._searchBoxVisility;

		// Toggle overlay
		this._centeredBoxOverlay.classList.toggle('showOverlay');
	}

	hideSearchBox = () => {
		this._searchBoxContainer.classList.remove('showSearchBox');

		// Toggle overlay
		this._centeredBoxOverlay.classList.toggle('showOverlay');

		this._searchBox.value = '';

		// Hide suggestions
		autoSuggestion.hideSuggestions();

		this._searchBoxVisility = !this._searchBoxVisility;
	}

	toggleSearchBox = () => {

		// If profile anim is still running,
		// Return to avoid spam
		if (profileImage.getProfileAnimationStatus()) return;

		// Rotate profile
		profileImage.rotateProfile();

		if (this._searchBoxVisility) {
			// Hide search box
			this.hideSearchBox();

		} else {
			// Show search box
			this.showSearchBox();
		}

		// console.log('toggle searchbox');
	}


}

