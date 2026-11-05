import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHECKPOINTS, EXTERNAL_SIDE_EFFECTS, LOCKED_BOUNDARIES, POLICY_VERSION,
  describeCheckpoint, requiredCheckpoints, resolvePolicy,
} from '../src/review/policy.js'

const PITCH = 'finance-pitch-agent'
const BUILDER = 'finance-model-builder'

test('the catalogue covers exactly the ten main Agents and never invents a worker checkpoint', () => {
  assert.equal(Object.keys(CHECKPOINTS).length, 10)
  for (const [agentId, list] of Object.entries(CHECKPOINTS)) {
    assert.match(agentId, /^finance-/)
    assert.ok(list.length >= 2, `${agentId} needs at least one original checkpoint`)
    assert.equal(new Set(list.map(item => item.id)).size, list.length)
  }
})

test('original keeps the source-mandated intermediate and final reviews', () => {
  const snapshot = resolvePolicy({})
  assert.equal(snapshot.policyId, 'original')
  assert.deepEqual(requiredCheckpoints(snapshot, PITCH).sort(), ['deck_complete', 'valuation_complete'])
  assert.deepEqual(requiredCheckpoints(snapshot, BUILDER).sort(), ['audit_before_sensitivities', 'model_build_complete'])
})

test('fast skips only the declared progress pause and keeps mandatory gates', () => {
  const snapshot = resolvePolicy({ bundle: { policyId: 'fast' } })
  assert.deepEqual(requiredCheckpoints(snapshot, PITCH), ['valuation_complete'])
  assert.deepEqual(requiredCheckpoints(snapshot, BUILDER).sort(), ['audit_before_sensitivities', 'model_build_complete'],
    'model build and audit are not relaxable')
  assert.equal(snapshot.requirements[PITCH].deck_complete, undefined)
})

test('strict adds assumption and result reviews on top of the original nodes', () => {
  const original = resolvePolicy({})
  const strict = resolvePolicy({ bundle: { policyId: 'strict' } })
  const before = requiredCheckpoints(original, PITCH).sort()
  const after = requiredCheckpoints(strict, PITCH).sort()
  assert.deepEqual(after, [...before, 'assumptions_review', 'result_review'].sort())
  assert.equal(strict.requirements[PITCH].assumptions_review, 'STRICT')
})

test('custom selects per checkpoint but cannot disable a mandatory one', () => {
  const snapshot = resolvePolicy({ bundle: { policyId: 'custom', custom: {
    [PITCH]: { deck_complete: true, result_review: true },
  } } })
  assert.deepEqual(requiredCheckpoints(snapshot, PITCH).sort(), ['deck_complete', 'result_review', 'valuation_complete'])
  assert.equal(snapshot.requirements[PITCH].valuation_complete, 'MANDATORY')
  assert.throws(() => resolvePolicy({ bundle: { policyId: 'custom', custom: {
    [PITCH]: { valuation_complete: false },
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
  assert.deepEqual(requiredCheckpoints(snapshot, PITCH).sort(), ['deck_complete', 'valuation_complete'])
})

test('an invalid level fails loudly instead of silently falling back', () => {
  assert.throws(() => resolvePolicy({ bundle: { policyId: 'nope' } }), error => error.code === 'POLICY_UNKNOWN')
  assert.throws(() => resolvePolicy({ bundle: { policyId: 'custom' } }), error => error.code === 'POLICY_INVALID')
  assert.throws(() => resolvePolicy({ bundle: { policyId: 'fast', custom: {} } }), error => error.code === 'POLICY_INVALID')
  assert.throws(() => resolvePolicy({ agent: { policyId: 'custom', custom: { 'finance-unknown': {} } } }),
    error => error.code === 'POLICY_UNKNOWN_AGENT')
  assert.throws(() => resolvePolicy({ agent: { policyId: 'custom', custom: { [PITCH]: { nope: true } } } }),
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
  assert.throws(() => { snapshot.requirements[PITCH].deck_complete = 'ORIGINAL' }, TypeError)
  const same = resolvePolicy({ bundle: { policyId: 'fast' } })
  const other = resolvePolicy({ bundle: { policyId: 'strict' } })
  assert.equal(snapshot.digest, same.digest)
  assert.notEqual(snapshot.digest, other.digest)
  assert.match(snapshot.digest, /^[a-f0-9]{64}$/)
})

test('checkpoint descriptions explain why a gate exists without implying approval', () => {
  const snapshot = resolvePolicy({})
  const deck = describeCheckpoint(PITCH, 'deck_complete', snapshot)
  assert.equal(deck.required, true)
  assert.equal(deck.requirement, 'ORIGINAL')
  assert.equal(deck.kind, 'FINAL')
  assert.match(deck.provenance, /persona|skills|P4/)
  const strictOnly = describeCheckpoint(PITCH, 'result_review', snapshot)
  assert.equal(strictOnly.required, false)
  assert.equal(strictOnly.requirement, 'NOT_REQUIRED_BY_POLICY')
  assert.throws(() => describeCheckpoint(PITCH, 'unknown', snapshot), error => error.code === 'POLICY_UNKNOWN_CHECKPOINT')
})
