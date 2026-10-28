import { expect } from '@playwright/test';
import { APP_URL, DEMO_VIDEO_NAME, validateVideoUrl } from './settings.mjs';

/** @param {import('@playwright/test').Page} page @param {string | undefined} override */
export async function prepareVideo(page, override) {
  if (override?.trim()) {
    await page.goto(validateVideoUrl(override), { waitUntil: 'domcontentloaded' });
  } else {
    await page.getByRole('treeitem', { name: 'Onboarding documents', exact: true }).click();
    // Grid tiles have no accessible filename. Require a single video, then verify its name in preview.
    const videos = page.locator('#tiles .catalogItem.isVideo');
    await expect(videos, 'Expected one onboarding video. Set PICSIO_VIDEO_URL to choose another asset.')
      .toHaveCount(1, { timeout: 30_000 });
    await videos.dblclick();
    await expect(page.locator('.assetName input')).toHaveValue(DEMO_VIDEO_NAME);
  }
  await expect(page).toHaveURL(new RegExp(`^${APP_URL.replaceAll('.', '\\.')}\\/preview\\/[a-f\\d]{24}\\/?$`));
  const video = page.locator('.wrapperBeautyVideo video');
  await expect(video).toHaveCount(1, { timeout: 30_000 });
  await expect.poll(() => video.evaluate(element => /** @type {HTMLVideoElement} */ (element).readyState), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(3);
  await expect(video).toHaveJSProperty('error', null);
  const duration = await video.evaluate(element => /** @type {HTMLVideoElement} */ (element).duration);
  expect(Number.isFinite(duration) && duration > 10, 'Use a video longer than ten seconds').toBe(true);
  return {
    videoUrl: validateVideoUrl(page.url()),
    name: await page.locator('.assetName input').inputValue(),
    preparedAt: new Date().toISOString(),
  };
}
