class SearchQuerySend {

	constructor() {
		this._searchBox = document.querySelector('#searchBox');
		this._quickSearchData = config.getQuickSearchData();
	}

	// Check if search query is a valid url
	_isURL = u => {
		let dummyInput;

		if (!dummyInput) {
			dummyInput = document.createElement('input');
			dummyInput.setAttribute('type', 'url');
		}

		dummyInput.value = u;
		return dummyInput.validity.valid;
	}

	// Open link
	_openURL = url => {
		window.location.href = encodeURI(url);
	}

	// Quick search
	_quickSearch = query => {

		const prefix = query.substring(0, query.indexOf('/') + 1);

		// Checks if it's a valid quick search
		if (typeof this._quickSearchData[String(prefix)] === 'undefined') {
			// The prefix does not exist in the object
			return false;
		} else {
			const webSite = this._quickSearchData[String(prefix)].urlPrefix;
			const queryNoSuffix = query.substring(prefix.indexOf('/') + 1);
			this._openURL(webSite + queryNoSuffix);
			return true;
		}
	}

	// Search query
	sendQuery = () => {

		const searchQuery = this._searchBox.value;

		// Check if a valid url
		if (this._isURL(searchQuery)) {
			this._openURL(searchQuery);
			return;
		}

		// If quick search, return
		if (this._quickSearch(searchQuery)) {
			return;
		}

		// Web search
		this._openURL(searchEngineSettings.getSearchQueryPrefix() + searchQuery);
	};
}
