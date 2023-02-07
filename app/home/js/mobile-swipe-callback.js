class SwipeEventCallbacks extends SwipeEventManager {

	constructor() {
		super();
		this.swipeEvent = this.swipeEvent;

		this._createSwipeEvents();
	}

	// Backgound body swipe callback
	_bodyBackgroundSwipeEvent = (el, d) => {

		// Swipe left will open dashboard
		if (d === 'left') {
			dashboard.toggleDashboard();
		} else if (d === 'down') {
			// Swiping down will open search box
			searchBoxShow.toggleSearchBox();
		} else if (d === 'right') {
			// Swiping right will open web menu
			webMenu.toggleWebMenu();
		} else if (d === 'up') {
			// Swiping up will open weather screen
			weatherScreen.toggleWeatherScreen();
		}
	}

	// Dashboard swipe callback
	_rightDashboardSwipeEvent = (el, d) => {

		// Swipe right will close dashboard
		if (d === 'right') {
			dashboard.toggleDashboard();
		}
	}

	// Blur overlay swipe event
	_centeredBoxOverlaySwipeEvent = (el, d) => {

		// Swiping up will close search box
		if (d === 'up') {
			searchBoxShow.toggleSearchBox();
		}
	}

	// Web menu swipe event
	_webMenuSwipeEvent = (el, d) => {

		// Swiping left will close web menu
		if (d === 'left') {
			webMenu.toggleWebMenu();
		}
	}

	// Weather screen swipe event
	_weatherScreenSwipeEvent = (el, d) => {

		// Swiping left will the weather screem
		if (d === 'left') {
			weatherScreen.toggleWeatherScreen();
		}
	}

	// Assign swipe callback for each IDs
	_createSwipeEvents = () => {
		this.swipeEvent('dummyBodyBackground', this._bodyBackgroundSwipeEvent);

		this.swipeEvent('rightDashboard', this._rightDashboardSwipeEvent);

		this.swipeEvent('centeredBoxOverlay', this._centeredBoxOverlaySwipeEvent);

		this.swipeEvent('webMenuScreen', this._webMenuSwipeEvent);

		this.swipeEvent('weatherScreen', this._weatherScreenSwipeEvent);
	}
}





