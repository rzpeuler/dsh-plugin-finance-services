import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { createBusinessTaskTemplates } from '../src/business/task-templates.js'

const api = createBusinessTaskTemplates(z)
const copy = value => structuredClone(value)
const ids = api.list().templates.map(t => t.presetId)
// Fictional TEST_ONLY declarations, not existing files, parsed Office data or vendor results.
function fixture(presetId) {
  const slug = presetId.replace('finance-', '')
  let syntheticTicker = 600000
  const e = (ref, scheme = 'ticker') => ({ ref, scheme, identifier: `${String(syntheticTicker++).padStart(6, '0')}.SH` })
  const p = (ref, kind = 'fiscal_quarter', start = '2025-07-01', end = '2025-09-30', measurement = 'actual') => ({ ref, kind, start, end, measurement })
  const v = { templateVersion: '1.0.0', classification: 'TEST_ONLY', asOf: '2025-12-31', entities: [e('company')], periods: [p('period')],
    sourceIndex: [{ ref: 'source', label: 'TEST_ONLY synthetic data; no vendor', locator: 'TEST_ONLY fixture index section 1', classification: 'TEST_ONLY', sourceAsOf: '2025-12-31', availableAt: '2025-12-31' }],
    inputFileRefs: [], unit: { currency: 'CNY', scale: 'millions', accountingBasis: 'TEST_ONLY_GAAP', consolidation: 'consolidated' } }
  switch (slug) {
    case 'pitch-agent':
      v.entities.push(...Array.from({ length: 5 }, (_, i) => e(`peer${i}`)))
      v.business = { targetEntityRef: 'company', valuationPeriodRef: 'period', sector: 'TEST_ONLY software', situation: 'TEST_ONLY exploring alternatives',
        peerEntityRefs: v.entities.slice(1).map(e => e.ref), precedentCount: 5, financialsFileRef: 'financials', peersFileRef: 'peers', precedentsFileRef: 'precedents', bankTemplateFileRef: 'bank', assumptionsFileRef: 'assumptions' }
      break
    case 'market-researcher':
      v.entities = Array.from({ length: 8 }, (_, i) => e(`peer${i}`))
      v.business = { sector: 'TEST_ONLY sector', angle: 'TEST_ONLY theme', universeBoundary: 'TEST_ONLY mainland China A-share ordinary shares; excludes HK/B/ADR/ETF/LOF', researchPeriodRef: 'period',
        peerEntityRefs: v.entities.map(e => e.ref), factsFileRef: 'facts', peerMetricsFileRef: 'peers', screeningCriteriaFileRef: 'criteria', shortlistSize: 3, slidesRequested: false }
      break
    case 'earnings-reviewer':
      v.business = { companyEntityRef: 'company', reportingPeriodRef: 'period', releaseDate: '2025-11-01', consensusAsOf: '2025-10-31', mode: 'current_event',
        existingModelFileRef: 'model', actualsFileRef: 'actuals', consensusFileRef: 'consensus', priorEstimatesFileRef: 'prior', transcriptFileRef: 'transcript', releaseFileRef: 'release', guidanceFileRef: null, format: 'morning_note_wrapper' }
      break
    case 'meeting-prep-agent':
      v.entities = [e('client', 'client')]
      v.business = { clientEntityRef: 'client', calendarEventId: 'TEST_ONLY_event', meetingDate: '2026-01-05', reportingPeriodRef: 'period', profileFileRef: 'profile',
        holdingsFileRef: 'holdings', ipsFileRef: 'ips', benchmarksFileRef: 'benchmarks', communicationFileRefs: ['communications'], marketContextFileRef: 'context' }
      break
    case 'model-builder':
      v.periods = [...[2023, 2024, 2025].map(y => p(`h${y}`, 'fiscal_year', `${y}-01-01`, `${y}-12-31`)),
        ...[2026, 2027, 2028, 2029, 2030].map(y => p(`f${y}`, 'fiscal_year', `${y}-01-01`, `${y}-12-31`, 'estimate'))]
      v.business = { companyEntityRef: 'company', method: 'dcf-model', historicalPeriodRefs: v.periods.slice(0, 3).map(p => p.ref), forecastPeriodRefs: v.periods.slice(3).map(p => p.ref),
        financialsFileRef: 'financials', assumptionsFileRef: 'assumptions', assumptions: { terminalGrowth: 0.025, baseWacc: 0.09, dilutedShares: 10 } }
      break
    case 'kyc-screener':
      v.entities = [e('applicant', 'local')]; v.periods = [p('period', 'instant', '2025-12-31', '2025-12-31')]
      v.business = { applicantEntityRef: 'applicant', packetId: 'TEST_ONLY_packet', reviewDate: '2025-12-31', reviewPeriodRef: 'period', refreshKind: 'onboarding',
        packetFileRefs: ['packet'], namedPartyEntityRefs: ['applicant'], rulesGridFileRef: 'rules', rulesVersion: 'TEST_ONLY_v1', screeningFileRef: 'screening' }
      break
    case 'valuation-reviewer':
      v.entities = [e('fund', 'fund')]
      v.business = { fundEntityRef: 'fund', valuationPeriodRef: 'period', packageFileRefs: ['package'], policyFileRef: 'policy', portfolioRecordsFileRef: 'portfolio',
        waterfallTermsFileRef: 'waterfall', lpAllocationFileRef: 'allocation', budgetFileRef: 'budget', priorMarksFileRef: 'prior' }
      break
    case 'month-end-closer':
      v.entities = [e('entity', 'internal')]; v.periods = [p('period', 'month', '2025-12-01', '2025-12-31')]
      v.business = { accountingEntityRef: 'entity', closeMonth: '2025-12', closePeriodRef: 'period', trialBalanceFileRef: 'tb', priorCloseFileRef: 'prior', budgetFileRef: 'budget',
        accrualPolicyFileRef: 'policy', supportFileRefs: ['support'], activityFileRef: 'activity', materiality: 100 }
      break
    case 'statement-auditor':
      v.entities = [e('fund', 'fund')]
      v.business = { fundEntityRef: 'fund', batchId: 'TEST_ONLY_batch', capitalPeriodRef: 'period', statementFileRefs: ['statements'], navPackFileRef: 'nav',
        commitmentRegisterFileRef: 'register', priorCapitalFileRef: 'prior', nextPeriodFileRef: null, differenceTolerance: 0.01 }
      break
    default: throw new Error('Fixture missing')
  }
  const fileIds = Object.entries(v.business).filter(([key]) => /FileRefs?$/.test(key)).flatMap(([, value]) => value === null ? [] : Array.isArray(value) ? value : [value])
  v.inputFileRefs = [...new Set(fileIds)].map(ref => {
    const fileType = ref === 'bank' ? 'pptx' : ref === 'model' ? 'xlsx' : 'txt'
    return { ref, path: `inputs/TEST_ONLY/${slug}/${ref}.${fileType}`, sha256: 'a'.repeat(64), fileType,
      entityRefs: v.entities.map(e => e.ref), periodRefs: v.periods.map(p => p.ref), sourceRef: 'source' }
  })
  return v
}
const expectInvalid = (id, mutate, expected) => {
  const input = fixture(id); mutate(input)
  const result = api.validate(id, input)
  assert.equal(result.status, 'INVALID_INPUT', `${id}: expected rejection`)
  assert.equal(result.verification.authorization, 'NOT_DONE')
  if (expected) assert.ok(result.issues.some(i => i.code === expected), JSON.stringify(result.issues))
  return result
}

