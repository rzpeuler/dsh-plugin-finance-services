/** Build the plain-JavaScript Host modules and the native lazy Client factory. */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { Script } from 'node:vm';
import { spawnSync } from 'node:child_process';
import { rollup } from 'rollup';

const flags = process.argv.slice(2);
if (flags.some(flag => flag !== '--client-only') || flags.length > 1) throw new Error('Supported option: --client-only (once)');
const clientOnly = flags.includes('--client-only');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'src');
const output = join(root, 'lib');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const { createFinanceContract } = await import(pathToFileURL(join(src, 'contract.js')).href);
const { createFinanceClient } = await import(pathToFileURL(join(src, 'client-factory.js')).href);
const { createDataRemoteContract } = await import(pathToFileURL(join(src, 'data/remote.js')).href);
const { createDataSchemas } = await import(pathToFileURL(join(src, 'data/contracts.js')).href);
const { createDataSourcesClient } = await import(pathToFileURL(join(src, 'data/client-panel.js')).href);
const { createReviewRemoteContract } = await import(pathToFileURL(join(src, 'review/remote.js')).href);
const { createReviewClient } = await import(pathToFileURL(join(src, 'review/client-panel.js')).href);
const { createWorkbenchClient } = await import(pathToFileURL(join(src, 'workbench/client-panel.js')).href);
const { createFinanceRunsRemoteContract } = await import(pathToFileURL(join(src, 'run/remote.js')).href);
const { createFinanceRunsClient } = await import(pathToFileURL(join(src, 'run/client.js')).href);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return groups.flat().sort();
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
// Artifacts are published with LF endings only, so a rebuild cannot differ by line endings alone.
const normalize = text => text.replaceAll('\r\n', '\n');
let previous;
if (clientOnly) {
  previous = JSON.parse(await readFile(join(output, 'build-manifest.json'), 'utf8'));
  if (previous.package !== manifest.name || previous.version !== manifest.version) throw new Error('Client-only build requires the same existing package/version');
  const current = (await filesIn(src)).filter(path => path.endsWith('.js'));
  for (const path of current) {
    const key = relative(root, path).replaceAll('\\', '/');
    if (!['src/client-factory.js', 'src/data/client-panel.js'].includes(key) && sha256(await readFile(path)) !== previous.sourceSha256[key]) throw new Error(`Shared/Host source changed: full build required (${key})`);
  }
  for (const [entry, hash] of Object.entries(previous.entrySha256)) {
    if (sha256(await readFile(join(output, entry))) !== hash) throw new Error(`Existing ${entry} artifact mismatch`);
  }
  for (const [path, key] of [['assets/runtime-manifest.json', 'runtimeManifestSha256'], ['assets/runtime-scope.json', 'runtimeScopeSha256'], ['cordis.patch.yml', 'patchSha256']]) {
    if (sha256(await readFile(join(root, path))) !== previous[key]) throw new Error(`Non-Client artifact changed: ${path}`);
  }
} else {
  await import('./build-runtime-scope.mjs')
  await import('./generate-preset-patch.mjs');
}
await mkdir(output, { recursive: true });
const sourceFiles = (await filesIn(src)).filter(path => path.endsWith('.js'));
for (const path of sourceFiles) {
  const checked = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  if (checked.status !== 0) throw new Error(`Source syntax check failed: ${relative(root, path)}`);
}
const roleEntry = manifest.exports['./role-data-1'] ? 'role-data-1' : manifest.exports['./role-numeric-1'] ? 'role-numeric-1' : 'role';
// Each actual plugin export contains all its own implementation; shared native libraries remain external.
for (const entry of clientOnly ? [] : ['host', 'role', 'floor', ...(manifest.exports['./data'] ? ['data'] : []), ...(manifest.exports['./review'] ? ['review'] : []), ...(manifest.exports['./run'] ? ['run'] : [])]) {
  const bundle = await rollup({
    input: join(src, `${entry}.js`),
    external: specifier => !specifier.startsWith('.') && !isAbsolute(specifier),
  });
  try {
    const file = join(output, `${entry === 'role' ? roleEntry : entry}.js`);
    const generated = await bundle.generate({ format: 'es', sourcemap: false });
    const code = normalize(generated.output[0].code);
    let old;
    try { old = await readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Preserve unchanged native Host/floor artifacts and the original retained role generation.
    if (old !== code) await writeFile(file, code, 'utf8');
    // Every exported alias carries the current code. Keeping an old generation under a live export name
    // would let an install load outdated implementation while the manifest claims the new one.
    const compatibilityEntries = entry === 'role' ? ['role', ...(manifest.exports['./role-numeric-1'] ? ['role-numeric-1'] : [])] : [];
    for (const compatibilityEntry of compatibilityEntries) {
      const alias = join(output, `${compatibilityEntry}.js`);
      let previous;
      try { previous = await readFile(alias, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (previous !== code) await writeFile(alias, code, 'utf8');
    }
  } finally {
    await bundle.close();
  }
}

const client = `/* Financial Services native Client artifact. Generated by scripts/build.mjs. */\nwindow.__ModuleLoader__.load({\n  id: ${JSON.stringify(manifest.name)},\n  factory(require) {\n    const createFinanceContract = (${createFinanceContract.toString()});\n    const createFinanceClient = (${createFinanceClient.toString()});\n\n    const createDataRemoteContract = (${createDataRemoteContract.toString()});\n\n    const createDataSchemas = (${createDataSchemas.toString()});\n    const createDataSourcesClient = (${createDataSourcesClient.toString()});\n    const dataClient = createDataSourcesClient(require('react'), require('zod').z, createDataRemoteContract, createDataSchemas);\n    const createReviewRemoteContract = (${createReviewRemoteContract.toString()});\n    const createReviewClient = (${createReviewClient.toString()});\n    const reviewClient = createReviewClient(require('react'), require('zod').z, createReviewRemoteContract);\n    const createWorkbenchClient = (${createWorkbenchClient.toString()});\n    const workbenchClient = createWorkbenchClient(require('react'), require('zod').z, createFinanceContract);\n    const createFinanceRunsRemoteContract = (${createFinanceRunsRemoteContract.toString()});
    const createFinanceRunsClient = (${createFinanceRunsClient.toString()});
    const runClient = createFinanceRunsClient(require('react'), require('zod').z, createFinanceRunsRemoteContract);
    return createFinanceClient(require('react'), require('zod').z, createFinanceContract, dataClient, reviewClient, workbenchClient, runClient);\n  }\n});\n`;
const normalizedClient = normalize(client);
new Script(normalizedClient, { filename: 'financial-services/lib/client.js' });
let oldClient;
try { oldClient = await readFile(join(output, 'client.js'), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (oldClient !== normalizedClient) await writeFile(join(output, 'client.js'), normalizedClient, 'utf8');
const sources = {};
for (const path of sourceFiles) {
  // Hash normalised content: a CRLF working copy and an LF checkout are the same source.
  const key = relative(root, path).replaceAll('\\', '/');
  sources[key] = sha256(Buffer.from(normalize(await readFile(path, 'utf8')), 'utf8'));
}
const entrySha256 = {};
for (const entry of ['host', 'role', 'floor', ...(manifest.exports['./role-numeric-1'] ? ['role-numeric-1'] : []), ...(manifest.exports['./data'] ? ['data'] : []), ...(manifest.exports['./role-data-1'] ? ['role-data-1'] : []), ...(manifest.exports['./review'] ? ['review'] : []), ...(manifest.exports['./run'] ? ['run'] : [])]) entrySha256[`${entry}.js`] = sha256(await readFile(join(output, `${entry}.js`)));
const build = { package: manifest.name, version: manifest.version, format: 'dsh-native-lazy-factory',
  clientSha256: sha256(normalizedClient), hostSha256: entrySha256['host.js'], entrySha256, sourceSha256: sources,
  runtimeManifestSha256: sha256(await readFile(join(root, 'assets/runtime-manifest.json'))),
  runtimeScopeSha256: sha256(await readFile(join(root, 'assets/runtime-scope.json'))),
  patchSha256: sha256(await readFile(join(root, 'cordis.patch.yml'))) };
try { await readFile(join(output, 'build-manifest.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(join(output, 'build-manifest.json'), JSON.stringify(build, null, 2) + '\n', 'utf8');
// A full build owns the output directory: an artifact no longer produced must not ship stale.
if (!clientOnly) {
  const expected = new Set([...Object.keys(entrySha256), 'client.js', 'build-manifest.json', 'preset-patch-manifest.json']);
  const pruned = [];
  for (const name of await readdir(output)) {
    if (!expected.has(name)) { await rm(join(output, name), { recursive: true, force: true }); pruned.push(name); }
  }
  if (pruned.length) console.log(`Removed ${pruned.length} stale artifact(s) that this build no longer produces: ${pruned.sort().join(', ')}`);
}
console.log(clientOnly ? `Built Client only for ${manifest.name}@${manifest.version}; Host/role/floor/patch/runtime-scope bytes were verified and not rewritten.` : `Built self-contained Host, role, floor${manifest.exports['./data'] ? ' and data' : ''} exports plus one native Client factory from ${sourceFiles.length} sources for ${manifest.name}@${manifest.version}.`);
