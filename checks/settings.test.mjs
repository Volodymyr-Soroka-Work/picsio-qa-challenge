import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCredentials, validateSession, validateVideoUrl, writePrivateJson } from '../support/settings.mjs';

const videoUrl = 'https://pics.io/preview/0123456789abcdef01234567';
const now = 1_800_000_000;
const state = () => ({
  cookies: [{ name: 'test-only', value: 'not-a-real-session', domain: '.pics.io', path: '/',
    secure: true, httpOnly: true, sameSite: 'Lax', expires: now + 60 }],
  origins: [],
});

test('preview URLs are canonical and remain on Pics.io', () => {
  assert.equal(validateVideoUrl(` ${videoUrl}/ `), videoUrl);
  for (const invalid of [videoUrl.replace('https:', 'http:'), videoUrl.replace('pics.io', 'example.com'),
    `${videoUrl}?token=example`, `${videoUrl}#fragment`, 'https://pics.io/preview/not-an-id',
    'https://user:password@pics.io/preview/0123456789abcdef01234567', undefined]) {
    assert.throws(() => validateVideoUrl(invalid), /Pics.io \/preview/);
  }
});

test('credentials must be supplied together without exposing their values', () => {
  const password = 'test-only-password-marker';
  for (const env of [{ PICSIO_EMAIL: 'qa@example.invalid' }, { PICSIO_PASSWORD: password }]) {
    assert.throws(() => readCredentials(env), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Set both/);
      assert.ok(!error.message.includes(password));
      return true;
    });
  }
  assert.deepEqual(readCredentials({}), { email: '', password: '' });
  assert.deepEqual(readCredentials({ PICSIO_EMAIL: ' qa@example.invalid ', PICSIO_PASSWORD: ' keep spaces ' }),
    { email: 'qa@example.invalid', password: ' keep spaces ' });
});

test('valid session and browser-session cookies are accepted', () => {
  validateSession(state(), now);
  const session = state();
  session.cookies[0].expires = -1;
  validateSession(session, now);
});

test('expired and malformed sessions fail before a browser starts', () => {
  const expired = state();
  expired.cookies[0].expires = now - 1;
  assert.throws(() => validateSession(expired, now), /expired/);
  for (const invalid of [null, {}, { cookies: [], origins: [] }, { cookies: [{}], origins: [] }]) {
    assert.throws(() => validateSession(invalid, now), /Run npm run login/);
  }
});

test('foreign cookies and insecure storage origins are rejected', () => {
  const foreign = state();
  foreign.cookies[0].domain = 'example.com';
  assert.throws(() => validateSession(foreign, now), /invalid/);
  for (const origin of ['https://example.com', 'http://pics.io', 'not-a-url']) {
    assert.throws(() => validateSession({ ...state(), origins: [{ origin, localStorage: [] }] }, now), /invalid/);
  }
});

test('private JSON writes replace files atomically without leaving temporary copies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'picsio-settings-'));
  try {
    const target = join(directory, 'fixture.json');
    await writePrivateJson(target, { version: 1 });
    await writePrivateJson(target, { version: 2 });
    assert.deepEqual(JSON.parse(await readFile(target, 'utf8')), { version: 2 });
    assert.deepEqual(await readdir(directory), ['fixture.json']);
    if (process.platform !== 'win32') assert.equal((await stat(target)).mode & 0o777, 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
