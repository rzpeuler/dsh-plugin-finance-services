// Native probe: the workbook read model returns real xlsx bytes through the Remote gateway.
import { writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

export const name = 'finance-p6-workbook-test-only'
export const inject = ['financeReview', 'typertGateway', 'connection']

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION', message: String(error?.message ?? '').slice(0, 200) }) }
  }
  const peer = ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'answer' })
  const call = (method, request = {}) => ctx.typertGateway.invoke({ namespace: 'financeReview', method, args: { request }, peer, signal: peer.signal })

  try {
    await check('the-workbook-method-is-dispatchable-and-returns-bytes', async () => {
      const payload = await call('reviewWorkbook')
      assert.match(payload.filename, /^[A-Za-z0-9._-]+\.xlsx$/)
      assert.ok(Number.isInteger(payload.bytes) && payload.bytes > 500)
      assert.equal(typeof payload.base64, 'string')
      const bytes = Buffer.from(payload.base64, 'base64')
      assert.equal(bytes.length, payload.bytes)
      assert.equal(bytes[0], 0x50)
      assert.equal(bytes[1], 0x4b)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), payload.sha256)
      return { filename: payload.filename, bytes: payload.bytes, sha256: payload.sha256 }
    })

    await check('the-bytes-are-written-for-independent-verification', async () => {
      const payload = await call('reviewWorkbook')
      const bytes = Buffer.from(payload.base64, 'base64')
      await writeFile(config.outPath, bytes)
      return { path: config.outPath, bytes: bytes.length, sha256: payload.sha256 }
    })

    await check('a-repeat-call-is-stable-but-not-cached-in-the-document', async () => {
      const before = ctx.financeReview.inspect()
      const first = await call('reviewWorkbook')
      const second = await call('reviewWorkbook')
      const after = ctx.financeReview.inspect()
      assert.equal(first.sha256, second.sha256, 'the same facts must build the same workbook')
      assert.equal(after.revision, before.revision, 'building a workbook must not write the review document')
      return { bytes: first.bytes, revision: after.revision }
    })

    await check('no-decision-or-write-endpoint-was-added', async () => {
      const attempts = []
      for (const method of ['settle', 'recordStage', 'publish']) {
        try { await call(method); attempts.push({ method, status: 'DISPATCHED' }) }
        catch (error) { attempts.push({ method, status: 'REFUSED', code: error?.code ?? error?.name }) }
      }
      assert.ok(attempts.every(item => item.status === 'REFUSED'), JSON.stringify(attempts))
      return { attempts }
    })
  } finally {
    await peer.dispose().catch(() => {})
  }

  const report = {
    evidence: 'REAL_NATIVE_WORKBOOK_BYTES_OVER_REMOTE_NOT_BROWSER_DOWNLOAD',
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    checks,
    modelCalls: 0,
  }
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
