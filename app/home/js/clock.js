class Clock {

	constructor() {
		this._clockEl = document.querySelector('#clock');
		this._setTime = this._setTime.bind(this);
		this._startClock();
	}

	// Append 0 before time elements if less hour's than 10
	_appendZero = k => {
		if (k < 10) {
			return '0' + k;
		} else {
			return k;
		}
	}

	_setTime = () => {
		// Date object
		const date = new Date();

		// Set hour, minute
		let hour = date.getHours();
		let min = date.getMinutes();
		let midDay = 'AM';
		
		// Assigning
		midDay = (hour >= 12) ? 'PM' : 'AM';
		hour = (hour === 0) ? 12 : ((hour > 12) ? (hour - 12) : hour);
		hour = this._appendZero(hour);
		min = this._appendZero(min);

		// Update clock id element
		this._clockEl.innerText = `${hour}:${min} ${midDay}` ;
	}

	_startClock = () => {
		this._setTime();
		setInterval(this._setTime, 1000);
	}

}