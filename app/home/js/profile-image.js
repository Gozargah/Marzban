class ProfileImage {

	constructor() {
		this._profileContainer = document.querySelector('#profileImageContainer');

		this._profileAnimRunning = false;

		// Don't run animation on startup
		this._profileContainer.style.webkitAnimationPlayState = 'paused';

		this.rotateProfile = this.rotateProfile.bind(this);

		this._animationEndEvent = this._animationEndEvent.bind(this);
		this._onClickEvent = this._onClickEvent.bind(this);

		this.getProfileAnimationStatus = this.getProfileAnimationStatus.bind(this);

		this._init();
	}

	_init = () => {
		this._registerAnimationEndEvent();
		this._registerOnClickEvent();
	}

	rotateProfile = () => {
		event.preventDefault;

		// Remove anim class
		this._profileContainer.classList.remove('rotateProfileAnim');

		// Triggering reflow
		void this._profileContainer.offsetWidth;

		// Re-add animation class
		this._profileContainer.classList.add('rotateProfileAnim');

		// Start rotation animation
		this._profileContainer.style.webkitAnimationPlayState = 'running';
		this._profileAnimRunning = true;
	}

	_animationEndEvent = e => {
		this._profileAnimRunning = false;
	}

	// Re-enable animation after death
	_registerAnimationEndEvent = () => {
		this._profileContainer.addEventListener('animationend', this._animationEndEvent);
	}

	_onClickEvent = e => {
		if (this._profileAnimRunning) return;
		searchBoxShow.toggleSearchBox();
	}

	_registerOnClickEvent = () => {
		this._profileContainer.onclick = this._onClickEvent;
	}

	getProfileAnimationStatus = () => {
		return this._profileAnimRunning;
	}

}


