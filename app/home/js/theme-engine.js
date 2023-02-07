class ThemeEngine {
	
	constructor() {
		this._localStorage = window.localStorage;

		this._backgroundTextBox = document.querySelector('#backgroundSet');
		this._backgroundOpacityTextBox = document.querySelector('#backgroundOpacitySet');
		this._foregroundTextBox = document.querySelector('#foregroundSet');
		this._foregroundOpacityTextBox = document.querySelector('#foregroundOpacitySet');

		this._blurTextBox = document.querySelector('#blurSet');
		this._animSpeedTextBox = document.querySelector('#animSpeedSet');
		this._applyTheme = document.querySelector('#themeEngineAsDefault');
		this._resetTheme = document.querySelector('#themeEngineReset');

		this._init();
	}

	// Get CSS variable value
	_getCSSProperty = variable => {
		let cssValue = window.getComputedStyle(document.documentElement).getPropertyValue(String(variable));

		// Remove whitespaces
		// I don't know why getProperty value adds a whitespace(i'm really noob at js)
		cssValue = cssValue.replace(/ /g,'');

		return cssValue;
	}

	// Get localStorage item value
	_getStorageItem = item => {
		return this._localStorage.getItem(String(item));
	}

	// Set localStorage item value
	_setStorageItem = (item, value) => {
		this._localStorage.setItem(
			String(item),
			this._getCSSProperty(String(value))
		);
	}

	// Set/Save original CSS Value, useful when reseting theme engine
	_saveOriginalDefaultCSS = () => {

		// Check original default CSS values
		const defaultValues = {
			'origBaseBG': {
				value: this._getStorageItem('origBaseBG'),
				cssVariable: '--base-bg'
			},
			'origBaseColor': {
				value: this._getStorageItem('origBaseColor'),
				cssVariable: '--base-color'
			},
			'origBlurStrength': {
				value: this._getStorageItem('origBlurStrength'),
				cssVariable: '--blur-strength'
			},
			'origAnimSpeed': {
				value: this._getStorageItem('origAnimSpeed'),
				cssVariable: '--transition-speed'
			}
		};

		// If original css variable has has no value, set it
		Object.keys(defaultValues)
		.forEach(item => {
			const itemName = item;
			const itemValue = defaultValues[String(item)].value;

			// If value is null, set
			if (!itemValue) {
				this._setStorageItem(itemName, defaultValues[String(item)].cssVariable);
			}
		});
	}

	// Validate color
	_checkColorValidity = colorStr => {

		// Check if RGBA - (#RRGGBBAA)
		const colorRGBA = /^#[0-9a-fA-F]{8}$/i.test(colorStr);

		// If not RGBA
		if (!colorRGBA) {

			// If RGB - (#RRGGBB)
			if (/^#[0-9a-fA-F]{3}$/i.test(colorStr)) {
				
				// Add completely opaque alpha
				return colorStr + 'FF';
			
			// If three-charactered HEX color - (#RGB)
			// I feel that this is never used lol
			} else if (/^#[0-9a-fA-F]{3}$/i.test(colorStr)) {

				// Convert it to RRGGBB
				return colorStr.replace(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])/, '#$1$1$2$2$3$3');

			// If three-charactered HEX Color(#RGB) with AA - (#RGBAA)
			} else if (/^#[0-9a-fA-F]{3}[0-9a-fA-F]{2}$/i.test(colorStr)) {

				const bg = colorStr.slice(0, -2);
				const op = colorStr.slice(-2);

				return bg.replace(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])/, '#$1$1$2$2$3$3') + op;

			} else {
				return null;
			}
		}

		// It's RGBA and a valid color so just return it
		return colorStr;
	}

	// Validate color
	_checkBlurValidity = blurStr => {

		let blurStrength = parseInt(blurStr, 10);

		if (String(blurStrength) === 'NaN') {
			return null;
		} else {
			return String(blurStrength) + 'px';
		}
	}

	_checkAnimSpeedValidity = speedStr => {

		let animSpeed = parseInt(speedStr, 10);
		let timeSuffix;

		if (speedStr.endsWith('ms')) {
			timeSuffix = 'ms';
		} else if (speedStr.endsWith('s')) {
			timeSuffix = 's';
		}

		if(String(animSpeed) === 'NaN') {
			return null;
		} else {
			if (timeSuffix) {
				return String(animSpeed) + timeSuffix;
			} else {
				return String(animSpeed) + 'ms';
			}
		}

	}

	// Update textboxes value
	_updateTextBoxValues = (bgColor, bgOpacity, fgColor, fgOpacity, blurPower, animSpeed) => {

		// Set placeholders
		this._backgroundTextBox.value = '';
		this._backgroundTextBox.placeholder = bgColor;

		this._backgroundOpacityTextBox.value = '';
		this._backgroundOpacityTextBox.placeholder = bgOpacity;

		this._foregroundTextBox.value = '';
		this._foregroundTextBox.placeholder = fgColor;
		this._foregroundOpacityTextBox.value = '';
		this._foregroundOpacityTextBox.placeholder = fgOpacity;

		this._blurTextBox.value = '';
		this._blurTextBox.placeholder = blurPower;

		this._animSpeedTextBox.value = '';
		this._animSpeedTextBox.placeholder = animSpeed;
	}

	// Get/Update current css value
	_getCurrentCSSValues = () => {

		// Retrieve current css values
		let currentValues = {
			'baseBG': {
				value: this._getStorageItem('baseBG'),
				origVariable: 'origBaseBG'
			},
			'baseColor': {
				value: this._getStorageItem('baseColor'),
				origVariable: 'origBaseColor'
			},
			'blurStrength': {
				value: this._getStorageItem('blurStrength'),
				origVariable: 'origBlurStrength'
			},
			'animSpeed': {
				value: this._getStorageItem('animSpeed'),
				origVariable: 'origAnimSpeed'
			}
		};

		// If current css variable has has no value, set it
		Object.keys(currentValues)
		.forEach(key => {
			const cssVar = key;
			const cssValue = currentValues[String(cssVar)].value;

			// If value is null, set
			if (!cssValue) {
				currentValues[String(cssVar)].value = this._getStorageItem(currentValues[String(cssVar)].origVariable);
			}
		});

		return currentValues;
	}

	// Process css variables to update input fields
	_processCurrentCSSValues = () => {

		// Get current css values
		const themeObj = this._getCurrentCSSValues();

		const baseBG = themeObj['baseBG'].value;
		const backgroundColor = baseBG.slice(0, -2);
		const backgroundOpacity = baseBG.slice(-2);

		const baseColor = themeObj['baseColor'].value;
		const foregroundColor = baseColor.slice(0, -2);
		const foregroundOpacity = baseColor.slice(-2);

		const blurStrength = themeObj['blurStrength'].value;
		const animSpeed = themeObj['animSpeed'].value;

		// Pass value to update textboxes
		this._updateTextBoxValues(
			backgroundColor,
			backgroundOpacity,
			foregroundColor,
			foregroundOpacity,
			blurStrength,
			animSpeed
		);
	}
	
	// Get input fields values
	_getInputFieldsValue = () => {

		// Get value from the input fields
		const backgroundColor = (this._backgroundTextBox.value || this._backgroundTextBox.placeholder) +
			(this._backgroundOpacityTextBox.value || this._backgroundOpacityTextBox.placeholder);

		const foregroundColor = (this._foregroundTextBox.value || this._foregroundTextBox.placeholder) +
			(this._foregroundOpacityTextBox.value || this._foregroundOpacityTextBox.placeholder);

		const blurStrength = (this._blurTextBox.value || this._blurTextBox.placeholder);
		const transitionSpeed = (this._animSpeedTextBox.value || this._animSpeedTextBox.placeholder);

		const inputFieldValues = {
			'background': backgroundColor,
			'foreground': foregroundColor,
			'blurPower': blurStrength,
			'animSpeed': transitionSpeed 
		};

		return inputFieldValues;
	}

	_updateCSSColors = (bgColor, fgColor, blurPower, animSpeed) => {
		// Change CSS colors
		document.documentElement.style.setProperty('--base-bg', bgColor);
		document.documentElement.style.setProperty('--base-color', fgColor);
		document.documentElement.style.setProperty('--blur-strength', blurPower);
		document.documentElement.style.setProperty('--transition-speed', animSpeed);
	}

	// Update css variables and set theme
	_updateCSSVariables = () => {

		const inputValueObj = this._getInputFieldsValue();

		const bgColorRaw = inputValueObj['background'];
		const fgColorRaw = inputValueObj['foreground'];
		const blurPowerRaw = inputValueObj['blurPower'];
		const animSpeedRaw = inputValueObj['animSpeed'];

		// Colors data obj
		let validatedColorValues = {
			'bgColor': {
				value: this._checkColorValidity(String(bgColorRaw)),
				fallbackVar: 'baseBG',
				fallbackOrigVar: 'origBaseBG'
			},
			'fgColor': {
				value: this._checkColorValidity(String(fgColorRaw)),
				fallbackVar: 'baseColor',
				fallbackOrigVar: 'origBaseColor'
			}
		};

		// Check color validity
		Object.keys(validatedColorValues)
		.forEach(key => {

			let colorVar = key;
			let colorValue = validatedColorValues[String(key)].value;

			if (!colorValue) {
				validatedColorValues[String(key)].value = 
				this._getStorageItem(validatedColorValues[String(key)].fallbackVar) ||
				this._getStorageItem(validatedColorValues[String(key)].fallbackOrigVar);

				// console.log('Invalid Color! Will use previous one...')
			}
		});

		// Set valid color to variables
		const bgColor = validatedColorValues['bgColor'].value;
		const fgColor = validatedColorValues['fgColor'].value;

		// Blur data obj
		let validatedBlurValue = {
			'blurStrength': {
				value: this._checkBlurValidity(blurPowerRaw),
				fallbackVar: 'blurStrength',
				fallbackOrigVar: 'origBlurStrength'
			}
		};

		// Validate and set blur strength
		const blurPower = this._checkBlurValidity(blurPowerRaw) ||
			this._getStorageItem(validatedBlurValue['blurStrength'].fallbackVar) ||
			this._getStorageItem(validatedBlurValue['blurStrength'].fallbackOrigVar);

		// Anim speed data obj
		let validatedSpeedValue = {
			'transitionSpeed' : {
				value: this._checkBlurValidity(animSpeedRaw),
				fallbackVar: 'animSpeed',
				fallbackOrigVar: 'origAnimSpeed'
			}
		};

		// Valudate and set anim speed
		const animSpeed = this._checkAnimSpeedValidity(animSpeedRaw) ||
			this._getStorageItem(validatedSpeedValue['transitionSpeed'].fallbackVar) ||
			this._getStorageItem(validatedSpeedValue['transitionSpeed'].fallbackOrigVar);

		// console.log('bg: '+bgColor+'\nfg: '+fgColor+'\nblur: '+blurPower+'\nspeed: '+animSpeed);

		// Save custom color
		this._localStorage.setItem('baseBG', bgColor);
		this._localStorage.setItem('baseColor', fgColor);
		this._localStorage.setItem('blurStrength', blurPower);
		this._localStorage.setItem('animSpeed', animSpeed);

		// Update css colors
		this._updateCSSColors(bgColor, fgColor, blurPower, animSpeed);
		this._processCurrentCSSValues();
	}

	_reApplyTheme = () => {
		this._updateCSSColors(
			this._getStorageItem('baseBG') || this._getStorageItem('origBaseBG'),
			this._getStorageItem('baseColor') || this._getStorageItem('origBaseColor'),
			this._getStorageItem('blurStrength') || this._getStorageItem('origBlurStrength'),
			this._getStorageItem('animSpeed') || this._getStorageItem('origAnimSpeed')
		);

		this._processCurrentCSSValues();
	}

	_applyOnClickEvent = e => {
		this._updateCSSVariables();
	}

	_registerApplyOnClickEvent = () => {
		this._applyTheme.onclick = this._applyOnClickEvent;
	}

	_resetOnClickEvent = e => {
		this._localStorage.removeItem('baseBG');
		this._localStorage.removeItem('baseColor');
		this._localStorage.removeItem('blurStrength');
		this._localStorage.removeItem('animSpeed');

		this._saveOriginalDefaultCSS();
		this._reApplyTheme();
	}

	_registerResetOnClickEvent = () => {
		this._resetTheme.onclick = this._resetOnClickEvent;
	}

	_init = () => {

		// Save original css variables value
		this._saveOriginalDefaultCSS();

		// Process theme
		this._reApplyTheme();

		// Register events
		this._registerApplyOnClickEvent();
		this._registerResetOnClickEvent();
	}

}