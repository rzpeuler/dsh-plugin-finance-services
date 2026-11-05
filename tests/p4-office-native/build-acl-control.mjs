// Distinguish "restricted token cannot read the bundled interpreter" from "runner cannot start anything".
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
const root = dirname(fileURLToPath(import.meta.url)), previous = '20261105-g8b9d366d'
const run = `20261105-h${randomUUID().replaceAll('-', '').slice(0, 8)}`
const from = join(root, `fixture-${previous}`), target = join(root, `fixture-${run}`)
const swap = (text, before, after) => { if (!text.includes(before)) throw new Error('Observed source changed'); return text.replace(before, after) }
for (const file of ['index.js', 'technical_producer.py', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'icon.svg', 'README.md', 'package.json']) {
  let text = (await readFile(join(from, file), 'utf8')).replaceAll(previous, run)
  if (file === 'index.js') {
    text = swap(text, `    const matrix = [['pythonVersionOverriddenEnv', dependencies.python, true], ['pythonVersionInheritedEnv', dependencies.python, false],
      ['nodeVersionOverriddenEnv', dependencies.node, true], ['nodeVersionInheritedEnv', dependencies.node, false]]`,
      `    const matrix = [['systemCommandUnderConfinement', join(process.env.SystemRoot ?? 'C:\\\\Windows', 'System32', 'cmd.exe'), false, ['/d', '/c', 'ver']],
      ['bundledPythonUnderConfinement', dependencies.python, false, ['--version']]]`)
    text = swap(text, `await operation(id, async () => {
      await spawn([executable, '--version'], undefined, withEnv); return { fixedArgumentsOnly: true, envOverridden: withEnv }
    })`, `await operation(id, async () => {
      await spawn([executable, ...extra], undefined, withEnv); return { fixedArgumentsOnly: true, envOverridden: withEnv }
    })`)
    text = swap(text, 'for (const [id, executable, withEnv] of matrix)', 'for (const [id, executable, withEnv, extra] of matrix)')
    text = swap(text, "  for (const key of ['author', 'root', 'authorRuntimeBinding', 'authorKitBinding', 'pythonVersionOverriddenEnv', 'pythonVersionInheritedEnv', 'nodeVersionOverriddenEnv', 'nodeVersionInheritedEnv'])",
      "  for (const key of ['author', 'root', 'authorRuntimeBinding', 'authorKitBinding', 'systemCommandUnderConfinement', 'bundledPythonUnderConfinement'])")
    text = text.replace("diagnosticOnly: 'ENVIRONMENT_REPLACEMENT_VERSUS_RUNNER_START_DIAGNOSIS',", "diagnosticOnly: 'SYSTEM_VERSUS_BUNDLED_EXECUTABLE_CONFINEMENT_READ_DIAGNOSIS',")
  }
  if (file === 'README.md') text += '\n\nRead-scope control only: one Windows system command and one bundled interpreter run under the same confinement policy. A pass for the system command with a failure for the bundled interpreter indicates the restricted token cannot read the user-profile runtime tree; two failures indicate the runner cannot start any child. No unconfined retry or environment escalation.\n'
  await mkdir(dirname(join(target, file)), { recursive: true })
  await writeFile(join(target, file), text, { flag: 'wx' })
}
const ready = { runId: run, target, reportPath: join(root, 'runs', run, 'report.json'), diagnosticOnly: true, scope: 'TWO_FIXED_CONFINED_CALLS_SYSTEM_VS_BUNDLED' }
await writeFile(join(root, `ready-${run}.json`), JSON.stringify(ready, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(ready, null, 2))