for (const id of ids) test(`${id}: distinct minimum intake remains unverified`, () => {
  const input = fixture(id), before = copy(input), result = api.validate(id, input)
  assert.equal(result.status, 'VALID_INTAKE_DECLARATION', JSON.stringify(result.issues))
  assert.deepEqual(input, before)
  assert.deepEqual(result.declaration, input)
  assert.deepEqual(result.verification, { fileRead: 'NOT_DONE', sha256: 'NOT_DONE', authorization: 'NOT_DONE', source: 'NOT_DONE', office: 'NOT_RUN', nativeWorkers: 'NOT_RUN' })
})

test('in-scope business stop cases remain specific and bounded', () => {
  expectInvalid('finance-market-researcher', v => { v.business.shortlistSize = 6 })
  expectInvalid('finance-earnings-reviewer', v => { v.business.consensusAsOf = '2025-11-02' }, 'EARNINGS_CHRONOLOGY')
  expectInvalid('finance-model-builder', v => { v.business.assumptions.terminalGrowth = v.business.assumptions.baseWacc }, 'TERMINAL_GROWTH_NOT_BELOW_WACC')
})

test('all three in-scope templates reject identity, code, endpoint, credentials and self-reported approval fields', () => {
  for (const id of ids) {
    for (const extra of [{ roleId: id }, { agentId: 'admin' }, { code: 'return process.env' }, { command: 'pwsh' },
      { credential: 'secret' }, { endpoint: 'https://vendor.invalid' }, { approved: true }, { sourceAuthorized: true }]) {
      expectInvalid(id, v => Object.assign(v, extra))
    }
    expectInvalid(id, v => { v.business.code = 'x => x' })
    expectInvalid(id, v => { v.sourceIndex[0].label = 'Bearer SECRET_DO_NOT_RETURN' })
    expectInvalid(id, v => { v.sourceIndex[0].locator = 'api_key=SECRET_DO_NOT_RETURN' })
    expectInvalid(id, v => { v.sourceIndex[0].locator = 'https://vendor.invalid/query' })
  }
  for (const id of ['finance-model-builder-builder', 'model-builder', 'finance-unknown', null, {}]) {
    assert.throws(() => api.describe(id), { code: 'BUSINESS_PRESET_UNKNOWN' })
    assert.throws(() => api.validate(id, {}), { code: 'BUSINESS_PRESET_UNKNOWN' })
  }
})

