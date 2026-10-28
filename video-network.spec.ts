import { test, expect, type VideoPlayer } from './player.fixture.js';

test.use({ serviceWorkers: 'block' });
test.setTimeout(90_000);

async function mediaMatch(player: VideoPlayer) {
  const source = new URL(await player.video.evaluate((v: HTMLVideoElement) => v.currentSrc));
  return (url: URL) => url.origin === source.origin && url.pathname === source.pathname;
}

async function expectPlayback(player: VideoPlayer) {
  await player.expectReady();
  const before = await player.time();
  await player.togglePlayback.click();
  await expect(player.video).toHaveJSProperty('paused', false);
  await expect.poll(() => player.time()).toBeGreaterThan(before + 0.5);
  await player.expectClockMatchesVideo();
}

test('VP-08a @P1 shows loading during delayed media delivery and then plays', async ({ page, player }, testInfo) => {
  const matches = await mediaMatch(player);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let held = 0;
  await page.route(matches, async route => {
    held++;
    await gate;
    await route.continue();
  });
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => held, { timeout: 30_000 }).toBeGreaterThan(0);
    const heldAt = Date.now();
    // The two-second hold is the injected latency, not a page synchronization wait.
    await expect.poll(async () => {
      await expect(player.loading).toContainText('Loading video...');
      expect(await player.video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeLessThan(2);
      return Date.now() - heldAt;
    }, { intervals: [250] }).toBeGreaterThanOrEqual(2_000);
    release();
    await expectPlayback(player);
    await testInfo.attach('network-condition', {
      body: JSON.stringify({ condition: 'media request held for at least 2 seconds', recovery: 'automatic after release' }),
      contentType: 'application/json',
    });
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('VP-08b @P1 plays after a media connection reset and an explicit reload', async ({ page, player }, testInfo) => {
  const matches = await mediaMatch(player);
  let failedRequests = 0;
  await page.route(matches, async route => {
    failedRequests++;
    await route.abort('connectionreset');
  });
  try {
    await Promise.all([
      page.waitForEvent('requestfailed', {
        predicate: request => matches(new URL(request.url())), timeout: 30_000,
      }),
      page.reload({ waitUntil: 'domcontentloaded' }),
    ]);
    await expect.poll(() => failedRequests, { timeout: 30_000 }).toBeGreaterThan(0);
    await testInfo.attach('failed-media-state', {
      body: JSON.stringify({
        mediaErrorCode: await player.video.evaluate((v: HTMLVideoElement) => v.error?.code),
        loadingVisible: await player.loading.isVisible(),
        recovery: 'explicit page reload after restoring delivery',
      }), contentType: 'application/json',
    });
    await page.unrouteAll({ behavior: 'wait' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectPlayback(player);
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('VP-08c @P1 recovers after the browser goes offline during a media request', async ({ page, context, player }) => {
  const matches = await mediaMatch(player);
  let disconnected = false;
  await page.route(matches, async route => {
    if (!disconnected) {
      disconnected = true;
      await context.setOffline(true);
    }
    await route.continue();
  });
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => disconnected, { timeout: 30_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await expect.poll(() => player.video.evaluate((v: HTMLVideoElement) => v.error?.code ?? 0))
      .toBeGreaterThan(0);
    await context.setOffline(false);
    await page.unrouteAll({ behavior: 'wait' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectPlayback(player);
  } finally {
    await context.setOffline(false);
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('VP-08d @P2 leaves the loading state after an HTTP 503 media response', async ({ page, player }) => {
  const matches = await mediaMatch(player);
  await page.route(matches, route => route.fulfill({
    status: 503,
    contentType: 'text/plain',
    headers: { 'access-control-allow-origin': 'https://pics.io', 'cache-control': 'no-store' },
    body: 'Media unavailable for this test',
  }));
  try {
    await Promise.all([
      page.waitForResponse(response => matches(new URL(response.url())) && response.status() === 503),
      page.reload({ waitUntil: 'domcontentloaded' }),
    ]);
    await expect.poll(() => player.video.evaluate((v: HTMLVideoElement) => v.error?.code ?? 0))
      .toBeGreaterThan(0);
    await expect(player.loading).toBeHidden({ timeout: 5_000 });
    await player.expectPreviewOpen();
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('VP-08e @P2 leaves the loading state after a media connection reset', async ({ page, player }, testInfo) => {
  const matches = await mediaMatch(player);
  await page.route(matches, route => route.abort('connectionreset'));
  try {
    await Promise.all([
      page.waitForEvent('requestfailed', {
        predicate: request => matches(new URL(request.url())), timeout: 30_000,
      }),
      page.reload({ waitUntil: 'domcontentloaded' }),
    ]);
    await testInfo.attach('connection-reset-state', {
      body: JSON.stringify({
        mediaErrorCode: await player.video.evaluate((v: HTMLVideoElement) => v.error?.code ?? null),
        loadingVisible: await player.loading.isVisible(),
      }), contentType: 'application/json',
    });
    await expect(player.loading).toBeHidden({ timeout: 5_000 });
    await player.expectPreviewOpen();
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
  }
});
