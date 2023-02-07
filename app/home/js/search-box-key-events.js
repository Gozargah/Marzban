class SearchboxKeyEvents {
	constructor() {
		this._searchBox = document.querySelector('#searchBox');

		this._searchQuerySend = searchQuerySend;
		this.sendQuery = this._searchQuerySend.sendQuery;

		this._registerSearchBoxOnKeyUpEvent();
	}

	_searchBoxOnKeyUpEvent = event => {
		// Cancel the default action, if needed
		event.preventDefault();
		
		if (event.key === 'Tab') return;

		// Autosuggestion
		if (event.key.length === 1 || event.key === 'Backspace') {
			if (this._searchBox.value < 1) {
				// Hide suggestions
				autoSuggestion.hideSuggestions();
				return;
			}

			// Fetch suggestion/phrases
			autoSuggestion.fetchSuggestions();
			return;
		}

		// Search query
		// Number 13 is the "Enter" key on the keyboard
		if (event.key === 'Enter') {

			// Don't accept empty strings
			if (searchBox.value < 1) {
				return;
			}

			// Search the web
			this.sendQuery();
		}
	}

	_registerSearchBoxOnKeyUpEvent = () => {
		this._searchBox.addEventListener('keyup', this._searchBoxOnKeyUpEvent);
	}
}