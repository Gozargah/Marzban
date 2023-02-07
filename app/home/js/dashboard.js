class Dashboard {

	constructor() {
		this._dashboard = document.querySelector('#rightDashboard');
		this._dashboardOverlay = document.querySelector('#dashboardOverlay');

		this._rightDashboardVisibility = false;

		this._dashboardOverlayMouseUpEvent = this._dashboardOverlayMouseUpEvent.bind(this);

		this._centeredBox = document.querySelector('#centeredBox');
		this._webMenu = document.querySelector('#webMenuScreen');
		this._searchBoxContainer = document.querySelector('#searchBoxContainer');
		this._weatherScreen = document.querySelector('#weatherScreen');

		this._init();
	}

	_init = () => {
		this._registerOverlayMouseUpEvent();
		this._disableDashboardInputs(true);
	}

	_disableDashboardInputs = status => {
		const elems = this._dashboard.getElementsByTagName('input');
		const len = elems.length;

		for (let i = 0; i < len; i++) {
			elems[parseInt(i, 10)].disabled = status;
		}
	}

	getRightDashboardVisibility = () => {
		return this._rightDashboardVisibility;
	}

	showDashboard = () => {
		this._dashboard.classList.add('showRightDashboard');

		// Show overlay
		this._dashboardOverlay.classList.add('showDashboardOverlay');

		// Enable Inputs
		this._disableDashboardInputs(false);

		this._rightDashboardVisibility = !this._rightDashboardVisibility;
	}

	hideDashboard = () => {
		this._dashboard.classList.remove('showRightDashboard');
		this._dashboard.scrollTop = 0;

		// Disable Inputs
		this._disableDashboardInputs(true);

		// Hide overlay
		this._dashboardOverlay.classList.remove('showDashboardOverlay');

		this._rightDashboardVisibility = !this._rightDashboardVisibility;
	}

	toggleDashboard = () => {

		// console.log('toggle dashboard');
		
		if (this._rightDashboardVisibility) {
		
			// Hide dashboard
			this.hideDashboard();
		
		} else {

			// Show dashboard
			this.showDashboard();

			// If centered box is hidden, open it
			if (this._centeredBox.classList.contains('hiddenBox')) {
				
				// console.log('centered box is hidden, reopening...');
				
				// Rotate profile container
				profileImage.rotateProfile();
				
				// Toggle center box
				centeredBox.toggleCenteredBox();
			}
		}

		// Check if any of these are open, if yes, close it
		if (this._searchBoxContainer.classList.contains('showSearchBox')) {
			// console.log('searchbox is open, closing...');
			searchBoxShow.hideSearchBox();

		} else if (this._webMenu.classList.contains('showWebMenu')) {
			// console.log('web menu is open, closing...');
			webMenu.hideWebMenu();
			return;
		
		} else if (this._weatherScreen.classList.contains('showWeatherScreen')) {
			// console.log('weather screen is open, closing...');
			weatherScreen.hideWeatherScreen();
			return;

		}

	}

	_dashboardOverlayMouseUpEvent = e => {
		if (this._rightDashboardVisibility) {
			this.toggleDashboard();
		}
		// console.log('dashboard overlay clicked...');
	}

	_registerOverlayMouseUpEvent = () => {
		this._dashboardOverlay.addEventListener('mouseup', this._dashboardOverlayMouseUpEvent);
	}
	
}