# Test results — 27 October 2026

## Latest verification

The checks used the Pics.io Storage trial, frontend build `8.23.1` and Playwright `1.64.1`. The setup command selected `How to organise files in Pics.io.mp4`, the trial's 48-second onboarding clip, and saved the local session and fixture automatically.

| Engine | Platform | Player cases | Delivery/error cases | Total |
| --- | --- | --- | --- | --- |
| Google Chrome 156.0.8078.48 | macOS 27.0.1 | 6/6 passed | 5/5 passed | 11/11 |
| Firefox 157.0 | Ubuntu 24.04 | 6/6 passed | 5/5 passed | 11/11 |
| Playwright WebKit 27.2 | macOS 27.0.1 | 6/6 passed | 5/5 passed | 11/11 |

**The latest complete run for each engine passed: 33 case results.** Automatic retries were disabled throughout.

Firefox exited with `Could not find profile folder` on the macOS host, so its checks ran on Ubuntu 24.04. WebKit refers to Playwright's browser build.

## Setup and code checks

Email/password sign-in, automatic onboarding-video selection and private `.auth/` files were verified on the test account. Neither the video URL nor a session-file path was supplied in the local environment.

ESLint, TypeScript, all six offline settings checks, test discovery and diff checks passed. A clean source copy without credentials or `.auth/` also passed `npm ci` and `npm run check`. The GitHub workflow runs those code checks; it has not yet run on GitHub.

## Coverage

The player tests checked loading and duration, play/pause/resume, two-second seeks and the start boundary, mute and volume, playback speed, and entering and leaving fullscreen with the button. Assertions compared the controls and visible clock with the video state.

| Delivery condition | Result in all three engines |
| --- | --- |
| Media request held for at least two seconds | Loading displayed; playback started after release |
| Connection reset during media loading | The same asset played after delivery was restored and the page reloaded |
| Browser offline during media loading | The same asset played after reconnecting and reloading |
| Simulated HTTP 503 for the media request | The loading indicator disappeared after the media error |
| Media connection reset: loading feedback | The loading indicator disappeared within the five-second assertion window |

The tests simulated delivery faults inside the browser for the loaded video. The delay held a media request for at least two seconds. Recovery from a reset or offline state included restoring connectivity and reloading the page.

## Findings

### F-01: Escape closes the preview when leaving fullscreen

Reproduced in Chrome 156 without extensions and twice in the original browser session. Suggested priority: P2, subject to confirmation of the intended behavior.

1. Open the onboarding video, pause it and seek to 2 s.
2. Enter fullscreen with the player control.
3. Press Escape once.

Actual: the app returns to the collection. Leaving fullscreen with the button keeps the preview open at the same position.

Expected behavior to confirm with product: Escape leaves fullscreen and keeps the preview open. VP-06 checks the fullscreen button; this finding concerns the keyboard shortcut.

### F-02: Play and mute lack accessible button names

The inspected `.btnPlayVideo` and `.btnVolumeVideo` controls are divs with `role="presentation"`, no accessible name and no tabindex. They are not exposed as named play/pause or mute buttons in the accessibility tree. Suggested priority: P2.

Expected: controls with a clear name, keyboard operation and an understandable state. The finding is based on DOM and accessibility-tree inspection. The tests use CSS selectors scoped to the player for these two controls.
