import { test, expect } from './player.fixture.js';

test('VP-01 @P0 loads a decodable video and shows its duration', async ({ player }) => {
  const metadata = await player.video.evaluate((v: HTMLVideoElement) => ({
    duration: v.duration, width: v.videoWidth, height: v.videoHeight,
  }));
  expect(Number.isFinite(metadata.duration)).toBe(true);
  expect(metadata.duration).toBeGreaterThan(10);
  expect(metadata.width).toBeGreaterThan(0);
  expect(metadata.height).toBeGreaterThan(0);
  const durationText = await player.root.locator('.timeFullVideo').innerText();
  const displayed = durationText.split(':').map(Number).reduce((sum, n) => sum * 60 + n, 0);
  expect(Math.abs(displayed - metadata.duration)).toBeLessThan(1.1);
  await player.expectPaused();
});

test('VP-02 @P0 plays, pauses without clock drift, and resumes', async ({ player }) => {
  const before = await player.time();
  await player.togglePlayback.click();
  await expect(player.video).toHaveJSProperty('paused', false);
  await expect.poll(() => player.time()).toBeGreaterThan(before + 0.5);
  await expect(player.video).toBeVisible();
  await player.expectClockMatchesVideo();
  await player.togglePlayback.click();
  await player.expectPaused();
  const pausedAt = await player.time();
  await player.togglePlayback.click();
  await expect.poll(() => player.time()).toBeGreaterThan(pausedAt + 0.5);
  await expect(player.video).toHaveJSProperty('error', null);
});

test('VP-03 @P1 seeks by two seconds in each direction and clamps at zero', async ({ player }) => {
  await player.expectPaused();
  const before = await player.time();
  await player.root.getByTestId('actionRewindRightButton').click();
  await expect.poll(async () => Math.abs((await player.time()) - before - 2)).toBeLessThan(0.25);
  await player.expectClockMatchesVideo();
  await player.root.getByTestId('actionRewindLeftButton').click();
  await expect.poll(async () => Math.abs((await player.time()) - before)).toBeLessThan(0.25);
  await player.root.getByTestId('actionRewindLeftButton').click();
  await expect.poll(() => player.time()).toBe(0);
  await player.expectPaused();
});

test('VP-04 @P1 mutes, restores volume and changes it through the slider', async ({ player }) => {
  const initial = await player.video.evaluate((v: HTMLVideoElement) => ({ muted: v.muted, volume: v.volume }));
  expect(initial.muted).toBe(false);
  expect(initial.volume).toBeGreaterThan(0);
  await player.toggleMute.click();
  await expect(player.video).toHaveJSProperty('muted', true);
  await player.toggleMute.click();
  await expect(player.video).toHaveJSProperty('muted', false);
  await expect.poll(() => player.video.evaluate((v: HTMLVideoElement) => v.volume)).toBeCloseTo(initial.volume, 2);
  await player.volume.press('Home');
  await expect(player.video).toHaveJSProperty('volume', 0);
  await player.volume.press('End');
  await expect(player.video).toHaveJSProperty('volume', 1);
  await expect(player.volume).toHaveValue('1');
});

test('VP-05 @P1 changes playback speed and restores Normal', async ({ page, player }) => {
  const settings = player.root.locator('.playerGearMenu');
  await settings.click();
  await page.getByRole('menuitem', { name: /^Speed/ }).click();
  await page.getByRole('menuitem', { name: '1.5', exact: true }).click();
  await expect(player.video).toHaveJSProperty('playbackRate', 1.5);
  await expect(page.getByRole('menuitem', { name: /^Speed/ })).toContainText('1.5');
  await page.getByRole('menuitem', { name: /^Speed/ }).click();
  await page.getByRole('menuitem', { name: 'Normal', exact: true }).click();
  await expect(player.video).toHaveJSProperty('playbackRate', 1);
  await expect(page.getByRole('menuitem', { name: /^Speed/ })).toContainText('Normal');
});

test('VP-06 @P1 toggles fullscreen with the player control and keeps position', async ({ page, player }) => {
  const initial = await player.time();
  await player.root.getByTestId('actionRewindRightButton').click();
  await expect.poll(async () => Math.abs((await player.time()) - initial - 2)).toBeLessThan(0.25);
  await expect(player.video).toHaveJSProperty('seeking', false);
  const before = await player.time();
  await player.root.locator('#btnFullscreenVideo').click();
  await expect.poll(() => player.video.evaluate((video: HTMLVideoElement) =>
    Boolean(video.ownerDocument.fullscreenElement?.contains(video)))).toBe(true);
  await expect(player.video).toBeInViewport();
  await player.root.locator('#btnFullscreenVideo').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect.poll(async () => Math.abs((await player.time()) - before)).toBeLessThan(0.25);
  await player.expectPaused();
});
