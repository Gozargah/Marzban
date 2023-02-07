class SwipeEventManager {

	constructor() {
		this.swipeEvent = this.swipeEvent.bind(this);

		this._xDown = null;
		this._yDown = null;
	}

	swipeEvent = (elementID, callback) => {

		const el = document.getElementById(elementID);
		let dir;

		el.addEventListener(
			'touchstart',
			event => {
				// event.preventDefault();
				this._xDown = event.touches[0].clientX;
				this._yDown = event.touches[0].clientY;
			},
			{ passive: true }
		);

		el.addEventListener(
			'touchmove',
			event => {
				// event.preventDefault();
				if ( ! this._xDown || ! this._yDown ) {
					return;
				}

				const xUp = event.touches[0].clientX;
				const yUp = event.touches[0].clientY;
				const xDiff = this._xDown - xUp;
				const yDiff = this._yDown - yUp;

				if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
					if ( xDiff > 0 ) {
						// Left Swipe
						dir = 'left';
					} else {
						// Right Swipe
						dir = 'right';
					}					   
				} else {

					if ( yDiff > 0 ) {
						// Up Swipe
						dir = 'up';
					} else { 
						// Down Swipe
						dir = 'down';
					}
				}
				
				/* Reset values */
				this._xDown = null;
				this._yDown = null;

				if (dir !== ''){
					if (typeof callback === 'function') {
						callback(el, dir);
					}
				}

			},
			{ passive: true }
		);
	}
}
