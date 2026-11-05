// Diagnose the observed native start failure with fixed --version calls, retaining confinement.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
const root = dirname(fileURLToPath(import.meta.url)), previous = '20261105-ccdb97e03'
const run = `20261105-e${randomUUID().replaceAll('-', '').slice(0, 8)}`
const from = join(root, `fixture-${previous}`), target = join(root, `fixture-${run}`)
for (const file of ['index.js', 'technical_producer.py', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'icon.svg', 'README.md', 'package.json']) {
  let text = (await readFile(join(from, file), 'utf8')).replaceAll(previous, run)
  if (file === 'index.js') {
    const begin = text.indexOf("    if (!await operation('producerHash'")
    const end = text.indexOf('\n  task = run()', begin)
    if (begin < 0 || end < 0) throw new Error('Observed producer block changed')
    text = text.slice(0, begin) + `    await operation('pythonVersion', async () => { await spawn([dependencies.python, '--version']); return { fixedArgumentsOnly: true } })
    await operation('nodeVersion', async () => { await spawn([dependencies.node, '--version']); return { fixedArgumentsOnly: true } })
  }` + text.slice(end)
    const startList = text.indexOf("  for (const key of ['author'")
    const endList = text.indexOf(" report.operations[key] = { status: 'NOT_RUN' }", startList)
    if (startList < 0 || endList < 0) throw new Error('Observed status list changed')
    text = text.slice(0, startList) + "  for (const key of ['author', 'root', 'authorRuntimeBinding', 'authorKitBinding', 'pythonVersion', 'nodeVersion'])" + text.slice(endList)
    text = text.replace("bindingRoute: 'EXPLICIT_AUTHOR_LOCAL_TOOL_AND_SKILL_FACTS',", "bindingRoute: 'EXPLICIT_AUTHOR_LOCAL_TOOL_AND_SKILL_FACTS', diagnosticOnly: 'FIXED_NATIVE_STARTUP_MATRIX_NO_OFFICE_OR_MODEL',")
  }
  if (file === 'README.md') text += '\n\nStartup diagnostic only: two fixed native-confined --version calls distinguish an observed process-start failure from Office imports or artifact logic. No unconfined retry, runner rewriting, ACL/Core modification, financial-role tools or Office result is claimed.\n'
  await mkdir(dirname(join(target, file)), { recursive: true })
  await writeFile(join(target, file), text, { flag: 'wx' })
}
const ready = { runId: run, target, reportPath: join(root, 'runs', run, 'report.json'), diagnosticOnly: true, scope: 'TWO_FIXED_NATIVE_CONFINED_VERSION_CALLS' }
await writeFile(join(root, `ready-${run}.json`), JSON.stringify(ready, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(ready, null, 2))
