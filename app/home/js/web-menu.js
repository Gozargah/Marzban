class WebMenu {

	constructor() {
		this._dashboard = document.querySelector('#rightDashboard');
		this._weatherScreen = document.querySelector('#weatherScreen');
		this._webSites = config.getWebSites();

		this._webMenuScreen = document.querySelector('#webMenuScreen');
		this._webMenuList = document.querySelector('#webMenuList');
		this._webMenuListContainer = document.querySelector('#webMenuListContainer');
		this._webMenuSearchBox = document.querySelector('#webMenuSearchBox');

		this._webMenuVisibility = false;

		this._webItemFocus;
		this._webListIndex = 0;

		this._init();
	}

	_init = () => {
		this._fuzzySearch();
		this._populateWebMenu();
		this._getFirstItem();

		// Disable inputs
		this._disableWebMenuInputs(true);

		this._registerWebMenuSearchBoxKeyDownEvent();
		this._registerWebMenuKeyDownEvent();
	}

	// Return web menu status
	getwebMenuVisibility = () => {
		return this._webMenuVisibility;
	}

	// Disable textboxes	
	_disableWebMenuInputs = status => {
		const elems = this._webMenuScreen.getElementsByTagName('input');
		const len = elems.length;

		for (let i = 0; i < len; i++) {
			elems[parseInt(i, 10)].disabled = status;
		}
	}

	// Create callback property, to be used when enter was pressed while item is focused	
	_createWebItemCallback = (li, url) => {
		// Create a callback property for the passed li
		li.callback = () => {
			window.location.href = encodeURI(url);
		};
	}
	
	// Sort list alphabetically
	_sortList = () => {
		Array.from(this._webMenuList.getElementsByTagName('li'))
		.sort((a, b) => a.textContent.localeCompare(b.textContent))
		.forEach(li => this._webMenuList.appendChild(li));
	}

	// Create/generate web items
	_populateWebMenu = () => {

		// Generate a list
		for (let webData of this._webSites) {

			const site = webData.site;
			const icon = webData.icon;
			const url = webData.url;

			const li = document.createElement('li');

			// Generate web item/li child
			li.insertAdjacentHTML(
				'afterbegin',
				`
				<a class='webMenuLink' href='${url}' tabindex='-1'>
					<div class='webItem' id='${'id' + site}'>
						<div class='webItemContainer'>
							<div class='webItemBody'>
								<div class='webItemIconContainer'>
									<div class='webItemIcon' style='background-image: url("assets/webcons/${icon}.svg");'></div>
								</div>
								<div class='webItemName'>${site}</div>
							</div>
						</div>
					</div>
				</a>
				`
			);

			// Create callback property
			this._createWebItemCallback(li, url);

			this._webMenuList.appendChild(li);
		}

		// Call to sort list
		this._sortList();
	}

	// Allow fuzzy searching in web menu
	_fuzzySearch = () => {

		// eslint-disable-next-line no-extend-native
		String.prototype.fuzzy = function(term, ratio) {
			const string = this.toLowerCase();
			const compare = term.toLowerCase();
			let matches = 0;
			
			// Covers basic partial matches
			if (string.indexOf(compare) > -1) return true; 
			
			for (let i = 0; i < compare.length; i++) {
				const ind = string.indexOf(compare[parseInt(i, 10)]);
				if (ind > -1) {
					matches += 1;
				} else {
					matches -=1;
				}
			}
			return ((matches / this.length) >= ratio || term === '');
		};
	}

	// Focus on searched item
	_filterWebList = () => {

		let input, filter, ul, li, a, i, txtValue;
		
		input = webMenuSearchBox;
		filter = input.value.toUpperCase();
		ul = this._webMenuList;
		li = ul.getElementsByTagName('li');
		
		// Loop through all list items, and focus if matches the search query
		for (let i = 0; i < li.length; i++) {

			a = li[parseInt(i, 10)].getElementsByClassName('webItemName')[0];
			txtValue = a.textContent || a.innerText;

			// If an item match, hightlight it and focus
			// if (txtValue.toUpperCase().indexOf(filter) !== -1) {
			if (txtValue.toUpperCase().fuzzy(filter, 1) === true) {
				
				// Unselect/Unhightlight old active
				const oldWebItemFocus = this._webItemFocus;
				const oldWebItemFocusChild = oldWebItemFocus.querySelector('.webItem');
				oldWebItemFocusChild.classList.remove('webItemFocus');

				// Update webItemFocus
				this._webItemFocus = li[parseInt(i, 10)];

				// Update weblistindex
				this._webListIndex = i;

				// Get child
				const webItemFocusChild = this._webItemFocus.querySelector('.webItem');
				// Add webItemFocus class to child
				webItemFocusChild.classList.add('webItemFocus');

				// Scroll focus into active
				this._webItemFocus.scrollIntoView();

			}
		}
	}

	// Reset focus/go back to item #1
	_focusReset = () => {
		const oldWebItemFocus = this._webItemFocus;
		const oldWebItemFocusChild = oldWebItemFocus.querySelector('.webItem');
		
		oldWebItemFocusChild.classList.remove('webItemFocus');
		this._webListIndex = 0;
	}

	// Get item #1
	_getFirstItem = () => {
		const ul = this._webMenuList;
		const li = ul.getElementsByTagName('li');

		// Focus on first item
		this._webItemFocus = li[0];

		// Get child
		const webItemFocusChildren = this._webItemFocus.querySelector('.webItem');

		// Add webItemFocus class
		webItemFocusChildren.classList.add('webItemFocus');
	}

	// Show web menu screen
	showWebMenu = () => {
		this._webMenuScreen.classList.add('showWebMenu');

		// Enable inputs
		this._disableWebMenuInputs(false);

		this._webMenuVisibility = !this._webMenuVisibility;

		// Focus to input field
		this._webMenuSearchBox.focus();
	}

	// Hide web menu screen
	hideWebMenu = () => {
		// Clear input field
		this._webMenuSearchBox.value = '';

		// Unfocus input field
		this._webMenuSearchBox.blur();

		// Refilter web list
		this._filterWebList();
		
		// Scroll to top
		this._webMenuListContainer.scrollTop = 0;

		// Reset focus item
		this._focusReset();

		// Get first item
		this._getFirstItem();
		
		this._webMenuScreen.classList.remove('showWebMenu');

		// Disable inputs
		this._disableWebMenuInputs(true);

		this._webMenuVisibility = !this._webMenuVisibility;
	}

	// Toggle web menu screen
	toggleWebMenu = () => {

		// console.log('toggle web menu');

		// If profile anim is still running,
		// Return to avoid spam
		if (profileImage.getProfileAnimationStatus()) return;

		// Rotate profile
		profileImage.rotateProfile();

		if (this._webMenuVisibility) {
			// Hide web menu
			this.hideWebMenu();

		} else {
			// Show Web menu
			this.showWebMenu();
		}

		// Check if any of these are open, if yes, close it
		if (searchBoxContainer.classList.contains('showSearchBox')) {
			// console.log('searchbox is open, closing...');
			searchBoxShow.hideSearchBox();

		} else if (this._dashboard.classList.contains('showRightDashboard')) {
			// console.log('dashboard is open, closing...');
			dashboard.hideDashboard();

		} else if (this._weatherScreen.classList.contains('showWeatherScreen')) {
			// console.log('weather screen is open, closing...');
			weatherScreen.hideWeatherScreen();
			return;
			
		}
		
		// Toggle center box
		centeredBox.toggleCenteredBox();
	}

	// Remove focus class
	_removeClass = (el, className) => {
		// Remove webItemFocus class
		const oldWebItemFocus = el.querySelector('.webItem');
		oldWebItemFocus.classList.remove('webItemFocus');
	}

	// Add focus class
	_addClass = (el, className) => {
		const webItemFocusChild = el.querySelector('.webItem');

		// Add webItemFocus class to child
		webItemFocusChild.classList.add('webItemFocus');

		// Scroll focus into active
		webItemFocusChild.scrollIntoView();
	}

	// Arrow key navigation
	_navigateWithArrows = (key, len) => {
		// assign constiables to key codes
		const [right, left, down, up] = [39, 37, 40, 38];

		const getIndexByWindowWidth = () => {
			if (window.innerWidth <= 580) { return 1; }

			// width of elements in pixels
			const menuItemWidth = 138;
			const scrollBarWidth = 10;
			// viewport width
			const vw = unit => window.innerWidth * (unit / 100);
			
			// Gets the number of columns by dividing the screen width minus the padding, scroll width and 
			// average of menu item width by the menu item width
			const containerWindow = ((window.innerWidth - (menuItemWidth / 2) - scrollBarWidth - vw(24)) / menuItemWidth);
			// Get rounded result
			return Math.round(containerWindow);
		};

		// Determine the index position by key
		const changeWebListIndex = () => {
			switch (key) {
				case right:
					this._webListIndex++;
					// Clear web menu searchbox
					this._webMenuSearchBox.value = '';
					break;
				case left:
					this._webListIndex--;
					// Clear web menu searchbox
					this._webMenuSearchBox.value = '';
					break;
				case up:
					this._webListIndex = this._webListIndex - getIndexByWindowWidth();
					// Clear web menu searchbox
					this._webMenuSearchBox.value = '';
					break;
				case down:
					this._webListIndex = this._webListIndex + getIndexByWindowWidth();
					// Clear web menu searchbox
					this._webMenuSearchBox.value = '';
					break;
			}
		};

		const changeItemFocus = (condition, overFlowIndex) => {
			const next = this._webMenuList.getElementsByTagName('li')[this._webListIndex];
			if(typeof next !== 'undefined' && condition) {			
				this._webItemFocus = next;
			} else {
				this._webListIndex = overFlowIndex;
				this._webItemFocus = this._webMenuList.getElementsByTagName('li')[parseInt(overFlowIndex, 10)];
			}
		};

		const changeItemFocusByKey = () => {
			if (key === right) { return changeItemFocus((this._webListIndex <= len), 0); }
			if (key === left) { return changeItemFocus((this._webListIndex >= 0), len); }
			if (key === up) { return changeItemFocus((this._webListIndex >= 0), len); }
			if (key === down) { return changeItemFocus((this._webListIndex <= len), 0); }
		};
		
		changeWebListIndex();

		if (this._webItemFocus) {
			this._removeClass(this._webItemFocus, 'webItemFocus');
			changeItemFocusByKey();
			this._addClass(this._webItemFocus, 'webItemFocus');
		} else {
			this._webListIndex = 0;
			this._webItemFocus = this._webMenuList.getElementsByTagName('li')[0];
			this._addClass(this._webItemFocus, 'webItemFocus');
		}

	}

	_webMenuKeyDownEvent = e => {
		const len = this._webMenuList.getElementsByTagName('li').length - 1;
		this._navigateWithArrows(e.which, len);
	}

	_registerWebMenuKeyDownEvent = () => {
		this._webMenuScreen.addEventListener('keydown', this._webMenuKeyDownEvent, false);
	}

	_webMenuSearchBoxKeyDownEvent = e => {

		// Don't hijack keyboard navigation buttons (up, down, left, right)
		if ((e.key === 'ArrowRight') || (e.key === 'ArrowDown') || 
			(e.key === 'ArrowLeft') || (e.key === 'ArrowUp')) return;

		if (e.key === 'Tab') return;

		if (e.key === 'Enter' && this._webItemFocus) {

			// Run the focused li's callback
			this._webItemFocus.callback();

			// Hide web menu
			this.toggleWebMenu();

		} else if (e.key === 'Backspace' && webMenuSearchBox.value.length  < 1) {
			// Hide web menu if backspace is pressed and searchbox value is 0
			this.toggleWebMenu();
			return;

		} else if ((e.key === 'Escape') || (e.key === 'Alt')) {
			// Ignore escape and alt key
			return;
		}

		// Filter
		this._filterWebList();

	}

	_registerWebMenuSearchBoxKeyDownEvent = () => {
		this._webMenuSearchBox.onkeydown = this._webMenuSearchBoxKeyDownEvent;
	}
}
