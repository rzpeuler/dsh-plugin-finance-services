/** Materialize disposable TEST_ONLY native Host probes; never installs or creates Sessions. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const flags = process.argv.slice(2);
for (const flag of flags) if (flag !== '--run-model-smoke' && !/^--revision=[a-z0-9][a-z0-9-]{0,39}$/.test(flag)
  && !/^--model-timeout-ms=[1-9][0-9]{0,5}$/.test(flag)) throw new Error(`Unknown flag: ${flag}`);
const revisions = flags.filter(flag => flag.startsWith('--revision='));
if (revisions.length > 1) throw new Error('Supply --revision once');
const revision = revisions[0]?.slice('--revision='.length);
const suffix = revision ? `-${revision}` : '';
const runModelSmoke = flags.includes('--run-model-smoke');
const timeouts = flags.filter(flag => flag.startsWith('--model-timeout-ms='));
if (timeouts.length > 1) throw new Error('Supply --model-timeout-ms once');
const modelTimeoutMs = timeouts.length ? Number(timeouts[0].slice('--model-timeout-ms='.length)) : 120000;
if (!Number.isSafeInteger(modelTimeoutMs) || modelTimeoutMs < 1 || modelTimeoutMs > 300000) {
  throw new Error('modelTimeoutMs must be a positive safe integer no greater than 300000');
}
const probe = await readFile(join(root, 'tests/p2-live-probe.js'), 'utf8');
const reporter = await readFile(join(root, 'tests/p2-live/report-io.js'), 'utf8');
const fixtureBase = join(root, 'tests', 'p2-live');
await mkdir(fixtureBase, { recursive: true });
for (const phase of ['active', 'disabled']) {
  const directory = join(fixtureBase, phase + suffix);
  await mkdir(directory, { recursive: true });
  const ownerFile = join(directory, 'TEST_ONLY-fixture.json');
  const owner = { owner: 'financial-services-p2-native-probe', phase, ...(revision ? { revision } : {}) };
  try {
    const existing = JSON.parse(await readFile(ownerFile, 'utf8'));
    if (existing.owner !== owner.owner || existing.phase !== phase || existing.revision !== revision) throw new Error(`Not an owned fixture: ${directory}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // New directory only: do not adopt an unrelated package accidentally.
    try { await readFile(join(directory, 'package.json'), 'utf8'); throw new Error(`Unowned existing package: ${directory}`); }
    catch (packageError) { if (packageError.code !== 'ENOENT') throw packageError; }
  }
  async function materialize(name, text) {
    const path = join(directory, name);
    try { await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await writeFile(path, text, 'utf8');
  }
  const name = `@local/dsh-financial-services-p2-${phase}${suffix}-test-only`;
  await materialize('TEST_ONLY-fixture.json', JSON.stringify(owner, null, 2) + '\n');
  await materialize('package.json', JSON.stringify({
    name, version: '0.0.1', private: true, type: 'module',
    description: 'Disposable TEST_ONLY native Host acceptance probe; not a Financial Services installation unit.',
    exports: { '.': './probe.js' }, files: ['probe.js', 'p2-live/report-io.js', 'cordis.patch.yml', 'TEST_ONLY-fixture.json'],
    engines: { dsh: '0.2.1-rc.5' }, dsh: { bundle: { patch: './cordis.patch.yml' } },
  }, null, 2) + '\n');
  await mkdir(join(directory, 'p2-live'), { recursive: true });
  await materialize('p2-live/report-io.js', reporter);
  await materialize('probe.js', probe);
  await materialize('cordis.patch.yml',
    `# Disposable TEST_ONLY fixture. Install only this phase, never both concurrently.\n- insert:\n    - id: finance-p2-${phase}${suffix}-test-only-probe\n      name: '${name}'\n      config:\n        phase: '${phase}'\n        runModelSmoke: ${phase === 'active' && runModelSmoke}\n        modelTimeoutMs: ${modelTimeoutMs}\n        bundleRoot: ${JSON.stringify(root)}\n`);
  console.log(`Prepared ${phase}: ${directory}; runModelSmoke=${phase === 'active' && runModelSmoke}`);
}
console.log('No installation, Profile edit, Workspace registration, or Session creation was performed. Parent owns native installation and lifecycle switching.');
