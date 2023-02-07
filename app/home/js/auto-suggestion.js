class AutoSuggestion {
	
	constructor() {
		this._searchBox = document.querySelector('#searchBox');
		this._suggestionsUL = document.querySelector('#suggestions');
		this._suggestionsContainer = document.querySelector('#suggestionsContainer');
	}

	hideSuggestions = () => {
		// Hide suggestions
		this._suggestionsContainer.classList.remove('suggestionsShow');
		this._suggestionsUL.innerHTML = '';
	}

	_showSuggestions = () => {
		// Show suggestions
		this._suggestionsContainer.classList.add('suggestionsShow');
	}

	// Create input events
	_phraseEvents = button => {

		// Update searchbox on enter key and mouse click
		button.onkeyup = e => {

			if (e.key === 'Enter') {

				this._searchBox.value = button.innerText;
				this._searchBox.focus();

			} else if (e.key === 'Backspace') {

				this._searchBox.focus();

			} else if ((e.key === 'ArrowDown') || e.key === 'ArrowRight') {

				e.preventDefault();

				const phraseButtons = Array.prototype.slice.call(document.querySelectorAll('button'));
				const phraseIndex = (phraseButtons.indexOf(document.activeElement) + 1) % phraseButtons.length;
				const phraseButton = phraseButtons[parseInt(phraseIndex, 10)];
				phraseButton.focus();

			} else if ((e.key === 'ArrowUp') || e.key === 'ArrowLeft') {

				e.preventDefault();

				const phraseButtons = Array.prototype.slice.call(document.querySelectorAll('button'));
				let phraseIndex = (phraseButtons.indexOf(document.activeElement) - 1) % phraseButtons.length;

				if (phraseIndex < 0) { 
					phraseIndex = phraseButtons.length - 1;
				}

				const phraseButton = phraseButtons[parseInt(phraseIndex, 10)];
				phraseButton.focus();
			}

		};

		// Onmouseup event
		button.onmouseup = e => {
			this._searchBox.value = button.innerText;
			this._searchBox.focus();
		};
	}

	// Generate and parse suggestions
	_autocompleteCallback = phrase => {

		// Filter/parse the objectgerome matil
		const suggestion = phrase.map(i => i.phrase)
						.filter(s => !(s.toLowerCase() === String(this._searchBox.value).toLowerCase()))
						.slice(0, 4);

		// Empty ul on every callback to refresh list
		this._suggestionsUL.innerHTML = '';

		// Generate list elements
		for (let phrases of suggestion) {

			// Create html elements
			const li = document.createElement('li');
			li.id = 'phrase';

			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'phraseButton';
			button.innerText = phrases;

			// Create input events
			this._phraseEvents(button);

			// Appent to ul
			li.appendChild(button);
			this._suggestionsUL.appendChild(li);
		}

		// Show suggestions
		this._showSuggestions();
	}

	fetchSuggestions = () => {

		const endpoint = 'https://duckduckgo.com/ac/';
		const callback = 'autocompleteCallback';
		const searchQuery = String(this._searchBox.value);
		window[String(callback)] = res => {
			// Passed the suggestion object to process it
			this._autocompleteCallback(res);
		};

		// Fetch from duckduckgo
		const script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = `${endpoint}?callback=${callback}&q=${searchQuery}`;
		document.querySelector('head').appendChild(script);
	}

}
