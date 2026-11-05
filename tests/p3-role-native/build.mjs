/** New immutable TEST_ONLY package on every build; parent alone installs it. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
const source = dirname(fileURLToPath(import.meta.url)), root = dirname(dirname(source));
const mode = process.argv[2];
assert.ok(['before', 'after'].includes(mode), 'Use build.mjs before|after');
const identity = `${mode}-${randomUUID()}`, target = join(source, 'packages', identity);
const name = `@local/dsh-finance-p3-role-native-${identity}-test-only`;
await mkdir(join(source, 'packages'), { recursive: true });
await mkdir(target);
const recorder = await readFile(join(root, 'tests/p2-live/report-io.js'));
const probe = (await readFile(join(source, 'probe.js'), 'utf8')).replace("from '../p2-live/report-io.js'", "from './report-io.js'");
assert.ok(probe.includes("from './report-io.js'"));
const files = { 'probe.js': probe, 'report-io.js': recorder };
if (mode === 'after') for (const file of ['after.js', 'inflight.js']) files[file] = await readFile(join(source, file));
files['TEST_ONLY-fixture.json'] = JSON.stringify({ kind: 'TEST_ONLY_P3_ROLE_NATIVE_PACKAGE', mode, identity, target, installed: false }, null, 2) + '\n';
files['package.json'] = JSON.stringify({ name, version: '0.0.1', private: true, type: 'module',
  description: 'Disposable TEST_ONLY native role integration probe; no models, commercial claims, Client or shell.',
  exports: { '.': './probe.js' }, files: [...Object.keys(files), 'package.json', 'cordis.patch.yml'],
  engines: { dsh: '0.2.1-rc.5' }, dsh: { bundle: { patch: './cordis.patch.yml' } } }, null, 2) + '\n';
files['cordis.patch.yml'] = `# TEST_ONLY metadata-free fixture; parent installs manually.\n- insert:\n    - id: finance-p3-role-native-${identity}-test-only\n      name: '${name}'\n      config:\n        bundleRoot: ${JSON.stringify(root)}\n        mode: ${mode}\n`;
for (const [file, content] of Object.entries(files)) await writeFile(join(target, file), content, { flag: 'wx' });
assert.deepEqual(await readFile(join(target, 'report-io.js')), recorder);
console.log(JSON.stringify({ target, name, identity, mode, installed: false, modelsRun: false,
  recorderSha256: createHash('sha256').update(recorder).digest('hex') }, null, 2));
