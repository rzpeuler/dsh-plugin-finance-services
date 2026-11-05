// Disposable read-only installed-candidate/SDK audit. Not a business Worker run.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { z } from 'zod'
export const inject = ['financeOperations', 'financeData']
export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => { try { await operation(); checks.push({ id, status: 'PASS' }) } catch (error) { checks.push({ id, status: 'FAIL', error: error.code ?? error.name }) } }
  const pkg = JSON.parse(await readFile(join(config.bundleRoot, 'package.json'), 'utf8'))
  const load = name => import(pathToFileURL(join(config.bundleRoot, pkg.exports[name])).href)
  await check('installed-native-catalogue-ten-mains-thirty-workers', async () => { const c = await ctx.financeOperations.catalog({}); assert.equal(c.agents.length, 10); assert.equal(c.workers.length, 30) })
  await check('original-native-binding-null-revision19', async () => { const s = await ctx.financeOperations.snapshot({}); assert.equal(s.binding, null); assert.equal(s.revision, 19) })
  await check('native-data-policy-revision8-no-test-provider-or-grant', () => { const c = JSON.parse(ctx.financeData.catalog({}).catalogJson); assert.equal(c.revision, 8); assert.equal(c.adapters.length, 0); assert.equal(c.bindings.length, 0) })
  await check('public-p4-intake-sdk-ten-distinct-templates', async () => { const { createBusinessTaskTemplates } = await load('./business-task-templates/v1'); const t = createBusinessTaskTemplates(z); assert.equal(t.list().templates.length, 10); for (const row of t.list().templates) assert.ok(t.describe(row.presetId)) })
  await check('public-gl-sdk-is-pure-computation-not-a-grant', async () => { const g = await load('./business-checks/gl-v1'); assert.equal(typeof g.reconcileGl, 'function'); assert.throws(() => g.reconcileGl('{"approved":true}')) })
  await check('public-lp-sdk-fails-closed-with-no-authentication-claim', async () => { const p = await load('./business-checks/lp-v1'); assert.equal(p.describe().kind, 'PURE_LIBRARY_NOT_NATIVE_TOOL'); assert.equal(p.tieout('{"approved":true}').recommendation, 'HOLD') })
  const report = { candidate: pkg.version, status: checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL', evidence: 'REAL_NATIVE_SERVICES_AND_PUBLIC_SDK_IMPORTS_NOT_MODEL_WORKFLOW_OR_OFFICE', checks, modelCalls: 0, workerCalls: 0, officeGenerated: false, noStateMutations: true }
  await writeFile(join(config.bundleRoot, 'acceptance/P4-native-candidate-health-001.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
}
