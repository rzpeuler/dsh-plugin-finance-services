import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHECKPOINTS, EXTERNAL_SIDE_EFFECTS, LOCKED_BOUNDARIES, POLICY_VERSION,
  describeCheckpoint, requiredCheckpoints, resolvePolicy,
} from '../src/review/policy.js'

const MARKET = 'finance-market-researcher'
const BUILDER = 'finance-model-builder'

test('the active checkpoint catalogue covers exactly the three retained main Agents', () => {
  assert.equal(Object.keys(CHECKPOINTS).length, 3)
  for (const [agentId, list] of Object.entries(CHECKPOINTS)) {
    assert.match(agentId, /^finance-/)
    assert.ok(list.length >= 2, `${agentId} needs at least one original checkpoint`)
    assert.equal(new Set(list.map(item => item.id)).size, list.length)
  }
})

test('Host runtime can scope the public policy matrix to only the retained main Agents', () => {
  const snapshot = resolvePolicy({ agentIds: ['finance-earnings-reviewer', 'finance-market-researcher', 'finance-model-builder'] })
  assert.deepEqual(Object.keys(snapshot.requirements).sort(), ['finance-earnings-reviewer', 'finance-market-researcher', 'finance-model-builder'])
})

test('original keeps the source-mandated intermediate and final reviews', () => {
  const snapshot = resolvePolicy({})
  assert.equal(snapshot.policyId, 'original')
  assert.deepEqual(requiredCheckpoints(snapshot, MARKET).sort(), ['comps_spread_complete', 'note_complete'])
  assert.deepEqual(requiredCheckpoints(snapshot, BUILDER).sort(), ['audit_before_sensitivities', 'model_build_complete'])
})

test('fast skips only the declared progress pause and keeps mandatory gates', () => {
  const snapshot = resolvePolicy({ bundle: { policyId: 'fast' } })
  assert.deepEqual(requiredCheckpoints(snapshot, MARKET), ['comps_spread_complete'])
  assert.deepEqual(requiredCheckpoints(snapshot, BUILDER).sort(), ['audit_before_sensitivities', 'model_build_complete'],
    'model build and audit are not relaxable')
  assert.equal(snapshot.requirements[MARKET].note_complete, undefined)
})

test('strict adds assumption and result reviews on top of the original nodes', () => {
  const original = resolvePolicy({})
  const strict = resolvePolicy({ bundle: { policyId: 'strict' } })
  const before = requiredCheckpoints(original, MARKET).sort()
  const after = requiredCheckpoints(strict, MARKET).sort()
  assert.deepEqual(after, [...before, 'assumptions_review', 'result_review'].sort())
  assert.equal(strict.requirements[MARKET].assumptions_review, 'STRICT')
})

test('custom selects per checkpoint but cannot disable a mandatory one', () => {
  const snapshot = resolvePolicy({ bundle: { policyId: 'custom', custom: {
    [MARKET]: { note_complete: true, result_review: true },
  } } })
  assert.deepEqual(requiredCheckpoints(snapshot, MARKET).sort(), ['comps_spread_complete', 'note_complete', 'result_review'])
  assert.equal(snapshot.requirements[MARKET].comps_spread_complete, 'MANDATORY')
  assert.throws(() => resolvePolicy({ bundle: { policyId: 'custom', custom: {
    [MARKET]: { comps_spread_complete: false },
  } } }), error => error.code === 'POLICY_MANDATORY_LOCKED')
})

test('scope resolves bundle then Agent then run, and records which levels applied', () => {
  const snapshot = resolvePolicy({
    bundle: { policyId: 'fast' },
    agent: { policyId: 'strict' },
    run: { policyId: 'original' },
  })
  assert.equal(snapshot.policyId, 'original')
  assert.deepEqual(snapshot.appliedLevels, ['bundle', 'agent', 'run'])
  assert.deepEqual(requiredCheckpoints(snapshot, MARKET).sort(), ['comps_spread_complete', 'note_complete'])
})

test('an invalid level fails loudly instead of silently falling back', () => {
  assert.throws(() => resolvePolicy({ bundle: { policyId: 'nope' } }), error => error.code === 'POLICY_UNKNOWN')
  assert.throws(() => resolvePolicy({ bundle: { policyId: 'custom' } }), error => error.code === 'POLICY_INVALID')
  assert.throws(() => resolvePolicy({ bundle: { policyId: 'fast', custom: {} } }), error => error.code === 'POLICY_INVALID')
  assert.throws(() => resolvePolicy({ agent: { policyId: 'custom', custom: { 'finance-unknown': {} } } }),
    error => error.code === 'POLICY_UNKNOWN_AGENT')
  assert.throws(() => resolvePolicy({ agent: { policyId: 'custom', custom: { [MARKET]: { nope: true } } } }),
    error => error.code === 'POLICY_UNKNOWN_CHECKPOINT')
})

test('locked boundaries and external side effects reject any configuration attempt', () => {
  assert.equal(LOCKED_BOUNDARIES.length, 8)
  for (const boundary of LOCKED_BOUNDARIES) assert.ok(boundary.reason.length > 10)
  for (const level of [{ policyId: 'fast', externalSideEffects: 'ENABLED' },
                       { policyId: 'original', allowPublish: true },
                       { policyId: 'custom', custom: {}, no_client_communication: false }]) {
    assert.throws(() => resolvePolicy({ bundle: level }), error => error.code === 'POLICY_LOCKED_BOUNDARY')
  }
  for (const id of ['original', 'fast', 'strict']) {
    const snapshot = resolvePolicy({ bundle: { policyId: id } })
    assert.equal(snapshot.externalSideEffects, EXTERNAL_SIDE_EFFECTS)
    assert.equal(snapshot.lockedBoundaries.length, 8)
  }
})

test('the snapshot is frozen and its digest identifies the requirement set', () => {
  const snapshot = resolvePolicy({ bundle: { policyId: 'fast' } })
  assert.ok(Object.isFrozen(snapshot))
  assert.ok(Object.isFrozen(snapshot.requirements))
  assert.equal(snapshot.version, POLICY_VERSION)
  assert.throws(() => { snapshot.requirements[MARKET].comps_spread_complete = 'ORIGINAL' }, TypeError)
  const same = resolvePolicy({ bundle: { policyId: 'fast' } })
  const other = resolvePolicy({ bundle: { policyId: 'strict' } })
  assert.equal(snapshot.digest, same.digest)
  assert.notEqual(snapshot.digest, other.digest)
  assert.match(snapshot.digest, /^[a-f0-9]{64}$/)
})

test('checkpoint descriptions explain why a gate exists without implying approval', () => {
  const snapshot = resolvePolicy({})
  const spread = describeCheckpoint(MARKET, 'comps_spread_complete', snapshot)
  assert.equal(spread.required, true)
  assert.equal(spread.requirement, 'MANDATORY')
  assert.equal(spread.kind, 'INTERMEDIATE')
  assert.match(spread.provenance, /persona|skills|P4/)
  const strictOnly = describeCheckpoint(MARKET, 'result_review', snapshot)
  assert.equal(strictOnly.required, false)
  assert.equal(strictOnly.requirement, 'NOT_REQUIRED_BY_POLICY')
  assert.throws(() => describeCheckpoint(MARKET, 'unknown', snapshot), error => error.code === 'POLICY_UNKNOWN_CHECKPOINT')
})
