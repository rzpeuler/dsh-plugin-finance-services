/** Build a one-run TEST_ONLY recovery bundle; no native invocation or installation. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const root = dirname(dirname(sourceDirectory));
const target = join(sourceDirectory, 'recovery-004');
const sourceRunId = '6e45108d-0dbe-49a4-92a7-7a17683b9363';
const sourceWorkspaceId = '7ff62cd0-bc67-488d-a9e3-dba58eef8215';
const sourceHashes = {};
for (const [key, filename] of Object.entries({ partial: 'P2-live-host-partial-004.json', journal: 'P2-live-host-journal-004.jsonl', infrastructure: 'P2-live-host-infrastructure-failure-004.json' })) {
  sourceHashes[key] = createHash('sha256').update(await readFile(join(root, 'acceptance', filename))).digest('hex');
}
const owner = { owner: 'financial-services-p2-recovery', sourceRunId, sourceWorkspaceId };
try {
  const previous = JSON.parse(await readFile(join(target, 'TEST_ONLY-fixture.json'), 'utf8'));
  if (JSON.stringify(previous) !== JSON.stringify(owner)) throw new Error('Recovery target is not owned by this fixture');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  try { await readFile(join(target, 'package.json'), 'utf8'); throw new Error('Unowned existing recovery package'); }
  catch (existingError) { if (existingError.code !== 'ENOENT') throw existingError; }
}
await mkdir(target, { recursive: true });
async function materialize(filename, content) {
  const path = join(target, filename);
  try { await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(path, content, 'utf8');
}
const probe = (await readFile(join(sourceDirectory, 'probe.js'), 'utf8')).replace("from '../p2-live/report-io.js'", "from './report-io.js'");
await materialize('probe.js', probe);
await materialize('report-io.js', await readFile(join(root, 'tests/p2-live/report-io.js'), 'utf8'));
await materialize('TEST_ONLY-fixture.json', JSON.stringify(owner) + '\n');
const name = '@local/dsh-financial-services-p2-recovery-004-test-only';
await materialize('package.json', JSON.stringify({ name, version: '0.0.1', private: true, type: 'module',
  description: 'Disposable TEST_ONLY recovery of one failed acceptance fixture; never runs models or resumes Sessions.',
  exports: { '.': './probe.js' }, files: ['probe.js', 'report-io.js', 'cordis.patch.yml', 'TEST_ONLY-fixture.json'],
  engines: { dsh: '0.2.1-rc.5' }, dsh: { bundle: { patch: './cordis.patch.yml' } } }, null, 2) + '\n');
await materialize('cordis.patch.yml', `# TEST_ONLY one-run recovery; parent installs only after Client fixture releases its binding.\n- insert:\n    - id: finance-p2-recovery-004-test-only\n      name: '${name}'\n      config:\n        bundleRoot: ${JSON.stringify(root)}\n        sourceRunId: '${sourceRunId}'\n        sourceWorkspaceId: '${sourceWorkspaceId}'\n        sourceHashes: ${JSON.stringify(sourceHashes)}\n`);
console.log(`Prepared ${target}; no installation, model execution, Session creation/resume, or native mutation performed.`);
