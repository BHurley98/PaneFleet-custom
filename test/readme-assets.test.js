import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedCaptures = [
  ['panefleet-desktop.png', 1440, 900],
  ['panefleet-mobile.png', 390, 844]
];

function markdownHeadingAnchorList(source) {
  return [...String(source).matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1]
    .replace(/<[^>]*>/g, '')
    .replace(/[`*_~]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-'));
}

function markdownHeadingAnchors(source) {
  return new Set(markdownHeadingAnchorList(source));
}

async function maintainedMarkdownFiles() {
  const docs = (await readdir(path.join(root, 'docs'), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .filter((entry) => !entry.name.startsWith('incident-'))
    .filter((entry) => !entry.name.startsWith('personal-'))
    .filter((entry) => !entry.name.startsWith('private-'))
    .filter((entry) => !['host-wide-https.md', 'security-hardening.md'].includes(entry.name))
    .map((entry) => path.join('docs', entry.name));
  return [
    'README.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    path.join('.github', 'pull_request_template.md'),
    ...docs
  ];
}

test('README screenshots are bounded PNGs generated from the synthetic PaneFleet fixture', async () => {
  const [readme, demo] = await Promise.all([
    readFile(path.join(root, 'README.md'), 'utf8'),
    readFile(path.join(root, 'docs', 'readme-demo.html'), 'utf8')
  ]);

  assert.match(demo, /Synthetic demo data/i);
  assert.match(demo, /demo-host/);
  assert.doesNotMatch(demo, /\/home\/|\/Users\//);

  for (const [name, width, height] of expectedCaptures) {
    assert.match(readme, new RegExp(`docs/assets/${name.replace('.', '\\.')}\\b`));
    const capture = await readFile(path.join(root, 'docs', 'assets', name));
    assert.equal(capture.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(capture.readUInt32BE(16), width);
    assert.equal(capture.readUInt32BE(20), height);
    assert.ok(capture.length <= 512 * 1024, `${name} must stay at or below 512 KiB`);
  }
});

test('maintained Markdown headings produce unique nonempty anchors', async () => {
  for (const sourceFile of await maintainedMarkdownFiles()) {
    const source = await readFile(path.join(root, sourceFile), 'utf8');
    const anchors = markdownHeadingAnchorList(source);
    assert.equal(anchors.includes(''), false, `${sourceFile} contains an empty heading anchor`);
    assert.equal(new Set(anchors).size, anchors.length, `${sourceFile} contains duplicate heading anchors`);
  }
});

test('public Markdown links resolve to existing files and headings', async () => {
  const files = await maintainedMarkdownFiles();
  const anchorCache = new Map();

  for (const sourceFile of files) {
    const sourcePath = path.join(root, sourceFile);
    const source = await readFile(sourcePath, 'utf8');
    for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const reference = match[1];
      if (/^(?:https?:|mailto:)/i.test(reference)) continue;
      const [rawTarget, rawFragment = ''] = reference.split('#', 2);
      const targetPath = rawTarget
        ? path.resolve(path.dirname(sourcePath), decodeURIComponent(rawTarget))
        : sourcePath;
      assert.ok(
        targetPath === root || targetPath.startsWith(`${root}${path.sep}`),
        `${sourceFile} link escapes the repository: ${reference}`
      );
      const target = await stat(targetPath).catch(() => null);
      assert.equal(target?.isFile(), true, `${sourceFile} link target is missing: ${reference}`);
      if (!rawFragment || path.extname(targetPath).toLowerCase() !== '.md') continue;
      if (!anchorCache.has(targetPath)) {
        anchorCache.set(targetPath, markdownHeadingAnchors(await readFile(targetPath, 'utf8')));
      }
      assert.equal(
        anchorCache.get(targetPath).has(decodeURIComponent(rawFragment).toLowerCase()),
        true,
        `${sourceFile} heading is missing: ${reference}`
      );
    }
  }
});

test('documented npm scripts and repository helpers remain executable references', async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  for (const sourceFile of await maintainedMarkdownFiles()) {
    const source = await readFile(path.join(root, sourceFile), 'utf8');
    const npmCommands = [
      ...[...source.matchAll(/\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g)].map((match) => match[1]),
      ...[...source.matchAll(/\bnpm\s+(start|test)\b/g)].map((match) => match[1])
    ];
    for (const command of npmCommands) {
      assert.equal(
        typeof scripts[command],
        'string',
        `${sourceFile} references missing npm script ${command}`
      );
    }

    for (const match of source.matchAll(/\bscripts\/[A-Za-z0-9][A-Za-z0-9._/-]*/g)) {
      const reference = match[0];
      const target = await stat(path.join(root, reference)).catch(() => null);
      assert.equal(target?.isFile(), true, `${sourceFile} references missing helper ${reference}`);
    }
  }
});

test('public operations guide keeps the normal listener aligned with the secure installer default', async () => {
  const [operations, installer] = await Promise.all([
    readFile(path.join(root, 'docs', 'operations.md'), 'utf8'),
    readFile(path.join(root, 'scripts', 'install-control-plane.sh'), 'utf8')
  ]);

  assert.match(installer, /^BIND_HOST="\$\{ORCH_BIND_HOST:-127\.0\.0\.1\}"$/m);
  assert.match(operations, /127\.0\.0\.1:8787/);
  assert.match(operations, /Set `HOST` to a non-loopback address only after an encrypted transport and narrow ingress are ready/i);
  assert.doesNotMatch(operations, /default[^\n]*0\.0\.0\.0:8787/i);
});

test('documented environment variables remain backed by runtime code', async () => {
  const configuration = await readFile(path.join(root, 'docs', 'configuration.md'), 'utf8');
  const documented = [...configuration.matchAll(/^\| `([A-Z][A-Z0-9_]+)` \|/gm)]
    .map((match) => match[1]);
  const scripts = (await readdir(path.join(root, 'scripts'), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.(?:mjs|sh)$/.test(entry.name))
    .map((entry) => path.join('scripts', entry.name));
  const runtimeFiles = ['server.js', ...scripts];
  const runtimeSource = (await Promise.all(runtimeFiles.map((file) => (
    readFile(path.join(root, file), 'utf8')
  )))).join('\n');

  assert.ok(documented.length > 0, 'configuration must retain its environment-variable tables');
  assert.equal(new Set(documented).size, documented.length, 'an environment variable is documented twice');
  assert.deepEqual(
    documented.filter((name) => !new RegExp(`\\b${name}\\b`).test(runtimeSource)),
    [],
    'configuration documents environment variables that runtime code no longer uses'
  );
});
