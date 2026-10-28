# Video player test plan

## Scope

The video player lets users review an asset without downloading it. I focused on three risks: a video that will not play, controls that show the wrong state, and losing the current playback position.

The scope is loading, playback, timing, seeking, volume, speed, fullscreen and delivery errors. Authentication and onboarding are setup steps. Auth flows and team management are excluded, as requested in the assignment.

## Environment and data

Exploration used desktop Chrome on macOS, Pics.io Storage and frontend build `8.23.1` on 27 October 2026. The test video was `How to organise files in Pics.io.mp4` from `Onboarding documents`: 48.466667 seconds, displayed as `00:48`.

For a local run, use this video or an owned video longer than ten seconds with audio. Start with a valid session, playback paused at the beginning and nonzero, unmuted volume. Each test gets a fresh browser context. The setup command finds the onboarding video and saves its URL and session in the Git-ignored `.auth/` directory. A custom video URL is optional.

[RESULTS.md](RESULTS.md) records the completed checks. This plan also describes how to assess UI, performance and security alongside the automated cases.

## Priorities and cases

P0 covers opening and playing a valid video. P1 covers everyday controls and recovery after interrupted delivery. P2 covers error feedback. These are test priorities; defect severity depends on user impact.

| ID | Priority | Check and expected result | Approach |
| --- | --- | --- | --- |
| VP-01 | P0 | Open video; finite duration, valid dimensions, matching duration display, no media error | Playwright |
| VP-02 | P0 | Play advances time; pause holds it; resume continues; UI clock follows media | Playwright |
| VP-03 | P1 | Seek forward/back by two seconds while paused; clock matches; time cannot go below zero | Playwright |
| VP-04 | P1 | Mute/unmute, restore volume, reach slider limits with Home/End | Playwright |
| VP-05 | P1 | Select 1.5× and Normal; menu label and media rate agree | Playwright |
| VP-06 | P1 | Toggle fullscreen with its button; retain asset, position and paused state | Playwright |
| VP-08a | P1 | Show loading while the media request is delayed; play after delivery resumes | Playwright |
| VP-08b | P1 | Reset the media connection; restore delivery and reload the same asset successfully | Playwright |
| VP-08c | P1 | Go offline during media loading; reconnect and reload successfully | Playwright |
| VP-08d | P2 | Clear the loading indicator after a simulated HTTP 503 media response | Playwright |
| VP-08e | P2 | Leave loading after a media connection reset | Playwright |

These cases suit automation because they are repeatable and have clear checks: media state, timing, control values and loading feedback. Keep visual judgement and questions about intended behavior in the review rather than turning assumptions into assertions.

## Test approach

**Functionality and boundaries.** Check that each control changes the video state and that the displayed time follows it. The automated boundary checks cover seeking below zero and the volume slider's minimum and maximum.

**UI and UX.** Review readable timing, loading feedback, focus and control placement at desktop and narrow widths. Check accessible control names. Confirm the intended Escape behavior with product before calling the observed preview closure a defect.

**API and networking.** Read the media URL from the loaded video and intercept matching requests in the browser. Hold delivery for two seconds, reset the connection, go offline during loading, or return HTTP 503. Check the loading indicator and playback after restoring delivery. Reset/offline recovery uses a page reload. Record response status and content type without saving the temporary media URL.

**Performance and metrics.** Measure time to first frame, seek recovery and the proportion of playback spent buffering. Use the same video and connection, separate cold and warm cache, and compare median/p95 over 20 sequential samples. Suggested starting targets for discussion: warm first frame within two seconds, seek recovery within one second and buffering below 1% of playing time. These are proposed benchmarks, not results from this suite.

**Security and privacy.** Stay within the configured test asset. Check HTTPS delivery and whether messages or reports expose session data or temporary media URLs. Keep credentials, sessions and raw network evidence out of Git.

**Compatibility.** Run the same cases in Chrome, Firefox and Playwright WebKit. Record the browser version and operating system with each result so failures can be compared. The completed runs used Chrome and WebKit on macOS, and Firefox on Linux.

## Execution and reporting

Tools used here: Playwright, TypeScript, Chrome, Firefox, WebKit, ESLint, Node's test runner and OpenAI Codex. Their roles and the local setup are described in the README. In a team workflow, use DevTools for network investigation, Postman for documented API checks, and Qase/Jira to track cases and defects.

Use one worker and disable automatic retries. For a P0 smoke check, run `npm test -- --grep @P0`, then run the full suite. Repeat selected cases to look for inconsistent results. Track pass rate, failures by case/browser, flaky outcomes and setup blockers separately.

Report findings with the build, browser, video, short reproduction steps, expected and actual behavior, impact and safe-to-share evidence. Send the team a short summary of results and any release blockers. Discuss uncertain behavior with product and playback or delivery failures with engineering.

Start when the test asset opens, onboarding is complete and the session is valid. Finish the selected scope when P0 passes, P1 failures are fixed or accepted, the browser runs are complete and findings have been triaged. Treat an unresolved critical or high-impact player defect as a release blocker.