test('workspace path declarations reject absolute, traversal, device, ADS and encoded targets', () => {
  for (const path of ['../escape.txt', '/tmp/x.txt', 'C:/x.txt', 'C:\\x.txt', '\\\\host\\share\\x.txt', 'inputs/../x.txt',
    'inputs//x.txt', 'inputs/./x.txt', 'inputs/CON.txt', 'inputs/COM1.txt', 'inputs/x.txt:stream', 'inputs/%2e%2e/x.txt', 'inputs/x. /x.txt']) {
    expectInvalid('finance-model-builder', v => { v.inputFileRefs[0].path = path })
  }
  expectInvalid('finance-model-builder', v => { v.inputFileRefs[0].fileType = 'csv' }, 'EXTENSION_OR_DUPLICATE_PATH')
  expectInvalid('finance-model-builder', v => { v.inputFileRefs[0].sha256 = 'sha256:not-a-hash' })
})

test('source/entity/period references, classification, units and exact dates are bounded', () => {
  const id = 'finance-model-builder'
  expectInvalid(id, v => { v.entities.push(copy(v.entities[0])) }, 'DUPLICATE_REF')
  expectInvalid(id, v => { v.inputFileRefs[0].sourceRef = 'absent' }, 'UNRESOLVED_REF')
  expectInvalid(id, v => { v.inputFileRefs[0].entityRefs = ['absent'] }, 'UNRESOLVED_REF')
  expectInvalid(id, v => { v.sourceIndex[0].classification = 'USER_PROVIDED' }, 'SOURCE_SCOPE_OR_DATE')
  expectInvalid(id, v => { v.sourceIndex[0].availableAt = '2026-01-01' }, 'SOURCE_SCOPE_OR_DATE')
  expectInvalid(id, v => { v.periods[0].end = '2026-01-01' }, 'ACTUAL_AFTER_ASOF')
  expectInvalid(id, v => { v.asOf = '2025-02-29' })
  expectInvalid(id, v => { v.unit.scale = 'unspecified' })
  expectInvalid(id, v => { v.entities[0].scheme = 'fund' })
  expectInvalid(id, v => { v.entities[0].identifier = '600519' })
  expectInvalid(id, v => { v.entities[0].identifier = '600519.HK' })
  expectInvalid(id, v => { v.unit.currency = 'USD' })
  expectInvalid(id, v => { v.entities.push({ ref: 'other', scheme: 'ticker', identifier: '600001.SH' }); v.inputFileRefs[0].entityRefs = ['other'] }, 'BUSINESS_FILE_SCOPE_MISMATCH')
  expectInvalid('finance-model-builder', v => { v.business.forecastPeriodRefs.reverse() }, 'OVERLAPPING_OR_UNORDERED_PERIODS')
  expectInvalid('finance-model-builder', v => { v.business.method = 'dcf' })
  const replay = fixture('finance-earnings-reviewer'); replay.asOf = '2026-12-31'; replay.business.mode = 'historical_replay'
  assert.equal(api.validate('finance-earnings-reviewer', replay).status, 'VALID_INTAKE_DECLARATION')
  replay.business.mode = 'current_event'
  assert.equal(api.validate('finance-earnings-reviewer', replay).issues[0].code, 'STALE_EVENT_DECLARE_REPLAY')
  for (const classification of ['USER_PROVIDED', 'UNSOURCED']) {
    const v = fixture(id); v.classification = classification; v.sourceIndex[0].classification = classification
    assert.equal(api.validate(id, v).status, 'VALID_INTAKE_DECLARATION')
  }
})

