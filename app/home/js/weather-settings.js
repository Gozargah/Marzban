class WeatherSettings {

	constructor() {

		this._localStorage = window.localStorage;
		
		this._appID = '';
		this._cityID = '';
		this._units = '';

		this._defaultLocator = 'city';

		this._locatorMode = '';

		// Geolocation data
		this._origLongitude = 0;
		this._origLatitude = 0;
		this._watchPositionID = 0;

		this._watchGeoOptions = {
			enableHighAccuracy: true,
			timeout: 5000,
			maximumAge: 0
		};

		this._apiKeySet = document.querySelector('#apiKeySet');
		this._cityIDSet = document.querySelector('#cityIDSet');

		this._weatherSelectLocator = document.querySelector('#weatherSelectLocator');
		this._weatherSelectUnits = document.querySelector('#weatherSelectUnits');

		this._weatherSettingsReset = document.querySelector('#weatherSettingsReset');
		this._weatherSettingsApply = document.querySelector('#weatherSettingsApply');

		this._weatherSettingsCityIDGroup = document.querySelector('#weatherSettingsCityID');

		this._getWeatherDataViaCity = weatherScreen.getWeatherDataViaCity;
		this._getForecastDataViaCity = weatherScreen.getForecastDataViaCity;

		this._getWeatherDataViaGeo = weatherScreen.getWeatherDataViaGeo;
		this._getForecastDataViaGeo = weatherScreen.getForecastDataViaGeo;

		this._init();
	}

	_init = () => {
		this._updateWeatherSettings();
		this._registerWeatherResetOnClickEvent();
		this._registerWeatherApplyOnClickEvent();
		this._registerWeatherSelectLocatorOnChangeEvent();
	}

	// Clear credentials
	_clearWeatherCredentials = () => {
		this._localStorage.removeItem('apiKey');
		this._localStorage.removeItem('cityID');
		this._localStorage.removeItem('units');
		this._localStorage.removeItem('locatorMode');
	}

	// Reset textboxes
	_deleteWeatherSettingsValue = () => {
		this._apiKeySet.value = null;
		this._cityIDSet.value = null;
		this._weatherSelectUnits.value = 'metric';
		this._weatherSelectLocator.value = this._defaultLocator;
	}

	// Apply credentials
	_applyWeatherSettings = (key, city, units, locator) => {
		this._localStorage.setItem('apiKey', key);
		this._localStorage.setItem('cityID', city);
		this._localStorage.setItem('units', units);
		this._localStorage.setItem('locatorMode', locator);
	}

	// Update credential variables
	_updateCredentialVariables = () => {
		this._appID = this._localStorage.getItem('apiKey') || 'API Key';
		this._cityID = this._localStorage.getItem('cityID') || 'City ID';
		this._units = this._localStorage.getItem('units') || 'metric';
		this._locatorMode = this._localStorage.getItem('locatorMode') || this._defaultLocator;
	}

	// Update textbox placeholders
	_updateWeatherSettingsPlaceholder = () => {
		this._apiKeySet.placeholder = this._appID;
		this._cityIDSet.placeholder = this._cityID;
		this._weatherSelectUnits.value = this._units;
		this._weatherSelectLocator.value = this._locatorMode;
	}

	// Stop geolocating
	_stopGeolocating = () => {

		// Unregister the handler
		navigator.geolocation.clearWatch(this._watchPositionID);

		// Reset positions
		this._origLongitude = 0;
		this._origLatitude = 0;
	}

	// You denied the permission request
	_deniedGeolocation = () => {

		confirm(`Location access denied! If you're on mobile, make sure to`+
			` enable your GPS and allow the location permission on your browser's settings.`);
	}

	// Watch
	_watchGeoSuccess = pos => {
				
		const currentCoord = pos.coords;

		if ((this._origLongitude !== currentCoord.longitude) || (this._origLatitude !== currentCoord.latitude)) {

			// console.log('update current position');

			// Update origPositions
			this._origLongitude = currentCoord.longitude;
			this._origLatitude = currentCoord.latitude;

			// fetch and update widget
			this._getWeatherDataViaGeo(this._appID, this._units, this._origLongitude, this._origLatitude);
			this._getForecastDataViaGeo(this._appID, this._units, this._origLongitude, this._origLatitude);
		}
	}

	// Error
	_watchGeoError = err => {
		// console.warn('ERROR(' + err.code + '): ' + err.message);
		if (err.code === err.PERMISSION_DENIED) {

			this._deniedGeolocation();
		}
	}

	// Start watching location
	_watchGeoPosition = () => {
		this._watchPositionID = navigator.geolocation.watchPosition(this._watchGeoSuccess, this._watchGeoError, this._watchGeoOptions);			
	}

	// Check permission
	_checkGeoPermission = () => {

		navigator.permissions.query({name:'geolocation'}).then(result => {

			if ((result.state === 'prompt') || (result.state === 'granted')) {

				this._watchGeoPosition();
			} else if (result.state === 'denied') {

				alert('Manually enable the geolocation in your browser settings. How? Who knows?');
			}
		});
	}

	// Locator mode on change event
	_weatherSelectLocatorOnChangeEvent = e => {

		this._locatorMode = this._weatherSelectLocator.options[this._weatherSelectLocator.selectedIndex].value;

		if (this._locatorMode === 'geolocation') {

			this._weatherSettingsCityIDGroup.classList.add('hideWeatherSettings');
		} else if (this._locatorMode === 'city') {

			this._weatherSettingsCityIDGroup.classList.remove('hideWeatherSettings');
		}
	}

	// Register on change event
	_registerWeatherSelectLocatorOnChangeEvent = () => {

		this._weatherSelectLocator.onchange = this._weatherSelectLocatorOnChangeEvent;
	}

	// Update weather settings
	_updateWeatherSettings = () => {

		// Update cred vars
		this._updateCredentialVariables();

		if (this._locatorMode === 'geolocation') {

			this._weatherSettingsCityIDGroup.classList.add('hideWeatherSettings');
			if (navigator.geolocation) {

				this._checkGeoPermission();
			} else {

				alert(`Oof! It seems your browser doesn't support geolocation.`);
			}

		} else if (this._locatorMode === 'city') {

			this._weatherSettingsCityIDGroup.classList.remove('hideWeatherSettings');

			// Stop geolocating
			this._stopGeolocating();

			// Update weather forecast elements
			this._getWeatherDataViaCity(this._appID, this._cityID, this._units);
			this._getForecastDataViaCity(this._appID, this._cityID, this._units);
		}

		this._deleteWeatherSettingsValue();
		this._updateWeatherSettingsPlaceholder();
	}

	// Reset
	_weatherResetOnClickEvent = e => {

		// Reset keys
		this._clearWeatherCredentials();

		// Stop geolocating
		this._stopGeolocating();

		// Update
		this._updateCredentialVariables();
		this._deleteWeatherSettingsValue();
		this._updateWeatherSettingsPlaceholder();

		// Show/hide city id textbox based on the default mode
		if (this._locatorMode === 'geolocation') {
			this._weatherSettingsCityIDGroup.classList.add('hideWeatherSettings');
		} else if (this._locatorMode === 'city') {
			this._weatherSettingsCityIDGroup.classList.remove('hideWeatherSettings');
		}
	}

	// Apply Onclick event
	_weatherApplyOnClickEvent = e => {

		// Set input field value to variables
		const apiKey = this._apiKeySet.value || this._apiKeySet.placeholder;
		const cityID = this._cityIDSet.value || this._cityIDSet.placeholder;
		const units = this._weatherSelectUnits.options[this._weatherSelectUnits.selectedIndex].value;
		const locator = this._weatherSelectLocator.options[this._weatherSelectLocator.selectedIndex].value;

		// Update credentials/Settings
		this._applyWeatherSettings(
			apiKey,
			cityID,
			units,
			locator
		);

		this._updateWeatherSettings();
	}

	_registerWeatherResetOnClickEvent = () => {
		this._weatherSettingsReset.onclick = this._weatherResetOnClickEvent;
	}

	_registerWeatherApplyOnClickEvent = () => {
		this._weatherSettingsApply.onclick = this._weatherApplyOnClickEvent;
	}

}