# Pics.io video player

I chose the video player because a broken preview stops users from reviewing an asset. The tests focus on playback, the main controls and recovery when video delivery is interrupted.

The project contains eleven TypeScript/Playwright tests, a [test plan](TEST_PLAN.md) and [results](RESULTS.md).

**Latest results, 27 October 2026:** eleven passing cases per engine — 33 results, with retries disabled. Chrome and WebKit ran on macOS; Firefox ran on Linux.

## Coverage

| Test | What it checks |
| --- | --- |
| VP-01 | Load the video and check its duration and initial state |
| VP-02 | Play, pause and resume; check the elapsed time |
| VP-03 | Seek two seconds forward and back; stop at zero |
| VP-04 | Mute, unmute and change the volume |
| VP-05 | Change speed to 1.5× and back to Normal |
| VP-06 | Enter and leave fullscreen using the button; keep the playback position |
| VP-08a | Show loading during a two-second delivery delay, then play |
| VP-08b | Play after a connection reset and a page reload |
| VP-08c | Play after reconnecting and reloading the page |
| VP-08d | Clear the loading indicator after a simulated HTTP 503 response |
| VP-08e | Clear the loading indicator after a connection reset |

Network tests intercept requests for the loaded video inside the test browser. The delay holds a media request for two seconds. Recovery from a reset or offline state includes a page reload.

## Local setup

You need Node.js 24 LTS (or 22.21+), npm, Google Chrome and a Pics.io test account.

```sh
npm ci
cp .env.example .env.local
```

Fill in `PICSIO_EMAIL` and `PICSIO_PASSWORD` in `.env.local`. Use your Pics.io test-account password. Quote a password containing spaces or `#`. Leave both fields blank if you prefer to sign in manually.

### Prepare the session

Complete onboarding once in Pics.io: select Pics.io Storage and continue to the library. Then run:

```sh
npm run login
```

The helper opens Chrome and signs in using the local credentials, or waits for manual sign-in. Complete any verification in the window yourself. It opens `Onboarding documents`, requires one video and verifies the filename `How to organise files in Pics.io.mp4`.

It saves the session to `.auth/state.json` and the selected video to `.auth/fixture.json`, then closes its browser. Both files are local and ignored by Git. No path or video URL needs to be entered for the trial's onboarding clip.

To use your own video, set the optional `PICSIO_VIDEO_URL` in `.env.local` to its `https://pics.io/preview/<asset-id>` URL. Use a video longer than ten seconds with audio. An absent or ambiguous onboarding video stops setup with an error; it does not select an arbitrary asset.

Repeat `npm run login` when the session expires or you change accounts. Authentication and onboarding are preparation steps, outside the tested feature. The suite reuses the session for isolated test contexts.

### Run

```sh
npm run check
npm test -- --project=chromium
npm run report
```

To run all three browser projects, install the additional engines:

```sh
npx playwright install firefox webkit
npm test
```

Select an engine with `--project=chromium`, `--project=firefox` or `--project=webkit`. The Chromium project uses installed Google Chrome; WebKit uses Playwright's engine build. Firefox results were obtained on Ubuntu because of a profile-launch error on this macOS host; see the report.

Use `npm run test:headed -- --project=chromium` to watch a run, `npm run test:list` to list cases, or `npm run test:repeat -- --project=chromium` for three repetitions.

## Structure and choices

- `video-player.spec.ts`: six tests for playback and controls.
- `video-network.spec.ts`: five tests for delayed or interrupted delivery.
- `player.fixture.ts`: selectors, media checks and response summaries.
- `playwright.config.ts`: browsers, timeouts and reports.
- `preflight.ts`: checks the configuration and session file.
- `login.mjs`: signs in once and prepares the video fixture.
- `support/`: shared settings, private file handling and video discovery.
- `checks/`: offline regression checks for configuration and session handling.
- `.github/workflows/checks.yml`: lint, typecheck, settings checks and test discovery without account credentials.

Seek controls use test IDs; speed options use menu-item names. Play and mute have no accessible button names in the inspected build, so those selectors use CSS scoped to the player. Actions go through the UI, and assertions check the video state and visible clock.

Each test gets a fresh browser context. Network tests block service workers so requests reach the interception handlers, then remove the simulated faults and restore connectivity in teardown. Retries are disabled to make failures visible.

`npm run check` runs ESLint, TypeScript, six offline settings checks and test discovery. Typed lint rules catch unhandled promises. The CI workflow runs these checks; E2E runs require a locally prepared session.

The preflight check validates the saved session and video URL before launching tests. It has no browser actions. Interactive login stays in a separate command so routine test runs do not trigger sign-in or onboarding.

Reports, failure screenshots and `.auth/` are ignored by Git. Traces are off by default because they can contain temporary media URLs; use `PICSIO_TRACE=1` for local debugging. Response summaries contain only status and content type.

AI assistance: OpenAI Codex helped with the project structure, selector suggestions, documentation and checking the tests.
