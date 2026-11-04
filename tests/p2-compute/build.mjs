/** Generate unique independently installable TEST_ONLY probes. Parent installs; this script never does. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const source = dirname(fileURLToPath(import.meta.url));
const root = dirname(dirname(source));
const mode = process.argv[2];
assert.ok(['before', 'after'].includes(mode), 'Usage: node tests/p2-compute/build.mjs before|after');
const identity = `${mode}-${randomUUID()}`;
const target = join(source, 'packages', identity);
await mkdir(join(source, 'packages'), { recursive: true });
await mkdir(target, { recursive: false });
// Preserve prior latest evidence before parent installs any retry; never alter its status or original bytes.
try {
  const prior = await readFile(join(root, 'acceptance', `P2-controlled-compute-${mode}.json`));
  await writeFile(join(target, `prior-${mode}-evidence.json`), prior, { flag: 'wx' });
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const owner = { kind: 'TEST_ONLY_CONTROLLED_COMPUTE_PACKAGE', identity, mode, target };
const name = `@local/dsh-finance-p2-compute-${identity}-test-only`;
const files = {
  'probe.js': (await readFile(join(source, 'probe.js'), 'utf8')).replace("from '../p2-live/report-io.js'", "from './report-io.js'"),
  'report-io.js': await readFile(join(root, 'tests/p2-live/report-io.js'), 'utf8'),
  'golden.js': await readFile(join(source, 'golden.js'), 'utf8'),
  'TEST_ONLY-fixture.json': JSON.stringify(owner, null, 2) + '\n',
  'package.json': JSON.stringify({ name, version: '0.0.1', private: true, type: 'module',
    description: `Disposable TEST_ONLY controlled-compute ${mode} native probe; never runs models or modifies Client/default binding.`,
    exports: { '.': './probe.js' }, files: ['probe.js', 'report-io.js', 'golden.js', 'cordis.patch.yml', 'TEST_ONLY-fixture.json'],
    engines: { dsh: '0.2.1-rc.5' }, dsh: { bundle: { patch: './cordis.patch.yml' } } }, null, 2) + '\n',
  'cordis.patch.yml': `# Disposable TEST_ONLY metadata-free fixture. Install exclusively by parent.\n- insert:\n    - id: finance-p2-compute-${identity}-test-only\n      name: '${name}'\n      config:\n        bundleRoot: ${JSON.stringify(root)}\n        mode: '${mode}'\n`,
};
for (const [name, content] of Object.entries(files)) await writeFile(join(target, name), content, { flag: 'wx' });
console.log(JSON.stringify({ target, name, mode, identity, installed: false, modelsRun: false }, null, 2));