test('byte/structure limits reject cycles, sparse arrays and accessors without executing code', () => {
  const id = 'finance-model-builder'
  const v = fixture(id)
  v.sourceIndex = Array.from({ length: 40 }, (_, i) => ({ ...v.sourceIndex[0], ref: `s${i}`, label: '汉'.repeat(160), locator: '汉'.repeat(240) }))
  v.inputFileRefs = Array.from({ length: 40 }, (_, i) => ({ ...v.inputFileRefs[0], ref: `file${i}`, path: `inputs/${'汉'.repeat(480)}${i}.txt`, sourceRef: 's0' }))
  assert.equal(api.validate(id, v).issues[0].code, 'BYTE_LIMIT')
  const cycle = fixture(id); cycle.loop = cycle
  assert.equal(api.validate(id, cycle).status, 'INVALID_INPUT')
  const sparse = fixture(id); sparse.entities = []; sparse.entities.length = 1000000000
  assert.equal(api.validate(id, sparse).status, 'INVALID_INPUT')
  const getter = fixture(id); let invoked = false
  Object.defineProperty(getter, 'code', { enumerable: true, get() { invoked = true; throw new Error('must not run') } })
  assert.equal(api.validate(id, getter).status, 'INVALID_INPUT'); assert.equal(invoked, false)
  const forgedPrototype = Object.create(null)
  forgedPrototype.hasOwnProperty = Object.prototype.hasOwnProperty
  Object.defineProperty(forgedPrototype, 'toJSON', { get() { invoked = true; throw new Error('must not run') } })
  invoked = false
  assert.equal(api.validate(id, Object.setPrototypeOf(fixture(id), forgedPrototype)).status, 'INVALID_INPUT')
  assert.equal(invoked, false)
  const customArray = fixture(id)
  class HookedArray extends Array { get toJSON() { invoked = true; throw new Error('must not run') } }
  customArray.entities = HookedArray.from(customArray.entities)
  assert.equal(api.validate(id, customArray).status, 'INVALID_INPUT'); assert.equal(invoked, false)
  const nullPrototype = Object.assign(Object.create(null), fixture(id))
  assert.equal(api.validate(id, nullPrototype).status, 'VALID_INTAKE_DECLARATION')
  const secretResult = expectInvalid(id, x => { x.sourceIndex[0].label = 'password=DO_NOT_LEAK' })
  assert.ok(!JSON.stringify(secretResult).includes('DO_NOT_LEAK'))
  assert.ok(secretResult.issues.length <= 12)
})

