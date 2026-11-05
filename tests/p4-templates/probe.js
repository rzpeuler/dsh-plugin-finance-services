// Native probe: the ten task templates are readable through the operations Remote.
import { writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

export const name = 'finance-p4-templates-test-only'
export const inject = ['financeOperations', 'typertGateway', 'connection']

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', message: String(error?.message ?? '').slice(0, 200) }) }
  }
  const peer = ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'answer' })
  const call = (method, request = {}) => ctx.typertGateway.invoke({ namespace: 'financeOperations', method, args: { request }, peer, signal: peer.signal })

  try {
    await check('ten-templates-are-dispatchable', async () => {
      const payload = await call('taskTemplates')
      const parsed = JSON.parse(payload.templatesJson)
      assert.equal(parsed.templates.length, 10)
      assert.equal(parsed.templateVersion, '1.0.0')
      const ids = parsed.templates.map(item => item.presetId)
      assert.equal(new Set(ids).size, 10)
      return { templates: parsed.templates.length, version: parsed.templateVersion }
    })

    await check('every-template-names-a-main-preset-and-its-references', async () => {
      const payload = await call('taskTemplates')
      const parsed = JSON.parse(payload.templatesJson)
      const catalogue = await call('catalog')
      const mains = new Set(catalogue.agents.map(agent => agent.id))
      for (const template of parsed.templates) {
        assert.ok(mains.has(template.presetId), `${template.presetId} is not a main preset`)
        assert.ok(template.title.length > 3)
        assert.ok(template.templateVersion.length > 0)
        assert.ok(Array.isArray(template.checkpoints))
        assert.ok(Array.isArray(template.sourceRefs))
      }
      return { mains: mains.size }
    })

    await check('templates-carry-declared-checkpoints-not-approvals', async () => {
      const payload = await call('taskTemplates')
      const parsed = JSON.parse(payload.templatesJson)
      const withCheckpoints = parsed.templates.filter(template => template.checkpoints.length > 0)
      assert.ok(withCheckpoints.length >= 5, 'at least the source-documented checkpoints should be visible')
      const serialized = JSON.stringify(parsed)
      for (const forbidden of ['approved', 'signedOff', 'completedAt']) {
        assert.ok(!serialized.includes(forbidden), `templates must not report ${forbidden}`)
      }
      return { withCheckpoints: withCheckpoints.length }
    })

    await check('reading-templates-writes-nothing', async () => {
      const first = await call('taskTemplates')
      const second = await call('taskTemplates')
      assert.equal(first.templatesJson, second.templatesJson)
      return { bytes: first.templatesJson.length }
    })
  } finally {
    await peer.dispose().catch(() => {})
  }

  const report = {
    evidence: 'REAL_NATIVE_TASK_TEMPLATE_READ_MODEL_NOT_EXECUTION',
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    checks,
    modelCalls: 0,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
