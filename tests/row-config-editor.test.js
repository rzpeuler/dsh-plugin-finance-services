import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import FinanceOperations from '../src/host.js'
import { createFinanceContract } from '../src/contract.js'

const DATA_NAME = '@local/dsh-financial-services/data-runtime-2'
const REVIEW_NAME = '@local/dsh-financial-services/review'
const schemas = createFinanceContract(z).schemas

function makeEntry(id, name, config) {
  return { options: { id, name, config: { ...config } } }
}

function makeService(entries, edit = async (entry, change) => { entry.options.config = change(entry.options.config, {}) }) {
  const editor = { configuration: () => entries.map(entry => ({ entry, inherited: {}, override: {} })), edit }
  const service = Object.create(FinanceOperations.prototype)
  service.ctx = { get: name => name === 'configEditor' ? editor : undefined }
  service.schemas = schemas
  return { service, editor }
}

test('rowConfig reads live ConfigEditor values for the exact finance-data row', () => {
  const data = makeEntry('finance-data', DATA_NAME, { requestTimeoutMs: 17000, maxConcurrentQueries: 9 })
  const review = makeEntry('finance-review', REVIEW_NAME, { policyId: 'strict', customJson: '', serviceKey: 'financeReview', domainSuffix: '', remote: true })
  const { service } = makeService([data, review])
  assert.deepEqual(service.rowConfig({ rowId: 'finance-data' }), {
    status: 'READY', rowId: 'finance-data', configJson: JSON.stringify({ requestTimeoutMs: 17000, maxConcurrentQueries: 9 }), error: null,
  })
  assert.deepEqual(JSON.parse(service.rowConfig({ rowId: 'finance-review' }).configJson), { policyId: 'strict', customJson: '' })
})

test('saveRowConfig updates only whitelisted fields and preserves hidden review instance settings', async () => {
  const data = makeEntry('finance-data', DATA_NAME, { requestTimeoutMs: 17000, maxConcurrentQueries: 9 })
  const review = makeEntry('finance-review', REVIEW_NAME, { policyId: 'original', customJson: '', serviceKey: 'financeReview', domainSuffix: '', remote: true })
  const { service } = makeService([data, review])
  const dataResult = await service.saveRowConfig({ rowId: 'finance-data',
    expectedJson: JSON.stringify({ requestTimeoutMs: 17000, maxConcurrentQueries: 9 }),
    configJson: JSON.stringify({ requestTimeoutMs: 22000, maxConcurrentQueries: 11 }) })
  assert.equal(dataResult.status, 'APPLIED')
  assert.deepEqual(data.options.config, { requestTimeoutMs: 22000, maxConcurrentQueries: 11 })

  const reviewResult = await service.saveRowConfig({ rowId: 'finance-review',
    expectedJson: JSON.stringify({ policyId: 'original', customJson: '' }),
    configJson: JSON.stringify({ policyId: 'fast', customJson: '' }) })
  assert.equal(reviewResult.status, 'APPLIED')
  assert.deepEqual(review.options.config, { policyId: 'fast', customJson: '', serviceKey: 'financeReview', domainSuffix: '', remote: true })
})

test('stale edits conflict, invalid custom policy is rejected, and absent rows are unavailable', async () => {
  const review = makeEntry('finance-review', REVIEW_NAME, { policyId: 'original', customJson: '', serviceKey: 'financeReview', domainSuffix: '', remote: true })
  let edits = 0
  const { service } = makeService([review], async (entry, change) => { const updated = change(entry.options.config, {}); edits++; entry.options.config = updated })
  const conflict = await service.saveRowConfig({ rowId: 'finance-review',
    expectedJson: JSON.stringify({ policyId: 'strict', customJson: '' }),
    configJson: JSON.stringify({ policyId: 'fast', customJson: '' }) })
  assert.equal(conflict.status, 'CONFLICT')
  assert.equal(edits, 0)
  const rejected = await service.saveRowConfig({ rowId: 'finance-review',
    expectedJson: JSON.stringify({ policyId: 'original', customJson: '' }),
    configJson: JSON.stringify({ policyId: 'custom', customJson: 'not-json' }) })
  assert.equal(rejected.status, 'REJECTED')
  assert.equal(edits, 0)
  assert.equal(service.rowConfig({ rowId: 'finance-data' }).status, 'UNAVAILABLE')
})

test('policy lifecycle failures expose a sanitized history diagnostic, not raw paths', async () => {
  const review = makeEntry('finance-review', REVIEW_NAME, { policyId: 'original', customJson: '', serviceKey: 'financeReview', domainSuffix: '', remote: true })
  const { service } = makeService([review], async () => {
    throw Object.assign(new Error('STORE_CORRUPT: persisted decision could not replay under policy fast (C:/private/profile)'), { code: 'STORE_CORRUPT' })
  })
  const result = await service.saveRowConfig({ rowId: 'finance-review',
    expectedJson: JSON.stringify({ policyId: 'original', customJson: '' }),
    configJson: JSON.stringify({ policyId: 'fast', customJson: '' }) })
  assert.equal(result.status, 'REJECTED')
  assert.equal(result.error.code, 'POLICY_HISTORY_STALE')
  assert.doesNotMatch(result.error.message, /C:\/private|profile/)
})

test('row config cannot target another Loader entry or write when ConfigEditor is absent', async () => {
  const main = makeEntry('financial-services', '@local/dsh-financial-services', {})
  const { service } = makeService([main])
  assert.equal(service.rowConfig({ rowId: 'finance-data' }).status, 'UNAVAILABLE')
  assert.throws(() => service.rowConfig({ rowId: 'other-row' }))
  const noEditor = Object.create(FinanceOperations.prototype)
  noEditor.ctx = { get: () => undefined }
  noEditor.schemas = schemas
  assert.equal(noEditor.rowConfig({ rowId: 'finance-data' }).status, 'UNAVAILABLE')
  assert.equal((await noEditor.saveRowConfig({ rowId: 'finance-data', expectedJson: '{}', configJson: '{}' })).status, 'UNAVAILABLE')
})
