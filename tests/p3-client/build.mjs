/** Fresh module/package identity every time; never installs, changes Profile or builds production. */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import { Script } from 'node:vm'
import { createP3ClientContract } from './contract.js'
import { createP3ClientFixture } from './client.js'
const source = dirname(fileURLToPath(import.meta.url)), root = dirname(dirname(source))
assert.equal(process.argv.length, 2, 'No flags: every build is a new immutable TEST_ONLY fixture')
const identity = randomUUID(), packageName = `@local/dsh-finance-p3-client-${identity}-test-only`
const target = join(source, 'packages', identity)
await mkdir(join(source, 'packages'), { recursive: true }); await mkdir(target)
const host = (await readFile(join(source, 'host.js'), 'utf8')).replace("from '../p2-live/report-io.js'", "from './report-io.js'")
assert.ok(host.includes("from './report-io.js'"))
const recorder = await readFile(join(root, 'tests/p2-live/report-io.js'))
const client = `/* TEST_ONLY renderless native Client fixture; no feature/runtime imports. */\nwindow.__ModuleLoader__.load({\n id: ${JSON.stringify(packageName)},\n factory(require) {\n const createP3ClientContract = (${createP3ClientContract.toString()});\n const createP3ClientFixture = (${createP3ClientFixture.toString()});\n return createP3ClientFixture(require('zod').z, createP3ClientContract, ${JSON.stringify(packageName)});\n }\n});\n`
new Script(client, { filename: 'TEST_ONLY/client.js' })
const files = { 'host.js': host, 'contract.js': await readFile(join(source, 'contract.js')), 'client.js': client, 'report-io.js': recorder,
  'TEST_ONLY-fixture.json': JSON.stringify({ kind: 'TEST_ONLY_P3_CLIENT_PACKAGE', identity, packageName, target, installed: false }, null, 2) + '\n',
  'cordis.patch.yml': `# Disposable TEST_ONLY renderless fixture. Parent alone installs.\n- insert:\n    - id: finance-p3-client-${identity}-test-only\n      name: '${packageName}'\n      config:\n        bundleRoot: ${JSON.stringify(root)}\n        packageName: ${JSON.stringify(packageName)}\n`,
  'README.md': await readFile(join(source, 'README.md')),
}
files['package.json'] = JSON.stringify({ name: packageName, version: '0.0.1', private: true, type: 'module',
  description: 'Disposable TEST_ONLY P3 connected production callbacks and native Resources; no visual or commercial claim.',
  engines: { dsh: '0.2.1-rc.5' }, exports: { '.': './host.js', './client': './client.js', './package.json': './package.json' },
  files: [...Object.keys(files), 'package.json'], dependencies: { '@deepseek-ai/dsh-typert-protocol': '0.2.1-rc.5', zod: '4.4.3' },
  peerDependencies: { '@deepseek-ai/cordis': '~4.0.5' }, dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web', inject: [
    '@local/dsh-financial-services', '@deepseek-ai/dsh-client-resources', '@deepseek-ai/dsh-client-ui-renderer',
    '@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-cordis-client-runner',
  ] } } }, null, 2) + '\n'
for (const [file, content] of Object.entries(files)) await writeFile(join(target, file), content, { flag: 'wx' })
assert.deepEqual(await readFile(join(target, 'report-io.js')), recorder)
console.log(JSON.stringify({ readyTarget: target, packageName, identity, installed: false, modelsRun: false,
  recorderSha256: createHash('sha256').update(recorder).digest('hex'),
  evidence: 'REAL_CONNECTED_CLIENT_PRODUCTION_CALLBACKS_AND_NATIVE_RESOURCES_NOT_VISUAL' }, null, 2))
