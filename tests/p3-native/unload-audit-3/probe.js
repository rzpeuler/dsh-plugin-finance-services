// TEST_ONLY read-only audit after both full Adapter install/query/uninstall cycles.
import { readFile, writeFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import assert from 'node:assert/strict'
export const name = 'finance-p3-unload-audit-3-test-only'
export const inject = ['financeData', 'financeOperations', 'storageDomain', 'agents']
export async function apply(ctx, config) {
  const root = await realpath(config.bundleRoot)
  const files = ['P3-foundation-native-pass-001.json', 'P3-role-budget-before-pass-001.json', 'P3-role-native-pass-002.json', 'P3-live-client-pass-003.json']
  const owned = new Set()
  for (const file of files) {
    const report = JSON.parse(await readFile(join(root, 'acceptance', file), 'utf8'))
    assert.equal(report.status, 'PASS')
    for (const session of report.sessions ?? []) owned.add(session.id)
    const client = report.checks.find(check => check.id === 'host-owned-native-modeler-setup')
    if (client) owned.add(client.detail.ownedScopeId)
  }
  const catalog = JSON.parse(ctx.financeData.catalog({}).catalogJson)
  const checks = []
  const check = (id, operation) => { try { operation(); checks.push({ id, status: 'PASS' }) } catch { checks.push({ id, status: 'FAIL' }) } }
  check('owned-adapters-and-held-provider-absent', () => assert.ok(!catalog.adapters.some(item => ['test-mcp-statements', 'test-rest-statements'].includes(item.id) || item.id.startsWith('test-only-held-'))))
  check('owned-control-services-absent', () => { assert.equal(ctx.get('financeTestMcpAdapter'), undefined); assert.equal(ctx.get('financeTestRestAdapter'), undefined) })
  check('all-recorded-owned-source-scopes-absent', () => assert.ok(!catalog.bindings.some(binding => binding.scopeIds.some(id => owned.has(id)))))
  check('all-recorded-native-agents-disposed-no-cold-resume', () => { assert.ok(owned.size >= 9); for (const id of owned) assert.equal(ctx.agents.get(id), undefined) })
  check('native-policy-durability-matches-projection', () => assert.deepEqual(ctx.storageDomain.get('financial_data').table('policy').get('root'), { revision: catalog.revision, bindings: catalog.bindings }))
  const finance = await ctx.financeOperations.snapshot({})
  check('original-user-workspace-binding-null-19', () => { assert.equal(finance.binding, null); assert.equal(finance.revision, 19) })
  const report = { evidence: 'REAL_NATIVE_ALPHA2_POST_UNINSTALL_READ_ONLY_AUDIT', status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL', observedAt: new Date().toISOString(), checks, ownedAgentsChecked: owned.size, adapterCount: catalog.adapters.length, policyRevision: catalog.revision, financialRevision: finance.revision, diagnostics: catalog.diagnostics, modelCalls: 0, noUserStateMutated: true }
  await writeFile(join(root, 'acceptance/P3-alpha2-unload-audit.json'), JSON.stringify(report, null, 2) + '\n')
}
