import { chromium } from '@playwright/test';
import { APP_URL, STATE_FILE, FIXTURE_FILE, isPicsioHost, readCredentials, writePrivateJson } from './support/settings.mjs';
import { prepareVideo } from './support/prepare-video.mjs';

const { email, password } = readCredentials();

// Prepare a session once; authentication and onboarding are not test cases.
const browser = await chromium.launch({ headless: false, channel: 'chrome' });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded' });
  if (email) {
    if (new URL(page.url()).origin !== APP_URL) {
      throw new Error('Unexpected sign-in origin.');
    }
    const rejectCookies = page.getByRole('button', { name: 'Reject All', exact: true });
    if (await rejectCookies.isVisible()) await rejectCookies.click();
    const form = page.locator('form[data-mode="login"]');
    await form.getByLabel('Email', { exact: true }).fill(email);
    await form.getByLabel('Password', { exact: true }).fill(password);
    await form.getByRole('button', { name: 'Log in', exact: true }).click();
    console.log('Sign-in submitted. Complete any verification or onboarding in Chrome.');
  } else {
    console.log('Sign in in Chrome and finish onboarding. Waiting for the library.');
  }
  await page.locator('#button-add').waitFor({ state: 'visible', timeout: 600_000 });
  const fixture = await prepareVideo(page, process.env.PICSIO_VIDEO_URL);
  const state = await context.storageState({ indexedDB: true });
  const session = {
    cookies: state.cookies.filter(cookie => isPicsioHost(cookie.domain.replace(/^\./, ''))),
    origins: state.origins.filter(origin => isPicsioHost(new URL(origin.origin).hostname)),
  };
  await writePrivateJson(STATE_FILE, session);
  await writePrivateJson(FIXTURE_FILE, fixture);
  console.log('Session and video fixture saved in .auth/. You can now run npm test.');
} catch {
  // Playwright action errors can include filled values. Keep credentials out of logs.
  console.error('Setup did not finish. Check sign-in, verification and the onboarding video in Chrome. For another video, set PICSIO_VIDEO_URL and run setup again.');
  process.exitCode = 1;
} finally {
  await browser.close();
}
