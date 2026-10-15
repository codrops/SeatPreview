# AGENTS.md

Notes for coding agents working on this repo. Read [README.md](README.md) first for what the demo is.

## Setup

- No package.json and nothing to install. Plain HTML, CSS and one classic script (`js/main.js`), no libraries.
- Serve the root with any static server (`npx serve .`, `npx http-server`, `python3 -m http.server`). For anything that touches the video, use one that answers range requests (`npx serve .` or `npx http-server`): the MP4's metadata sits at the end of the file, so with `preload="metadata"` the browser fetches its start and end by range. `python3 -m http.server` ignores ranges, so there the whole file downloads on load and seeking fails.
- `css/component.css` (and its `.map`) is compiled from `css/component.scss`. Edit the `.scss` and run `npx sass css/component.scss css/component.css` (Dart Sass). Don't edit `component.css` by hand. `css/demo.css` is plain CSS.
- There are no automated tests. Check a change in a browser: click "Select your seats", pick seats in the front, middle and back rows (A1, E5, J9, R18), deselect a seat and select it again, turn on Look around and move the mouse, play the video to the end. Do it again with the keyboard (Tab, arrow keys, Enter) and with reduced motion on, then check a phone width (plan only) and a wide, short window (around 1600x640). Look at the console.

## Map

| Path                 | What it is                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`         | The page: the frame, the room (`.container` > `.cube`: walls, the screen with the video and the intro, 18 rows of 18 seats), the seat plan (`.plan`, 324 buttons) and the Look around toggle. |
| `js/main.js`         | Everything that moves: room scale, camera, seat selection, tilt, video, keyboard navigation in the plan, the loading state.                 |
| `css/component.scss` | The room's geometry (Sass variables and the row loops), the screen, the plan, the controls and the small-screen layout. Source of `component.css`. |
| `css/demo.css`       | Page base, the Codrops frame, the loading cover, focus styles.                                                                               |
| `img/`               | `seat.svg` (the seats in the room) and the icons (camera, seats, play, lookaround).                                                          |
| `media/`             | The Sintel trailer (`sintel.mp4`, H.264, 1280x720, 16s) and its poster `sintel.jpg`.                                                         |

## How the camera works

- The room is CSS 3D. `.container` has `perspective: 2000px` and is scaled (`scaleRoom()`) so the room (1920x1000, 3000 deep) fits the viewport's width, or its height in windows wider than about 1.92:1.
- The camera is the room's transform: `translate3d(0,0,2000px) rotate3d(x, rotateX) rotate3d(y, rotateY) translate3d(tx, ty, tz)`, built by `applyRoomTransform()` from `{translateX, translateY, translateZ, rotateX, rotateY}`. Called without an argument it uses `roomTransform`, the current seat's view. The first translate puts the room's center at the eye, so the eye sits at (−tx, −ty, −tz) from the room's center. Positive `rotateX` looks up.
- `previewSeat()` reads the seat row's `translateY`/`translateZ` from its computed transform (`DOMMatrix` `m42`/`m43`), puts the eye just above the seat back, and turns it to the screen: `rotateY` from the author's line equations (by row and by distance from the center), `rotateX` aimed at the screen's center.
- Moves are CSS transitions on the room (`applyRoomTransition()`), removed again on `transitionend`, because the tilt writes the transform on every frame and would lag behind the mouse otherwise. A move that doesn't change the transform gets no `transitionend`, so `previewSeat()` checks for that and doesn't wait.
- With `prefers-reduced-motion: reduce` the camera doesn't fly: `crossfadeRoom()` fades `.container` out, applies the new view and fades it back in.
- The tilt (Look around) adds up to ±25° on x and ±15° on y to `roomTransform`, from the mouse position, once per frame.
- The geometry lives in two places that must match: the Sass variables at the top of `component.scss`, and `row_front_gap`, `row_back`, `row_gap_amount`, `perspective` and `roomsize.y`/`z` in `main.js`. Change both together.
- Plan seats and room seats match by index (`planseats[i]` is `seats[i]`). Reserved seats are marked only in the plan.

## Conventions

- **Keyboard and screen readers.** Plan seats are `<button>`s labelled "Row X, seat N" with `aria-pressed` (free) or `aria-disabled="true"` (reserved). The plan is a single tab stop: `setTabSeat()` moves the roving `tabIndex`, `onPlanKeydown` handles the arrow keys. Controls that are out of sight are out of reach too: `inert` on the intro once it slides away, on the Look around toggle until it shows and on the play control while the video plays, and the plan is `visibility: hidden` until `.plan--shown`. Focus rings are `:focus-visible` in `demo.css`. Keep all of this when changing the markup.
- **Loading.** `body.loading` covers the page until the poster and the intro icons are decoded (`preloadImages()`), then the cover fades out. Add any image that's visible on load to that list.
- **Small screens** (`max-width: 50em` or `max-height: 38em`) show the plan only, and the page scrolls. The room stays laid out but hidden (`visibility: hidden`, `position: fixed`), because `main.js` measures the seats at load.
- **Hover styles** are inside `@media (hover: hover)`, so they don't stick after a tap.

## Style

- Tabs for indentation, single quotes, semicolons.
- `main.js` is ES5 in an IIFE: one long `var` chain for the state, `function` declarations, `[].slice.call(...)`, `if( cond )` with spaces inside the parentheses. Comments are lowercase and sit above the line they explain (`// the real seat`), and the author writes the apostrophe as ´ (`seat´s`). Follow it.
- CSS class names are `block__element--modifier`, with state modifiers like `--shown`, `--selected` and `--faded`.
- No libraries and no build tooling other than Sass unless asked.

## Ask before changing

- The `<title>`, meta description and keywords, the social meta, the `frame__title`, the frame links (Article, GitHub) and the tags (`#3d #cinema #room`, the same as the demo's Hub entry).
- The credits and the License section of the README.
- The original page's camera feel: the rotation constants in `previewSeat()`, the transition speeds and eases, the tilt range.
