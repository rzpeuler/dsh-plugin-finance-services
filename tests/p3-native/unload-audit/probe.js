// TEST_ONLY read-only native audit after both independent Adapter bundles were removed.
import { readFile, writeFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import assert from 'node:assert/strict'
export const name = 'finance-p3-unload-audit-test-only'
export const inject = ['financeData', 'financeOperations', 'storageDomain', 'agents']
export async function apply(ctx, config) {
  const root = await realpath(config.bundleRoot)
  const prior = JSON.parse(await readFile(join(root, 'acceptance/P3-foundation-native-pass-001.json'), 'utf8'))
  const catalog = JSON.parse(ctx.financeData.catalog({}).catalogJson)
  const owned = new Set(prior.sessions.map(session => session.id))
  const checks = []
  const check = (id, operation) => { try { operation(); checks.push({ id, status: 'PASS' }) } catch (error) { checks.push({ id, status: 'FAIL', error: error.message }) } }
  check('removed-adapters-absent-from-live-catalog', () => assert.ok(!catalog.adapters.some(item => ['test-mcp-statements', 'test-rest-statements'].includes(item.id))))
  check('removed-controls-not-provided', () => { assert.equal(ctx.get('financeTestMcpAdapter'), undefined); assert.equal(ctx.get('financeTestRestAdapter'), undefined) })
  check('owned-source-policy-scopes-not-retained', () => assert.ok(!catalog.bindings.some(item => item.scopeIds.some(id => owned.has(id)))))
  check('owned-agents-remain-disposed-without-cold-resume', () => { for (const id of owned) assert.equal(ctx.agents.get(id), undefined) })
  const durable = ctx.storageDomain.get('financial_data').table('policy').get('root')
  check('native-durable-policy-matches-catalog-after-cleanup', () => assert.deepEqual(durable, { revision: catalog.revision, bindings: catalog.bindings }))
  const finance = ctx.financeOperations.snapshot({})
  check('default-financial-binding-unchanged', () => { assert.equal(finance.binding, null); assert.equal(finance.revision, 19) })
  const report = { evidence: 'REAL_NATIVE_READ_ONLY_POST_UNINSTALL_AUDIT', observedAt: new Date().toISOString(), status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL', checks, adapterCount: catalog.adapters.length, policyRevision: catalog.revision, financialRevision: finance.revision, modelCalls: 0, noUserStateMutated: true }
  await writeFile(join(root, 'acceptance/P3-adapter-unload-audit.json'), JSON.stringify(report, null, 2) + '\n')
}
