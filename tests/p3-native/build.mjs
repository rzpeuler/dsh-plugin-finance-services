/** Create a unique TEST_ONLY native probe bundle. Parent installs; never changes the profile. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
const source = dirname(fileURLToPath(import.meta.url)), root = dirname(dirname(source));
const identity = `foundation-${Date.now()}-${randomUUID()}`;
const target = join(source, 'packages', identity), name = `@local/dsh-finance-p3-native-${identity}-test-only`;
await mkdir(join(source, 'packages'), { recursive: true });
await mkdir(target, { recursive: false });
const recorder = await readFile(join(root, 'tests', 'p2-live', 'report-io.js'));
const probe = (await readFile(join(source, 'probe.js'), 'utf8')).replace("from '../p2-live/report-io.js'", "from './report-io.js'");
assert.ok(probe.includes("from './report-io.js'"));
const files = {
  'probe.js': probe,
  'report-io.js': recorder,
  'TEST_ONLY-fixture.json': JSON.stringify({ kind: 'TEST_ONLY_P3_NATIVE_PACKAGE', identity, target, mode: 'foundation',
    evidence: 'REAL_NATIVE_HOST_SERVICES_NOT_CLIENT_TOOL_OR_COMMERCIAL', p3Status: 'PARTIAL', installed: false }, null, 2) + '\n',
  'package.json': JSON.stringify({ name, version: '0.0.1', private: true, type: 'module',
    description: 'Disposable TEST_ONLY native Host Service foundation probe; no model, Client, commercial execution or profile changes.',
    exports: { '.': './probe.js' }, files: ['probe.js', 'report-io.js', 'cordis.patch.yml', 'TEST_ONLY-fixture.json'],
    engines: { dsh: '0.2.1-rc.5' }, dsh: { bundle: { patch: './cordis.patch.yml' } } }, null, 2) + '\n',
  'cordis.patch.yml': `# TEST_ONLY disposable metadata-free fixture. Parent installs after core and both independent Adapters.\n- insert:\n    - id: finance-p3-native-${identity}-test-only\n      name: '${name}'\n      config:\n        bundleRoot: ${JSON.stringify(root)}\n`,
};
for (const [file, content] of Object.entries(files)) await writeFile(join(target, file), content, { flag: 'wx' });
assert.deepEqual(await readFile(join(target, 'report-io.js')), recorder, 'Recorder must be an exact byte copy');
console.log(JSON.stringify({ target, name, identity, installed: false, modelsRun: false,
  recorderSha256: createHash('sha256').update(recorder).digest('hex'),
  evidence: 'REAL_NATIVE_HOST_SERVICES_NOT_CLIENT_TOOL_OR_COMMERCIAL', p3Status: 'PARTIAL' }, null, 2));
