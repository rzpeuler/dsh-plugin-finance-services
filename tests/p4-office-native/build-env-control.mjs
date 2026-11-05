// Decide whether the observed native start failure is our environment replacement or the sandbox runner.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
const root = dirname(fileURLToPath(import.meta.url)), previous = '20261105-eae51cdd1'
const run = `20261105-g${randomUUID().replaceAll('-', '').slice(0, 8)}`
const from = join(root, `fixture-${previous}`), target = join(root, `fixture-${run}`)
const swap = (text, before, after) => { if (!text.includes(before)) throw new Error(`Observed source changed: ${before.slice(0, 60)}`); return text.replace(before, after) }
for (const file of ['index.js', 'technical_producer.py', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'icon.svg', 'README.md', 'package.json']) {
  let text = (await readFile(join(from, file), 'utf8')).replaceAll(previous, run)
  if (file === 'index.js') {
    text = swap(text, 'async function spawn(argv, extraSignal = AbortSignal.any([signal, AbortSignal.timeout(90000)])) {',
      'async function spawn(argv, extraSignal = AbortSignal.any([signal, AbortSignal.timeout(90000)]), withEnv = true) {')
    const start = text.indexOf('      env: { SystemRoot:')
    const end = text.indexOf("PYTHONPATH: '', PYTHONHOME: '', NODE_OPTIONS: '', NODE_PATH: '' } })", start)
    if (start < 0 || end < 0) throw new Error('Observed env block changed')
    text = text.slice(0, start) + `      ...(withEnv ? { env: { SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT, windir: process.env.windir ?? process.env.WINDIR, ELECTRON_RUN_AS_NODE: '1', TEMP: join(root, 'tmp'), TMP: join(root, 'tmp'), TMPDIR: join(root, 'tmp'), PYTHONDONTWRITEBYTECODE: '1',
        ` + text.slice(start + '      env: { SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT, windir: process.env.windir ?? process.env.WINDIR, ELECTRON_RUN_AS_NODE: \'1\', TEMP: join(root, \'tmp\'), TMP: join(root, \'tmp\'), TMPDIR: join(root, \'tmp\'), PYTHONDONTWRITEBYTECODE: \'1\',\n        '.length)
    text = swap(text, "PYTHONPATH: '', PYTHONHOME: '', NODE_OPTIONS: '', NODE_PATH: '' } })", "PYTHONPATH: '', PYTHONHOME: '', NODE_OPTIONS: '', NODE_PATH: '' } } : {}) })")
    text = swap(text, "    await operation('pythonVersion', async () => { await spawn([dependencies.python, '--version']); return { fixedArgumentsOnly: true } })\n    await operation('nodeVersion', async () => { await spawn([dependencies.node, '--version']); return { fixedArgumentsOnly: true } })",
      `    const matrix = [['pythonVersionOverriddenEnv', dependencies.python, true], ['pythonVersionInheritedEnv', dependencies.python, false],
      ['nodeVersionOverriddenEnv', dependencies.node, true], ['nodeVersionInheritedEnv', dependencies.node, false]]
    for (const [id, executable, withEnv] of matrix) await operation(id, async () => {
      await spawn([executable, '--version'], undefined, withEnv); return { fixedArgumentsOnly: true, envOverridden: withEnv }
    })`)
    text = swap(text, "  for (const key of ['author', 'root', 'authorRuntimeBinding', 'authorKitBinding', 'pythonVersion', 'nodeVersion'])",
      "  for (const key of ['author', 'root', 'authorRuntimeBinding', 'authorKitBinding', 'pythonVersionOverriddenEnv', 'pythonVersionInheritedEnv', 'nodeVersionOverriddenEnv', 'nodeVersionInheritedEnv'])")
    text = text.replace("diagnosticOnly: 'FIXED_NATIVE_STARTUP_MATRIX_NO_OFFICE_OR_MODEL',", "diagnosticOnly: 'ENVIRONMENT_REPLACEMENT_VERSUS_RUNNER_START_DIAGNOSIS',")
  }
  if (file === 'README.md') text += '\n\nEnvironment control only: the same fixed native-confined `--version` calls run twice, once with the fixture-supplied environment and once inheriting the native provider environment. This distinguishes an environment-replacement defect from a confinement-runner start failure. No unconfined retry, runner replacement, Core/ACL edit, Office or business claim.\n'
  await mkdir(dirname(join(target, file)), { recursive: true })
  await writeFile(join(target, file), text, { flag: 'wx' })
}
const ready = { runId: run, target, reportPath: join(root, 'runs', run, 'report.json'), diagnosticOnly: true, scope: 'ENVIRONMENT_CONTROL_FOUR_FIXED_VERSION_CALLS' }
await writeFile(join(root, `ready-${run}.json`), JSON.stringify(ready, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(ready, null, 2))
