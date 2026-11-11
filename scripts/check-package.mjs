/** Check the installable payload without launching another Harness or altering a Profile. */
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
assert.equal(pkg.name, '@local/dsh-financial-services');
assert.equal(pkg.type, 'module');
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
assert.equal(pkg.dsh.client.platform, 'web');
assert.ok(pkg.engines.dsh, 'DSH compatibility must be explicit');
assert.equal(pkg.scripts.preinstall, undefined);
assert.equal(pkg.scripts.install, undefined);
assert.equal(pkg.scripts.postinstall, undefined);

const targets = Object.values(pkg.exports).filter(path => typeof path === 'string' && !path.includes('*'));
for (const target of [...targets, './cordis.patch.yml', './README.md', './NOTICE', './LICENSE', './lib/build-manifest.json']) {
  assert.ok(target.startsWith('./') && !isAbsolute(target));
  const resolved = resolve(root, target);
  assert.ok(resolved.startsWith(root + '\\') || resolved.startsWith(root + '/'), `Export escapes package: ${target}`);
  assert.ok((await stat(resolved)).isFile(), `Missing payload: ${target}`);
}
assert.ok(pkg.files.every(path => !path.includes('audit/') && !path.includes('.env') && !path.includes('node_modules')))
for (const obsolete of ['assets/source-archive/**', 'assets/source-snapshot.zip', 'assets/agent-manifest.json', 'assets/skills/**', 'assets/role-skills/**', 'assets/commands/**']) {
  assert.ok(!pkg.files.includes(obsolete), `Historical or out-of-scope assets must not ship: ${obsolete}`)
}
for (const selected of ['assets/runtime-manifest.json', 'assets/runtime-scope.json', 'assets/runtime-skills/**/*', 'assets/runtime-role-skills/**/*', 'assets/runtime-commands/**/*', 'assets/prompts/**/*.md']) {
  assert.ok(pkg.files.includes(selected), `Required selected asset is missing from package.files: ${selected}`)
}
assert.ok(pkg.files.includes('lib/host.js') && pkg.files.includes('lib/client.js'));
assert.equal(pkg.exports['.'], './lib/host.js');
assert.equal(pkg.exports['./data'], './lib/data.js');
assert.equal(pkg.exports['./data-runtime'], undefined);
assert.equal(pkg.exports['./data-contracts'], './src/data/contracts.js');
assert.equal(pkg.exports['./data-runtime-2'], undefined);
assert.equal(pkg.exports['./data-contracts/v2'], undefined);
const host = await readFile(join(root, 'lib/host.js'), 'utf8');
assert.ok(!/from\s+['"]\.\.?\//.test(host), 'Host implementation must be bundled into its actual exported entry');
assert.doesNotMatch(host, /financial_data_v2|data-api-v2|contractVersion|queryForAgentV2|registerAdapterV2/, 'Host artifact must expose only canonical data APIs');
assert.ok(pkg.files.includes('lib/build-manifest.json'));

for (const locale of ['en', 'zh']) {
  const dict = JSON.parse(await readFile(join(root, `locale/${locale}.json`), 'utf8'));
  assert.ok(dict.meta.title.trim() && dict.meta.description.trim());
  assert.ok(!dict.meta.title.includes('Decoration'));
}
const svg = await readFile(join(root, 'icon.svg'), 'utf8');
assert.ok(svg.includes('<svg') && svg.includes('viewBox='));
assert.ok(Buffer.byteLength(svg) <= 256 * 1024);
assert.ok(!/<script|<foreignObject|\bon\w+\s*=|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svg), 'Icon must be self-contained SVG');
const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8');
assert.match(patch, /id: financial-services/);
assert.doesNotMatch(patch, /finance_data_query_v2|data-runtime-2|data-api-v2/, 'Preset patch must use only canonical data names');
assert.equal((patch.match(/name: '@local\/dsh-financial-services'/g) ?? []).length, 1);
assert.deepEqual(patch.split('\n').filter(line => line.startsWith('- ')), ['- insert:'], 'Bundle may only append its own declarations');
const assets = JSON.parse(await readFile(join(root, 'assets/runtime-manifest.json'), 'utf8'));
assert.deepEqual(assets.scope.mainAgentIds.slice().sort(), ['finance-earnings-reviewer', 'finance-market-researcher', 'finance-model-builder']);
assert.equal(assets.roles.length, 12);
assert.deepEqual([assets.counts.mainAgents, assets.counts.workers, assets.counts.skills], [3, 9, 22]);
assert.equal((patch.match(/^    - id: preset-finance-/gm) ?? []).length, 12);
for (const role of assets.roles) assert.ok(patch.includes(`    - id: preset-${role.id}\n`));
for (const forbidden of ['finance-pitch-agent', 'finance-meeting-prep-agent', 'finance-gl-reconciler', 'finance-kyc-screener', 'finance-valuation-reviewer', 'finance-month-end-closer', 'finance-statement-auditor']) {
  assert.ok(!patch.includes(`    - id: preset-${forbidden}\n`), `Out-of-scope Preset leaked into patch: ${forbidden}`);
}
for (const entry of ['role', 'floor', ...(pkg.exports['./data'] ? ['data'] : [])]) {
  assert.equal(pkg.exports[`./${entry}`], `./lib/${entry}.js`);
  const code = await readFile(join(root, `lib/${entry}.js`), 'utf8');
  assert.ok(!/from\s+['"]\.\.?\//.test(code), `${entry} must contain its own implementation`);
  for (const locale of ['en', 'zh']) {
    const meta = JSON.parse(await readFile(join(root, `locale/${entry}/${locale}.json`), 'utf8')).meta;
    assert.ok(meta.title.trim() && meta.description.trim());
  }
}

for (const [entry, localeEntry] of [['role-numeric-1', 'role'], ['role-data-1', 'role']]) {
  if (!pkg.exports[`./${entry}`]) continue;
  assert.equal(pkg.exports[`./${entry}`], `./lib/${entry}.js`);
  assert.ok(pkg.files.includes(`lib/${entry}.js`));
  assert.equal(pkg.exports[`./${entry}/locale/*.json`], `./locale/${localeEntry}/*.json`);
  assert.equal(pkg.exports[`./${entry}/icon`], './icon.svg');
  assert.ok(!/from\s+['"]\.\.?\//.test(await readFile(join(root, `lib/${entry}.js`), 'utf8')), `${entry} must be self-contained`);
}
if (pkg.exports['./review']) {
  assert.equal(pkg.exports['./review'], './lib/review.js');
  assert.ok(pkg.files.includes('lib/review.js'));
  const review = await readFile(join(root, 'lib/review.js'), 'utf8');
  assert.ok(!/from\s+['"]\.\.?\//.test(review), 'review must be self-contained');
  assert.match(review, /financeReview/);
  assert.ok(!/publish\(|post\(|trade\(|transfer\(/.test(review), 'the review service must not expose side-effecting operations');
}
const client = await readFile(join(root, 'lib/client.js'), 'utf8');
new Script(client, { filename: 'lib/client.js' });
assert.match(client, /window\.__ModuleLoader__\.load/);
assert.match(client, /@local\/dsh-financial-services/);
assert.doesNotMatch(client, /data-api-v2|finance_data_query_v2|dataV2Address|remoteV2|contractVersion/, 'Client artifact must use the sole canonical data API');
assert.ok(!/require\(['"]@deepseek-ai\/dsh-client-/.test(client));
// Layout must render through React; the single allowed exception is the workbook download anchor.
assert.ok(!/localStorage|iframe|useSyncExternalStore|document\.body\.innerHTML|document\.querySelector/.test(client));
assert.equal((client.match(/document\.body\.appendChild/g) ?? []).length, 1, 'only the download helper may touch document.body');
assert.equal((client.match(/\.click\(\)/g) ?? []).length, 1, 'only the download helper may synthesise a click');
assert.match(client, /revokeObjectURL/, 'the download helper must release its object URL');

// The shipped artifact set must be exactly what the manifest declares; stale files must not ship.
{
  const libManifest = JSON.parse(await readFile(join(root, 'lib/build-manifest.json'), 'utf8'));
  const expected = new Set(['client.js', 'build-manifest.json', 'preset-patch-manifest.json', ...Object.keys(libManifest.entrySha256)]);
  const present = (await readdir(join(root, 'lib'))).filter(name => name.endsWith('.js') || name.endsWith('.json'));
  const unexpected = present.filter(name => !expected.has(name));
  const missing = [...expected].filter(name => !present.includes(name));
  assert.deepEqual(unexpected, [], `unexpected artifacts ship from lib: ${unexpected.join(', ')}`);
  assert.deepEqual(missing, [], `declared artifacts are missing: ${missing.join(', ')}`);
}
const build = JSON.parse(await readFile(join(root, 'lib/build-manifest.json'), 'utf8'));
assert.equal(build.version, pkg.version);
assert.equal(build.hostSha256, createHash('sha256').update(host).digest('hex'));
assert.equal(build.clientSha256, createHash('sha256').update(client).digest('hex'));
assert.equal(build.runtimeManifestSha256, createHash('sha256').update(await readFile(join(root, 'assets/runtime-manifest.json'))).digest('hex'));
assert.equal(build.runtimeScopeSha256, createHash('sha256').update(await readFile(join(root, 'assets/runtime-scope.json'))).digest('hex'));
assert.ok(!('sourceSnapshotSha256' in build), 'The removed full-source snapshot must not remain in build metadata')
const selectedSkillNames = new Set(Object.values(assets.scope.skillsByDomain).flat())
assert.deepEqual(new Set(assets.skills.map(skill => skill.name)), selectedSkillNames)
for (const skill of assets.skills) {
  assert.ok(skill.origins.length > 0)
  assert.ok(skill.origins.every(origin => assets.scope.skillSourceRoots.some(root => origin.path.startsWith(`${root}/${skill.name}/`))), `Out-of-scope origin leaked for ${skill.name}`)
}
assert.ok(assets.commands.every(command => assets.scope.commandSourceRoots.some(root => command.source.path.startsWith(`${root}/`))))
assert.equal(build.patchSha256, createHash('sha256').update(patch).digest('hex'));
for (const [file, expected] of Object.entries(build.entrySha256)) assert.equal(createHash('sha256').update(await readFile(join(root, 'lib', file))).digest('hex'), expected);
for (const [path, expected] of Object.entries(build.sourceSha256)) {
  // Same normalisation as the build: line endings are not part of a source identity.
  const text = (await readFile(join(root, path), 'utf8')).replaceAll('\r\n', '\n');
  assert.equal(createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex'), expected, `Stale build: ${path}`);
}
console.log('PASS: manifest, exports, localized metadata, original SVG safety, patch, native Client syntax and source/build hashes.');
console.log('Not tested here: live Loader lifecycle, actual browser rendering, Workspace persistence or financial data.');
