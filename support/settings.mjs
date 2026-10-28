import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = fileURLToPath(new URL('../', import.meta.url));
export const AUTH_DIR = join(ROOT_DIR, '.auth');
export const STATE_FILE = join(AUTH_DIR, 'state.json');
export const FIXTURE_FILE = join(AUTH_DIR, 'fixture.json');
export const APP_URL = 'https://pics.io';
export const DEMO_VIDEO_NAME = 'How to organise files in Pics.io.mp4';

const envFile = join(ROOT_DIR, '.env.local');
if (existsSync(envFile)) loadEnvFile(envFile);

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {string} hostname */
export function isPicsioHost(hostname) {
  return hostname === 'pics.io' || hostname.endsWith('.pics.io');
}

/** @param {unknown} value */
export function validateVideoUrl(value) {
  const message = 'Use a Pics.io /preview/<asset-id> URL without query parameters or a fragment.';
  if (typeof value !== 'string') throw new Error(message);
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(message);
  }
  if (url.origin !== APP_URL || url.username || url.password || url.search || url.hash ||
      !/^\/preview\/[a-f\d]{24}\/?$/.test(url.pathname)) throw new Error(message);
  return `${APP_URL}${url.pathname.replace(/\/$/, '')}`;
}

/** @param {Record<string, string | undefined>} [env] */
export function readCredentials(env = process.env) {
  const email = env.PICSIO_EMAIL?.trim() ?? '';
  const password = env.PICSIO_PASSWORD ?? '';
  if (Boolean(email) !== Boolean(password)) {
    throw new Error('Set both PICSIO_EMAIL and PICSIO_PASSWORD, or leave both blank for manual sign-in.');
  }
  return { email, password };
}

/** @param {unknown} value @param {number} [now] */
export function validateSession(value, now = Date.now() / 1000) {
  const message = 'The local session is missing or invalid. Run npm run login.';
  if (!isRecord(value) || !Array.isArray(value.cookies) || !Array.isArray(value.origins) || !value.cookies.length) {
    throw new Error(message);
  }
  const validCookies = value.cookies.every(cookie => isRecord(cookie) &&
    typeof cookie.name === 'string' && typeof cookie.value === 'string' &&
    typeof cookie.domain === 'string' && isPicsioHost(cookie.domain.replace(/^\./, '')) &&
    typeof cookie.path === 'string' && cookie.path.startsWith('/') &&
    typeof cookie.secure === 'boolean' && typeof cookie.httpOnly === 'boolean' &&
    ['Strict', 'Lax', 'None'].includes(String(cookie.sameSite)) &&
    typeof cookie.expires === 'number' && Number.isFinite(cookie.expires));
  const validOrigins = value.origins.every(origin => {
    if (!isRecord(origin) || typeof origin.origin !== 'string' || !Array.isArray(origin.localStorage) ||
        !origin.localStorage.every(entry => isRecord(entry) && typeof entry.name === 'string' && typeof entry.value === 'string')) return false;
    try {
      const url = new URL(origin.origin);
      return url.protocol === 'https:' && isPicsioHost(url.hostname);
    } catch {
      return false;
    }
  });
  if (!validCookies || !validOrigins) throw new Error(message);
  if (!value.cookies.some(cookie => cookie.expires === -1 || cookie.expires > now)) {
    throw new Error('The local session has expired. Run npm run login.');
  }
}

/** @param {string} path */
function readJson(path) {
  try {
    return /** @type {unknown} */ (JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    throw new Error('Local setup is missing or unreadable. Run npm run login.');
  }
}

export function getVideoUrl() {
  if (process.env.PICSIO_VIDEO_URL?.trim()) return validateVideoUrl(process.env.PICSIO_VIDEO_URL);
  const fixture = readJson(FIXTURE_FILE);
  if (!isRecord(fixture)) throw new Error('The video fixture is invalid. Run npm run login.');
  return validateVideoUrl(fixture.videoUrl);
}

export function checkPreparedSession() {
  validateSession(readJson(STATE_FILE));
  return getVideoUrl();
}

/** @param {string} path @param {unknown} value */
export async function writePrivateJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
