// Preserve every failed fixture; build a new ordinary-ESM dependency-bound identity.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
const root = dirname(fileURLToPath(import.meta.url))
const oldRun = '20261105-a7e94c3f'
const run = `20261105-b${randomUUID().replaceAll('-', '').slice(0, 8)}`
const from = join(root, `fixture-${oldRun}`)
const target = join(root, `fixture-${run}`)
const files = ['index.js', 'technical_producer.py', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'icon.svg', 'README.md']
for (const file of files) {
  const path = join(target, file)
  await mkdir(dirname(path), { recursive: true })
  let text = (await readFile(join(from, file), 'utf8')).replaceAll(oldRun, run)
  if (file === 'README.md') text += '\n\nRetry dependency note: activating a shipped Cordis row needs no duplicate plugin dependency. This fixture instead performs ordinary public ESM library imports from its own package; the first attempt proved those imports do not use shipped-row resolution. Exact public library dependencies are therefore declared. No duplicate providers are mounted, no private resolver or hardcoded ASAR fallback is used.\n'
  await writeFile(path, text, { flag: 'wx' })
}
const manifest = JSON.parse(await readFile(join(from, 'package.json'), 'utf8'))
manifest.name = manifest.name.replaceAll(oldRun, run)
manifest.dependencies = { '@deepseek-ai/dsh-tool-workspace-dependencies': '0.2.1-rc.5', '@deepseek-ai/libreoffice-kit': '0.1.5', '@deepseek-ai/dsh-office-to-pdf': '0.2.1-rc.5' }
await writeFile(join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
const ready = { status: 'READY_NOT_INSTALLED', runId: run, target, package: manifest.name, reportPath: join(root, 'runs', run, 'report.json'), priorFailure: 'acceptance/P4-office-native-failure-001.json', change: 'Explicit ordinary ESM public-library dependencies, not additional mounted providers', technicalOnly: true }
await writeFile(join(root, `ready-${run}.json`), JSON.stringify(ready, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify(ready, null, 2))
