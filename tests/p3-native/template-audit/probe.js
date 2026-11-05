// Disposable native registration smoke for the independent developer template, no query/model.
import { writeFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import assert from 'node:assert/strict'
export const inject = ['financeData', 'financeOperations']
export async function apply(ctx, config) {
  const root = await realpath(config.bundleRoot)
  const catalog = JSON.parse(ctx.financeData.catalog({}).catalogJson)
  const row = catalog.adapters.find(item => item.id === 'example-financial-statements')
  const checks = []
  const check = (id, run) => { try { run(); checks.push({ id, status: 'PASS' }) } catch { checks.push({ id, status: 'FAIL' }) } }
  check('independent-template-registered-real-host', () => assert.ok(row))
  check('not-configured-is-not-ready-or-entitled', () => { assert.equal(row.status.state, 'NOT_CONFIGURED'); assert.equal(row.credentialConfigured, false) })
  check('template-retains-test-only-license-and-narrow-coverage', () => { assert.equal(row.testOnly, true); assert.equal(row.licenseClass, 'TEST_ONLY'); assert.deepEqual(row.capabilities.map(item => item.id), ['financial.statements']) })
  check('registration-did-not-create-any-source-grant', () => assert.ok(!catalog.bindings.some(binding => binding.adapterId === row.id)))
  check('own-template-control-registered', () => assert.ok(ctx.get('financeExampleDataAdapter')))
  const snapshot = await ctx.financeOperations.snapshot({})
  check('original-binding-unchanged', () => { assert.equal(snapshot.binding, null); assert.equal(snapshot.revision, 19) })
  await writeFile(join(root, 'acceptance/P3-template-native-smoke.json'), JSON.stringify({ status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL', evidence: 'REAL_NATIVE_INDEPENDENT_TEMPLATE_REGISTRATION_NOT_QUERY_OR_VISUAL', checks, policyRevision: catalog.revision, modelCalls: 0 }, null, 2) + '\n')
}
