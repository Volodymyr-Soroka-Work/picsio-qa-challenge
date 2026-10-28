import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { getVideoUrl } from './support/settings.mjs';

export { expect };

// These selectors were inspected in the live 8.23.1 player. Play/mute expose
// role=presentation rather than accessible button names, so scoped CSS is needed.
export class VideoPlayer {
  readonly root: Locator;
  readonly video: Locator;
  readonly togglePlayback: Locator;
  readonly toggleMute: Locator;
  readonly volume: Locator;
  readonly clock: Locator;
  readonly loading: Locator;
  readonly assetName: Locator;

  constructor(readonly page: Page, readonly assetUrl: string) {
    this.root = page.locator('.wrapperBeautyVideo');
    this.video = this.root.locator('video');
    this.togglePlayback = this.root.locator('.btnPlayVideo');
    this.toggleMute = this.root.locator('.btnVolumeVideo');
    this.volume = this.root.getByRole('slider');
    this.clock = this.root.locator('.timeCurrentVideo');
    this.loading = this.root.locator('.previewViewSpinner');
    this.assetName = page.locator('.assetName input');
  }

  async expectPreviewOpen() {
    await expect(this.page).toHaveURL(this.assetUrl);
    await expect(this.assetName).toBeVisible();
  }

  async expectReady() {
    await this.expectPreviewOpen();
    await expect(this.video, 'Video missing: check session, trial access and prepared fixture')
      .toHaveCount(1, { timeout: 30_000 });
    await expect.poll(() => this.video.evaluate((v: HTMLVideoElement) => v.readyState), {
      message: 'Media reaches HAVE_FUTURE_DATA', timeout: 30_000,
    }).toBeGreaterThanOrEqual(3);
    await expect(this.video).toHaveJSProperty('error', null);
  }

  async time() {
    return this.video.evaluate((video: HTMLVideoElement) => video.currentTime);
  }

  async expectPaused() {
    await expect(this.video).toHaveJSProperty('paused', true);
    const pausedAt = await this.time();
    const sampledAt = Date.now();
    await expect.poll(async () => {
      expect(Math.abs((await this.time()) - pausedAt)).toBeLessThan(0.15);
      return Date.now() - sampledAt;
    }, { message: 'Playback time stays still for at least 500 ms while paused', intervals: [100, 200, 300] })
      .toBeGreaterThanOrEqual(500);
  }

  async expectClockMatchesVideo() {
    await expect.poll(async () => {
      const text = await this.clock.innerText();
      const parts = text.split(':').map(Number);
      const displayed = parts.reduce((seconds, value) => seconds * 60 + value, 0);
      return Math.abs(displayed - (await this.time()));
    }, { message: 'Visible elapsed time agrees with the media clock within one second' }).toBeLessThan(1.1);
  }
}

export const test = base.extend<{ player: VideoPlayer }>({
  player: async ({ page, browser }, use, testInfo) => {
    const startedAt = Date.now();
    const mediaResponses: Array<{ status: number; contentType: string }> = [];
    page.on('response', response => {
      const contentType = response.headers()['content-type'] ?? '';
      if (contentType.startsWith('video/') || response.request().resourceType() === 'media') {
        // Never write response URLs, request headers, or response bodies to reports.
        mediaResponses.push({ status: response.status(), contentType });
      }
    });
    try {
      const player = new VideoPlayer(page, getVideoUrl());
      await page.goto(player.assetUrl, { waitUntil: 'domcontentloaded' });
      await player.expectReady();
      await testInfo.attach('environment', {
        body: JSON.stringify({ browser: browser.version(), metadataReadyMs: Date.now() - startedAt }),
        contentType: 'application/json',
      });
      await use(player);
    } catch (error) {
      if (!page.isClosed()) {
        const media = await page.locator('.wrapperBeautyVideo video').evaluateAll(elements => elements.map(element => {
          const video = element as HTMLVideoElement;
          return { readyState: video.readyState, networkState: video.networkState, mediaErrorCode: video.error?.code ?? null };
        }));
        await testInfo.attach('player-failure-state', {
          body: JSON.stringify({ media, errorMessageVisible: await page.getByText('Something went wrong', { exact: true }).isVisible() }),
          contentType: 'application/json',
        });
      }
      throw error;
    } finally {
      await testInfo.attach('media-response-summary', {
        body: JSON.stringify(mediaResponses), contentType: 'application/json',
      });
      // The built-in page/context fixtures capture failures and stop playback at teardown.
    }
  },
});
