/**
 * main.js
 * https://www.codrops.com
 *
 * Licensed under the MIT license.
 * https://opensource.org/licenses/MIT
 *
 * Copyright 2015, Codrops
 * https://www.codrops.com
 */
;(function(window) {

	'use strict';

	/**
	 * some helper functions
	 */

	// equation of a line
	function lineEq(y2, y1, x2, x1, currentVal) {
		// y = mx + b
		var m = (y2 - y1) / (x2 - x1),
			b = y1 - m * x1;

		return m * currentVal + b;
	}

	var onEndTransition = function(el, callback) {
			var onEndCallbackFn = function( ev ) {
				if( ev.target != this ) return;
				this.removeEventListener( 'transitionend', onEndCallbackFn );
				if( callback && typeof callback === 'function' ) { callback.call(this); }
			};
			el.addEventListener( 'transitionend', onEndCallbackFn );
		},
		// main container
		container = document.querySelector('.container'),
		// the 3D element - the room
		room = container.querySelector('.cube'),
		// the seat rows inside the 3D element
		rows = [].slice.call(room.querySelectorAll('.rows > .row')),
		// total amount of rows
		totalRows = rows.length,
		// seats
		seats = [].slice.call(room.querySelectorAll('.row__seat')),
		// the plan/map
		plan = document.querySelector('.plan'),
		// seats on the plan/map
		planseats = [].slice.call(plan.querySelectorAll('.row__seat')),
		// the plan seat that gets the focus when tabbing into the plan
		tabSeat,
		// the screen
		monitor = room.querySelector('.screen'),
		// the video element
		video = monitor.querySelector('video'),
		// play video control
		playCtrl = monitor.querySelector('button.action--play'),
		// intro element
		intro = monitor.querySelector('.intro'),
		// 'select your seats' control
		selectSeatsCtrl = intro.querySelector('button.action--seats'),
		// the tilt control
		tiltCtrl = document.querySelector('.action--lookaround'),
		// how much the camera rotates when the user moves the mouse
		tiltRotation = {
			rotateX : 25, // a relative rotation of -25deg to 25deg on the x-axis
			rotateY : 15  // a relative rotation of -15deg to 15deg on the y-axis
		},
		// controls whether the tilt is active or not
		tilt = false,
		// the last mouse position and the frame that applies it (one tilt update per frame)
		mousepos, tiltFrame,
		// the users who prefer reduced motion get a crossfade instead of the camera moves
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)'),
		// window sizes
		winsize = {width: window.innerWidth, height: window.innerHeight},
		// the frame that applies a window resize (one per frame)
		resizeFrame,
		// width of one seat
		seat_width = seats[0].offsetWidth,
		// number of seats per row
		seats_row = rows[0].children.length,
		// the sum of the room´s left margin with the room´s right margin is four times the width of a seat
		side_margin = 4 * seat_width,

		// if the following is changed, the CSS values also need to be adjusted (and vice-versa)
		// distance from first row to the screen
		row_front_gap = 800,
		// distance between rows
		row_back = 100,
		// the gap of seats in the middle of the room (equivalent to two columns of seats)
		row_gap_amount = 2,
		// perspective value
		perspective = 2000,
		// transition settings for the room animations (moving camera to seat)
		transitionOpts = {'speed' : 1000, 'easing' : 'cubic-bezier(.7,0,.3,1)'},

		// the room dimentions
		roomsize = {
			x : seats_row * seat_width + side_margin + row_gap_amount * seat_width,
			y : 1000, // SCSS $cube_y
			z : 3000 // SCSS $cube_z
		},
		// the initial values for the room transform
		initTransform = {
			translateX : 0,
			translateY : roomsize.y/3.5, // view from top..
			translateZ : 0,
			rotateX : -15, // ..looking down
			rotateY : 0
		},
		// the current room transform
		roomTransform = initTransform;

	function init() {
		// scale room to fit viewport
		scaleRoom();
		// initial view (zoomed screen)
		applyRoomTransform({'translateX' : 0, 'translateY' : 0, 'translateZ' : 1300, 'rotateX' : 0, 'rotateY' : 0});
		// the seat plan is a single tab stop (the arrow keys move between the seats)
		setTabSeat(planseats[0]);
		// bind events
		initEvents();
		// show the page once the images visible on load are ready
		preloadImages();
	}

	// the poster and the intro icons: the page shows when they´re decoded, so nothing pops in
	function preloadImages() {
		var images = [video.poster, 'img/camera.svg', 'img/seats.svg', 'img/play.svg'].map(function(src) {
			var img = new Image();
			img.src = src;
			return img.decode();
		});
		Promise.allSettled(images).then(function() {
			document.body.classList.remove('loading');
		});
	}

	function applyRoomTransform(transform) {
		room.style.transform = transform ? 'translate3d(0,0,' + perspective + 'px) rotate3d(1,0,0,' + transform.rotateX + 'deg) rotate3d(0,1,0,' + transform.rotateY + 'deg) translate3d(' + transform.translateX + 'px, ' + transform.translateY + 'px, ' + transform.translateZ + 'px)'
										 : 'translate3d(0,0,' + perspective + 'px) rotate3d(1,0,0,' + roomTransform.rotateX + 'deg) rotate3d(0,1,0,' + roomTransform.rotateY + 'deg) translate3d(' + roomTransform.translateX + 'px, ' + roomTransform.translateY + 'px, ' + roomTransform.translateZ + 'px)';
	}

	function applyRoomTransition(settings) {
		var settings = settings || transitionOpts;
		room.style.transition = 'transform ' + settings.speed + 'ms ' + settings.easing;
	}

	function removeRoomTransition() {
		room.style.transition = 'none';
	}

	function scaleRoom() {
		// fit the room to the viewport´s width, or to its height in wide and short windows
		var factor = Math.min(winsize.width / roomsize.x, winsize.height / roomsize.y);
		container.style.transform = 'scale3d(' + factor + ',' + factor + ',1)';
	}

	function initEvents() {
		// select a seat
		var onSeatSelect = function(ev) {
			setTabSeat(ev.target);
			selectSeat(ev.target);
		};
		planseats.forEach(function(planseat) {
			planseat.addEventListener('click', onSeatSelect);
		});

		// the arrow keys move the focus between the plan seats (left/right within the row)
		var onPlanKeydown = function(ev) {
			var pos = planseats.indexOf(ev.target),
				moves = {'ArrowLeft' : -1, 'ArrowRight' : 1, 'ArrowUp' : -seats_row, 'ArrowDown' : seats_row},
				move = moves[ev.key],
				next = pos + move;

			if( pos === -1 || !move ) return;
			ev.preventDefault();
			if( next < 0 || next >= planseats.length ) return;
			if( Math.abs(move) === 1 && Math.floor(next / seats_row) !== Math.floor(pos / seats_row) ) return;

			setTabSeat(planseats[next]);
			planseats[next].focus();
		};
		plan.addEventListener('keydown', onPlanKeydown);

		// enabling/disabling the tilt
		var onTiltCtrlClick = function() {
			// if tilt is enabled..
			if( tilt ) {
				disableTilt();
			}
			else {
				enableTilt();
			}
		};
		tiltCtrl.addEventListener('click', onTiltCtrlClick);

		// mousemove event / tilt functionality
		var onMouseMove = function(ev) {
			if( !tilt ) return false;

			mousepos = {x : ev.clientX, y : ev.clientY};
			if( tiltFrame ) return;

			tiltFrame = requestAnimationFrame(function() {
				tiltFrame = null;
				if( !tilt ) return false;

				// transform values
				var rotX = tiltRotation.rotateX ? roomTransform.rotateX -  (2 * tiltRotation.rotateX / winsize.height * mousepos.y - tiltRotation.rotateX) : 0,
					rotY = tiltRotation.rotateY ? roomTransform.rotateY +  (2 * tiltRotation.rotateY / winsize.width * mousepos.x - tiltRotation.rotateY) : 0;

				// apply transform
				applyRoomTransform({'translateX' : roomTransform.translateX, 'translateY' : roomTransform.translateY, 'translateZ' : roomTransform.translateZ, 'rotateX' : rotX, 'rotateY' : rotY});
			});
		};
		document.addEventListener('mousemove', onMouseMove);

		// select seats control click (intro button): show the room layout
		var onSelectSeats = function() {
			intro.classList.remove('intro--shown');
			// the intro slides out of the screen: its controls go out of reach too
			intro.inert = true;
			plan.classList.add('plan--shown');
			playCtrl.classList.add('action--faded');
			// the focus moves on to the plan
			tabSeat.focus({preventScroll : true});
			zoomOutScreen(function() {
				showTiltCtrl();
			});
		};
		selectSeatsCtrl.addEventListener('click', onSelectSeats);

		// play video
		playCtrl.addEventListener('click', videoPlay);
		// ended video event
		video.addEventListener('ended', videoLoad);

		// window resize: update window size
		window.addEventListener('resize', function() {
			cancelAnimationFrame(resizeFrame);
			resizeFrame = requestAnimationFrame(function() {
				winsize = {width: window.innerWidth, height: window.innerHeight};
				scaleRoom();
			});
		});
	}

	function showTiltCtrl() {
		tiltCtrl.classList.add('action--shown');
		tiltCtrl.inert = false;
	}

	// the plan seat that gets the focus when tabbing into the plan
	function setTabSeat(planseat) {
		if( tabSeat ) {
			tabSeat.tabIndex = -1;
		}
		else {
			planseats.forEach(function(el) { el.tabIndex = -1; });
		}
		tabSeat = planseat;
		tabSeat.tabIndex = 0;
	}

	// select a seat on the seat plan
	function selectSeat(planseat) {
		if( planseat.classList.contains('row__seat--reserved') ) {
			return false;
		}
		if( planseat.classList.contains('row__seat--selected') ) {
			planseat.classList.remove('row__seat--selected');
			planseat.setAttribute('aria-pressed', 'false');
			return false;
		}
		// add selected class
		planseat.classList.add('row__seat--selected');
		planseat.setAttribute('aria-pressed', 'true');

		// the real seat
		var seat = seats[planseats.indexOf(planseat)];
		// show the seat´s perspective
		previewSeat(seat);
	}

	// preview perspective from the selected seat. Moves the camera to that position.
	function previewSeat(seat) {
		// disable tilt
		disableTilt();
		// the transform of this seat´s row
		var rowTransform = new DOMMatrix(window.getComputedStyle(seat.parentNode).transform),

			// translateY value of this seat´s row
			y = rowTransform.m42,
			// translateZ value of this seat´s row
			z = rowTransform.m43,

			// seat´s center point (x-axis)
			seatCenterX = seat.offsetLeft + side_margin/2 + seat.offsetWidth/2,

			// translateX, translateY and translateZ values
			tx = seatCenterX < roomsize.x/2 ? initTransform.translateX + (roomsize.x/2 - seatCenterX) : initTransform.translateX - (seatCenterX - roomsize.x/2),
			ty = roomsize.y/2 - (roomsize.y - Math.abs(y)) + seat.offsetHeight + 10, // add a small extra
			tz = Math.abs(z)+10, // add a small extra

			// calculate how much to rotate in the x-axis (the more close to the screen the more we need to rotate):
			// the camera looks up at the screen´s center
			screenCenterY = monitor.offsetTop + monitor.offsetHeight/2,
			rotX = Math.atan2(roomsize.y/2 - ty - screenCenterY, Math.sqrt(tx * tx + (roomsize.z - tz) * (roomsize.z - tz))) * 180 / Math.PI,

			// translateZ values (absolute) of the first and the last row
			firstRowZ = roomsize.z - row_front_gap,
			lastRowZ = firstRowZ - (totalRows - 1 + row_gap_amount) * row_back,

			// calculate how much to rotate in the y-axis (the more close to the screen the more we need to rotate.
			// Also the same applies when the distance from the center of the room to both sides increases.
			// for the last row:
			minRotY_1 = 0, maxRotY_1 = 20, // min and max values for y rotation
			initialTranslationX = 0, finalTranslationX = roomsize.x/2,
			rotY_1 = lineEq(minRotY_1, maxRotY_1, initialTranslationX, finalTranslationX, tx),
			// for the first row:
			minRotY_2 = 0, maxRotY_2 = 50, // min and max values for y rotation
			rotY_2 = lineEq(minRotY_2, maxRotY_2, initialTranslationX, finalTranslationX, tx),
			// final:
			rotY = lineEq(rotY_1, rotY_2, lastRowZ, firstRowZ, Math.abs(z));

		// room transforms
		roomTransform = {
			translateX : tx,
			translateY : ty,
			translateZ : tz,
			rotateX : rotX,
			rotateY : rotY
		};

		// reduced motion: crossfade to the seat´s view
		if( reducedMotion.matches ) {
			crossfadeRoom(function() { applyRoomTransform(); });
			return;
		}

		var currentTransform = room.style.transform;
		// change transition properties
		applyRoomTransition();
		// apply transform
		applyRoomTransform();

		// the camera is already there (the same seat deselected and selected again), so no transition will end
		if( room.style.transform === currentTransform ) {
			removeRoomTransition();
			return;
		}
		onEndTransition(room, function() {
			removeRoomTransition();
		});
	}

	function zoomOutScreen(callback) {
		// reduced motion: crossfade to the room´s view
		if( reducedMotion.matches ) {
			crossfadeRoom(function() { applyRoomTransform(initTransform); }, callback);
			return;
		}
		applyRoomTransition({'speed' : 1500, 'easing' : 'ease'});
		applyRoomTransform(initTransform);
		onEndTransition(room, function() {
			removeRoomTransition();
			callback.call();
		});
	}

	// fades the room out, changes the view and fades the room back in (instead of moving the camera)
	function crossfadeRoom(change, callback) {
		container.classList.add('container--faded');
		onEndTransition(container, function() {
			change();
			container.classList.remove('container--faded');
			if( callback ) { callback.call(); }
		});
	}

	function disableTilt() {
		tiltCtrl.classList.add('action--disabled');
		tiltCtrl.setAttribute('aria-pressed', 'false');
		tilt = false;
	}

	function enableTilt() {
		tiltCtrl.classList.remove('action--disabled');
		tiltCtrl.setAttribute('aria-pressed', 'true');
		tilt = true;
	}

	function videoPlay() {
		// hide the play control
		playCtrl.classList.remove('action--shown');
		playCtrl.inert = true;
		video.currentTime = 0;
		// if the video can´t play, the play control shows again
		video.play().catch(videoLoad);
	}

	function videoLoad() {
		// show the play control
		playCtrl.classList.add('action--shown');
		playCtrl.inert = false;
		video.load();
	}

	init();

})(window);