test('discovery is deferred, schema JSON serializable, immutable to callers and self-contained', () => {
  const listing = api.list()
  assert.ok(Object.isFrozen(api))
  assert.deepEqual(Object.keys(api), ['list', 'describe', 'validate'])
  assert.equal(listing.templates.length, 3)
  assert.ok(JSON.stringify(listing).length < 5000)
  assert.equal(listing.templates.some(t => 'inputSchema' in t), false)
  const factory = vm.runInNewContext(`(${createBusinessTaskTemplates.toString()})`, { TextEncoder })
  const isolated = factory(z)
  for (const id of ids) {
    const d = api.describe(id)
    assert.equal(d.inputSchema.additionalProperties, false)
    assert.equal(d.inputSchema.properties.business.additionalProperties, false)
    assert.ok(JSON.stringify(d).length < 40000)
    assert.equal(d.technicalStatus.office, 'NOT_RUN')
    assert.equal(isolated.validate(id, fixture(id)).status, 'VALID_INTAKE_DECLARATION')
    d.workers[0].presetId = 'attacker'; d.inputSchema.properties.classification = {}
    assert.notEqual(api.describe(id).workers[0].presetId, 'attacker')
  }
  const dcf = api.describe('finance-model-builder')
  assert.equal(dcf.sourceCheckpoints.filter(c => c.id.startsWith('dcf-model.')).length, 5)
  assert.deepEqual(dcf.sourceCheckpoints.slice(0, 2).map(c => c.id), ['model-built', 'model-audited-before-sensitivities'])
  assert.ok(dcf.sourceCheckpoints.every(c => c.requestedBy === 'Main or Host' && c.workers === 'Relay only'))
  assert.throws(() => api.describe('finance-pitch-agent'), error => error.code === 'BUSINESS_PRESET_UNKNOWN')
  assert.throws(() => api.describe('finance-statement-auditor'), error => error.code === 'BUSINESS_PRESET_UNKNOWN')
  assert.throws(() => api.describe('finance-valuation-reviewer'), error => error.code === 'BUSINESS_PRESET_UNKNOWN')
})

test('exact main IDs, worker ownership and source coordinates agree with unchanged manifest', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/runtime-manifest.json', import.meta.url), 'utf8'))
  assert.deepEqual(ids, manifest.roles.filter(r => r.kind === 'main').map(r => r.id))
  for (const id of ids) {
    const d = api.describe(id), main = manifest.roles.find(r => r.id === id)
    assert.deepEqual(d.workers.map(w => w.presetId), main.workerPresetIds)
    assert.deepEqual(d.allowedMcpServers, main.allowedMcpServers)
    assert.deepEqual(d.allowedMcpServers, [])
    assert.equal(d.workers.filter(w => w.writer).length, 1)
    for (const w of d.workers) {
      const role = manifest.roles.find(r => r.id === w.presetId)
      assert.equal(role.parentId, id); assert.equal(role.writer, w.writer)
      assert.equal(w.sourcePath, `assets/prompts/${role.id}.md`)
      if (w.writer) assert.deepEqual(role.allowedMcpServers, [])
    }
    for (const ref of [...d.sourceRefs, ...d.sourceCheckpoints.map(c => c.source)]) {
      const lines = (await readFile(new URL(`../${ref.path}`, import.meta.url), 'utf8')).split(/\r?\n/)
      assert.ok(ref.lineStart >= 1 && ref.lineEnd >= ref.lineStart && ref.lineEnd <= lines.length)
      assert.ok(lines.length > 0, ref.path)
    }
  }
})
