import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRelease, selectAvailableRelease } from './update-release.mjs';

function release(tag, names = ['Morrow-arm64.zip'], overrides = {}) {
  return {
    tag_name: tag, draft: false, prerelease: false, published_at: '2026-11-10T00:00:00Z',
    assets: names.map(name => ({ name, size: 100, state: 'uploaded', browser_download_url: `https://github.com/tumblecat44/morrow-releases/releases/download/${tag}/${name}` })),
    ...overrides,
  };
}

test('the website has no download before a stable release exists', () => {
  assert.deepEqual(selectRelease([]), { version: null, downloads: [] });
  assert.deepEqual(selectRelease([release('v1.0.0', undefined, { draft: true }), release('v2.0.0', undefined, { prerelease: true })]), { version: null, downloads: [] });
});

test('the highest version wins regardless of API ordering or an old release edit', () => {
  const manifest = selectRelease([release('v1.2.0'), release('v1.10.0'), release('v1.3.0')]);
  assert.equal(manifest.version, '1.10.0');
  assert.match(manifest.downloads[0].url, /v1\.10\.0/);
});

test('the website gets each supported architecture and prefers its DMG', () => {
  const manifest = selectRelease([release('v1.0.0', ['Morrow-arm64.zip', 'Morrow-x64.dmg', 'Morrow-arm64.dmg'])]);
  assert.deepEqual(manifest.downloads.map(file => file.arch), ['arm64', 'x64']);
  assert.match(manifest.downloads[0].url, /arm64\.dmg$/);
});

test('a broken newest release fails instead of replacing the saved manifest', () => {
  assert.throws(() => selectRelease([release('v2.0.0', []), release('v1.0.0')]), /Attach a macOS/);
  assert.throws(() => selectRelease([release('v2.0.0', ['Morrow.zip'])]), /exactly one architecture/);
  assert.throws(() => selectRelease([release('v2.0.0', ['Morrow-arm64.zip', 'Other-arm64.zip'])]), /multiple/);
  const incomplete = release('v2.0.0');
  incomplete.assets[0].state = 'starter';
  assert.throws(() => selectRelease([incomplete]), /incomplete/);
});

test('removing a release restores the remaining stable version', () => {
  assert.equal(selectRelease([release('v1.0.0')]).version, '1.0.0');
});

test('an incomplete new release preserves the previous valid download', async () => {
  const warnings = [];
  const result = await selectAvailableRelease([release('v2.0.0', []), release('v1.0.0')], async () => true, message => warnings.push(message));
  assert.equal(result.version, '1.0.0');
  assert.equal(warnings.length, 1);
});

test('deleting the only valid release clears a stale download even if broken releases remain', async () => {
  const result = await selectAvailableRelease([release('v1.0.0', [])], async () => true, () => {});
  assert.deepEqual(result, { version: null, downloads: [] });
});

test('a missing public asset rolls back to the next available release', async () => {
  const result = await selectAvailableRelease([release('v2.0.0'), release('v1.0.0')], async url => !url.includes('/v2.0.0/'), () => {});
  assert.equal(result.version, '1.0.0');
});

test('a temporary network failure aborts publication so the existing manifest stays intact', async () => {
  await assert.rejects(selectAvailableRelease([release('v1.0.0')], async () => { throw new Error('Network unavailable'); }, () => {}), /Network unavailable/);
});
