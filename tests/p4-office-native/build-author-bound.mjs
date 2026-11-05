// Technical capability alternative using creator-supplied, verified local bindings.
// No public package-resolver success is claimed; no replacement engine or private loader.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
const root = dirname(fileURLToPath(import.meta.url)), oldRun = '20261105-a7e94c3f'
const run = `20261105-c${randomUUID().replaceAll('-', '').slice(0, 8)}`, from = join(root, `fixture-${oldRun}`), target = join(root, `fixture-${run}`)
const replace = (text, oldText, value) => { if (!text.includes(oldText)) throw new Error('Observed source changed'); return text.replace(oldText, value) }
for (const file of ['index.js', 'technical_producer.py', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'icon.svg', 'README.md']) {
  await mkdir(dirname(join(target, file)), { recursive: true })
  let text = (await readFile(join(from, file), 'utf8')).replaceAll(oldRun, run)
  if (file === 'index.js') {
    const begin = text.indexOf("    if (!await operation('resolver'")
    const end = text.indexOf("    if (!await operation('producerHash'", begin)
    if (begin < 0 || end < 0) throw new Error('Observed resolver block changed')
    text = text.slice(0, begin) + `    if (!await operation('authorRuntimeBinding', async () => {
      requireThat(config.bindings?.source === 'CREATOR_TOOL_AND_SKILL_SUPPLIED', 'Trusted author binding required')
      const manifest = JSON.parse(new TextDecoder().decode(await ctx.fs.readBytes(await ctx.fs.resolve(join(config.primaryRuntimeSource, 'runtime.json'), { signal }), signal, 8000)))
      requireThat(manifest.payloadDigest === config.bindings.payloadDigest && manifest.platform === 'win32' && manifest.arch === 'x64', 'Selected payload manifest changed')
      dependencies = {}
      for (const key of ['python', 'node']) {
        const mapped = ctx.fs.processPathFromHostPath(config.bindings[key])
        requireThat(mapped, 'Author executable has no execution-world mapping')
        dependencies[key] = await ctx.subprocess.resolveExecutable(mapped, undefined, signal)
      }
      check()
      return { resolved: dependencies, bindingSource: config.bindings.source, publicPackageResolverVerified: false, payloadDigest: manifest.payloadDigest }
    })) return
    await operation('authorKitBinding', async () => {
      kit = { cliPath: ctx.fs.processPathFromHostPath(config.bindings.kitCli), bindingSource: 'OFFICE_RECALCULATE_SKILL_EXACT_PATH', discoverRuntimeVerified: false }
      requireThat(kit.cliPath && (await ctx.fs.stat(await ctx.fs.resolve(kit.cliPath, { signal }), signal))?.type === 'file', 'Skill-supplied installed Kit CLI unavailable')
      check()
      return kit
    })
` + text.slice(end)
    text = text.replace("'resolver', 'kitDiscovery'", "'authorRuntimeBinding', 'authorKitBinding'")
    text = replace(text, "      const { OfficeSourceKey } = await import('@deepseek-ai/dsh-office-to-pdf')\n", '')
    text = replace(text, 'key: OfficeSourceKey(JSON.stringify([actor.id, root, source.item.targetKey]))', 'key: JSON.stringify([actor.id, root, source.item.targetKey])')
    text = replace(text, "businessE2E: false, financeRolePermissionsTested: false,", "businessE2E: false, financeRolePermissionsTested: false, publicLibraryResolutionProved: false, bindingRoute: 'EXPLICIT_AUTHOR_LOCAL_TOOL_AND_SKILL_FACTS',")
    text = replace(text, "stdio: { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' }", "stdio: { stdin: 'ignore', stdout: { maxBytes: 12000 }, stderr: { maxBytes: 12000 } }")
    text = replace(text, "env: { TEMP: join(root, 'tmp')", "env: { SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT, windir: process.env.windir ?? process.env.WINDIR, ELECTRON_RUN_AS_NODE: '1', TEMP: join(root, 'tmp')")
    text = replace(text, '      row.outcome = outcome', "      row.outcome = outcome\n      row.stdout = handle.collected.stdout?.readFrom(0)\n      row.stderr = handle.collected.stderr?.readFrom(0)")
  }
  if (file === 'cordis.patch.yml') text += `    # Installation-local technical bindings from actual dependency Tool/Office skill facts; not Model inputs.\n        bindings:\n          source: CREATOR_TOOL_AND_SKILL_SUPPLIED\n          payloadDigest: e2cef445c262ce6e8d28480b5ebecc8b0c54c06bea7183374debfcf02f30eb7d\n          python: 'C:\\Users\\Administrator\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe'\n          node: 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\DeepSeek Harness\\resources\\runtime\\primary-runtime\\dependencies\\node\\bin\\node.exe'\n          kitCli: 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\DeepSeek Harness\\resources\\app.asar.unpacked\\dsh\\node_modules\\@deepseek-ai\\libreoffice-kit\\lib\\cli.js'\n`
  if (file === 'README.md') text += '\n\nExplicit technical binding route: public-library imports failed in linked fixtures; file-protocol dependency preparation timed out. Those failures remain archived. This attempt does NOT claim public package discovery/resolution. It uses installation-local paths explicitly supplied by the actual creator dependency Tool and Office recalculation skill, verifies the selected payload digest and executable mapping, and invokes the SAME installed Kit CLI under native confinement. OfficeSourceKey is the inspected public branded string type, not a runtime class; source identity remains explicit and bounded. No alternate engine, private resolver, guessed path or financial-role permission is used. This technical smoke cannot pass P4 business/runtime integration.\n'
  await writeFile(join(target, file), text, { flag: 'wx' })
}
const manifest = JSON.parse(await readFile(join(from, 'package.json'), 'utf8')); manifest.name = manifest.name.replaceAll(oldRun, run); delete manifest.dependencies
await writeFile(join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
const ready = { runId: run, target, package: manifest.name, reportPath: join(root, 'runs', run, 'report.json'), technicalOnly: true, publicPackageResolutionProved: false, source: 'ACTUAL_CREATOR_DEPENDENCY_TOOL_AND_OFFICE_SKILL_PATHS', status: 'READY_NOT_INSTALLED' }
await writeFile(join(root, `ready-${run}.json`), JSON.stringify(ready, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(ready, null, 2))
