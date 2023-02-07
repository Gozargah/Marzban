class KeyBinding {

	constructor() {

		this._searchBox = document.querySelector('#searchBox');

		this._keysPressed = {};

		this._documentAddKeyDownEvent = this._documentAddKeyDownEvent.bind(this);
		this._documentAddKeyUpEvent = this._documentAddKeyUpEvent.bind(this);

		this._init();
	}

	_init = () => {
		this._registerDocumentAddKeyDownEvent();
		this._registerDocumentAddKeyUpEvent();
	}

	_documentAddKeyDownEvent = e => {

		const searchBoxVisibility = searchBoxShow.getSearchBoxVisibility();

		this._keysPressed[e.key] = true;


		if (this._keysPressed['Alt'] && e.key === 's') {

			e.preventDefault();
			dashboard.toggleDashboard();
			return;

		} else if (this._keysPressed['Alt'] && e.key === 'e') {

			e.preventDefault();
			webMenu.toggleWebMenu();
			return;

		} else if (this._keysPressed['Alt'] && e.key === 'x') {

			e.preventDefault();
			weatherScreen.toggleWeatherScreen();
			return;

		}

		if (e.key === 'Escape') {

			e.preventDefault();
			
			// If any of this are open, close it
			if (searchBoxVisibility) {
				
				// Hide searchbox
				searchBoxShow.toggleSearchBox();
				this._searchBox.value = '';
				return;

			} else if (dashboard.getRightDashboardVisibility()) {
				
				// Hide dashboard
				dashboard.toggleDashboard();
				return;
				
			} else if (weatherScreen.getWeatherScreenVisiblity()) {
				
				// Hide weather
				weatherScreen.toggleWeatherScreen();
				return;

			}

			// Show web menu
			webMenu.toggleWebMenu();
			return;
		}

		if (!searchBoxVisibility) {

			// Don't show searchbox if web menu, dashboard
			// and weather screen is open
			if (dashboard.getRightDashboardVisibility() ||
				webMenu.getwebMenuVisibility() ||
				weatherScreen.getWeatherScreenVisiblity()) return;

			// Only accept single charactered key and backspace to open search box
			if ((e.key.length > 1) && (e.key !== 'Backspace')) return;

			// Open searchbox
			searchBoxShow.toggleSearchBox();

		} else {
			
			// Backspacing while there's no search query will hide searhbox
			// Will also hide if you hit enter
			if ((e.key === 'Backspace' || e.key === 'Enter') && 
				this._searchBox.value < 1) { searchBoxShow.toggleSearchBox(); return; }
		}

	}

	_documentAddKeyUpEvent = e => {
		delete this._keysPressed[e.key];
	}

	_registerDocumentAddKeyDownEvent = () => {
		document.addEventListener('keydown', this._documentAddKeyDownEvent);
	}

	_registerDocumentAddKeyUpEvent = () => {
		document.addEventListener('keyup', this._documentAddKeyUpEvent);
	}
}
