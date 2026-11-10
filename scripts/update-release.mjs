import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const repository = 'tumblecat44/morrow-releases';
const emptyRelease = { version: null, downloads: [] };

export function selectRelease(releases) {
  const stable = releases.filter(release => !release.draft && !release.prerelease && /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(release.tag_name));
  stable.sort((a, b) => {
    const left = a.tag_name.replace(/^v/, '').split('.').map(BigInt);
    const right = b.tag_name.replace(/^v/, '').split('.').map(BigInt);
    for (let index = 0; index < 3; index++) {
      if (left[index] !== right[index]) return left[index] > right[index] ? -1 : 1;
    }
    return Date.parse(b.published_at) - Date.parse(a.published_at);
  });
  if (stable.length === 0) return emptyRelease;

  const release = stable[0];
  const downloads = new Map();
  for (const asset of release.assets) {
    if (!/\.(dmg|zip)$/i.test(asset.name)) continue;
    const architectures = [
      ['arm64', /(?:^|[._-])(arm64|aarch64|apple-silicon)(?:[._-]|$)/i],
      ['x64', /(?:^|[._-])(x64|x86_64|intel)(?:[._-]|$)/i],
      ['universal', /(?:^|[._-])universal(?:[._-]|$)/i],
    ].filter(([, pattern]) => pattern.test(asset.name));
    if (architectures.length !== 1) throw new Error(`Name ${asset.name} with exactly one architecture: arm64, x64, or universal.`);
    if (asset.state !== 'uploaded' || asset.size <= 0) throw new Error(`The upload of ${asset.name} is incomplete.`);
    const expected = `https://github.com/${repository}/releases/download/${encodeURIComponent(release.tag_name)}/`;
    if (!asset.browser_download_url.startsWith(expected)) throw new Error(`The download URL of ${asset.name} does not belong to this release.`);
    const arch = architectures[0][0];
    const previous = downloads.get(arch);
    const priority = /\.dmg$/i.test(asset.name) ? 2 : 1;
    if (previous?.priority === priority) throw new Error(`The release contains multiple ${arch} installers of the same type.`);
    if (!previous || priority > previous.priority) downloads.set(arch, { arch, url: asset.browser_download_url, priority });
  }
  if (downloads.size === 0) throw new Error(`Attach a macOS .dmg or .zip file to ${release.tag_name} before publishing. The website keeps its previous download.`);
  return {
    version: release.tag_name.replace(/^v/, ''),
    downloads: ['universal', 'arm64', 'x64'].filter(arch => downloads.has(arch)).map(arch => {
      const { url } = downloads.get(arch);
      return { arch, url };
    }),
  };
}

async function updateRelease() {
  if (!process.env.GH_TOKEN) throw new Error('GitHub did not provide the workflow token.');
  const releases = [];
  for (let page = 1; ; page++) {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`GitHub could not list releases (${response.status}). The website keeps its previous download.`);
    const pageReleases = await response.json();
    releases.push(...pageReleases);
    if (pageReleases.length < 100) break;
  }
  const manifest = selectRelease(releases);
  for (const download of manifest.downloads) {
    const response = await fetch(download.url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`The public ${download.arch} installer is unavailable (${response.status}). The website keeps its previous download.`);
  }
  await writeFile(new URL('../release.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
  console.log(manifest.version ? `The website manifest is ready for v${manifest.version}.` : 'The website manifest contains no public release.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await updateRelease();
