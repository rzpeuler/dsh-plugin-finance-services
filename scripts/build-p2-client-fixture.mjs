/** Build only the disposable TEST_ONLY package; never installs, starts a server, or runs acceptance. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import { createP2ClientFixture } from '../tests/p2-client/client.js'
import { createP2ClientContract } from '../tests/p2-client/contract.js'

if (process.argv.length > 2) throw new Error('No flags supported: this builds the TEST_ONLY package, not the product')
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const base = join(root, 'tests', 'p2-client')
const output = join(base, 'fixture-retry-1')
const packageName = '@local/dsh-financial-services-p2-client-retry-1'
const owner = { owner: 'financial-services-p2-client-fixture', kind: 'TEST_ONLY_NON_FINANCIAL' }
await mkdir(output, { recursive: true })
try {
  const old = JSON.parse(await readFile(join(output, 'TEST_ONLY-fixture.json'), 'utf8'))
  if (old.owner !== owner.owner || old.kind !== owner.kind) throw new Error('Refusing to overwrite an unowned fixture')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  try {
    await readFile(join(output, 'package.json'), 'utf8')
    throw new Error('Existing unowned package cannot be adopted')
  } catch (packageError) { if (packageError.code !== 'ENOENT') throw packageError }
}
async function materialize(name, content) {
  const path = join(output, name)
  // Observe every existing text file before overwrite, including generated artifacts.
  try { await readFile(path, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
  await writeFile(path, content, 'utf8')
}
await materialize('TEST_ONLY-fixture.json', JSON.stringify(owner, null, 2) + '\n')
for (const name of ['host.js', 'contract.js']) await materialize(name, await readFile(join(base, name), 'utf8'))
const client = `/* Disposable TEST_ONLY native Client fixture. No React/DOM or feature value imports. */\nwindow.__ModuleLoader__.load({\n  id: ${JSON.stringify(packageName)},\n  factory(require) {\n    const createP2ClientContract = (${createP2ClientContract.toString()});\n    const createP2ClientFixture = (${createP2ClientFixture.toString()});\n    return createP2ClientFixture(require('zod').z, createP2ClientContract);\n  }\n});\n`
new Script(client, { filename: 'TEST_ONLY/client.js' })
await materialize('client.js', client)
await materialize('package.json', JSON.stringify({
  name: packageName, version: '0.0.1', private: true, type: 'module',
  description: 'TEST_ONLY disposable P2 native Client/Host acceptance fixture; no product UI or financial execution.',
  engines: { dsh: '0.2.1-rc.5' },
  exports: { '.': './host.js', './client': './client.js', './package.json': './package.json' },
  files: ['host.js', 'contract.js', 'client.js', 'cordis.patch.yml', 'TEST_ONLY-fixture.json', 'README.md'],
  dependencies: { '@deepseek-ai/dsh-typert-protocol': '0.2.1-rc.5', zod: '4.4.3' },
  peerDependencies: { '@deepseek-ai/cordis': '~4.0.5' },
  dsh: {
    bundle: { patch: './cordis.patch.yml' },
    client: { platform: 'web', inject: [
      '@local/dsh-financial-services', '@deepseek-ai/dsh-client-resources',
      '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-api-remotes',
      '@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-client-ui-workspace',
      '@deepseek-ai/dsh-client-ui-layout', '@deepseek-ai/dsh-client-ui-conversation',
    ] },
  },
}, null, 2) + '\n')
await materialize('cordis.patch.yml', `# TEST_ONLY disposable fixture; no product navigation or preset changes.\n- insert:\n    - id: finance-p2-client-retry-1\n      name: '${packageName}'\n      config:\n        bundleRoot: ${JSON.stringify(root)}\n`)
await materialize('README.md', `# TEST_ONLY P2 Client/Host fixture\n\nInstall only after reviewing docs/P2_CLIENT_TEST_PLAN.md in the owning project. This package contributes no UI, tools, presets, locale namespace or artwork. Icon/locale metadata are intentionally omitted for this disposable renderless TEST_ONLY acceptance unit, not as a product-distribution exception.\n\nThe Client runs once per page activation. A safe ordinary mainView target and Conversation panel are mandatory. Only real production Slot inject callbacks are invoked. The Host receives results through native strict Typert RemoteService, restores binding by CAS and unregisters only its unique Workspace. Files and history remain. No model prompt is submitted.\n\nUninstall this test package after collecting acceptance/P2-live-client.json. Do not install it in a production profile for ongoing use. Rebuild does not install or execute it.\n`)
console.log(`Prepared TEST_ONLY package: ${output}`)
console.log('No installation, Profile change, server launch, Session creation, acceptance run, or product build performed.')
