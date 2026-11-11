import { createHash } from 'node:crypto'

/** Snapshot identity; a policy change produces a new version only through a new snapshot. */
export const POLICY_VERSION = 'p5-policy-v1'

/**
 * Business boundaries that no policy may relax. These are not tool permissions and
 * never become grants; the list is fixed at module load and cannot be configured.
 */
export const LOCKED_BOUNDARIES = Object.freeze([
  { id: 'no_auto_publish', reason: 'Reports are never published automatically; a human decides distribution.' },
  { id: 'no_client_communication', reason: 'Client and investor communication stays outside the product.' },
  { id: 'no_formal_posting', reason: 'Journal entries remain drafts; the ledger is posted by the accounting system of record.' },
  { id: 'no_trade', reason: 'No order, trade or execution instruction is submitted.' },
  { id: 'no_fund_movement', reason: 'No cash, capital call or distribution movement is initiated.' },
  { id: 'no_final_kyc_rating', reason: 'A final KYC risk rating is a compliance decision, not an agent output.' },
  { id: 'no_compliance_signoff', reason: 'Compliance clearance and sign-off cannot be delegated to the product.' },
  { id: 'no_authority_substitution', reason: 'IR, CCO and Controller authority is never replaced by an approval record.' },
].map(Object.freeze))

/** External side effects stay disabled for every policy. Enabling them needs a separate authorized action surface. */
export const EXTERNAL_SIDE_EFFECTS = 'DISABLED'

const SOURCE = 'selected Agent and Skill scope; see docs/RUNTIME_SCOPE.md'
const checkpoint = (id, label, kind, options) => Object.freeze({
  id, label, kind,
  mandatory: options.mandatory ?? false,
  fastSkippable: options.fastSkippable ?? false,
  strictOnly: options.strictOnly ?? false,
  provenance: options.provenance ?? SOURCE,
})

/**
 * Checkpoint catalogue per main Agent. `fastSkippable` is limited to progress pauses whose
 * artifact already carries DRAFT/REVIEW_REQUIRED, so skipping never releases a quality or
 * authority gate. `strictOnly` entries exist only in the `strict` policy.
 */
export const CHECKPOINTS = Object.freeze({
  'finance-market-researcher': Object.freeze([
    checkpoint('comps_spread_complete', 'Comps spread complete', 'INTERMEDIATE', { mandatory: true,
      provenance: 'market-researcher persona: analyst confirms comps before the note' }),
    checkpoint('note_complete', 'Research note complete', 'FINAL', { fastSkippable: true }),
    checkpoint('assumptions_review', 'Key assumptions review', 'ASSUMPTION', { strictOnly: true }),
    checkpoint('result_review', 'Deliverable result review', 'RESULT', { strictOnly: true }),
  ]),
  'finance-model-builder': Object.freeze([
    checkpoint('model_build_complete', 'Model build complete', 'INTERMEDIATE', { mandatory: true,
      provenance: 'model-builder persona: stop after build, before audit' }),
    checkpoint('audit_before_sensitivities', 'Audit passed before sensitivities', 'INTERMEDIATE', { mandatory: true,
      provenance: 'model-builder persona: independent audit precedes sensitivity work' }),
    checkpoint('assumptions_review', 'Key assumptions review', 'ASSUMPTION', { strictOnly: true }),
    checkpoint('result_review', 'Deliverable result review', 'RESULT', { strictOnly: true }),
  ]),
  'finance-earnings-reviewer': Object.freeze([
    checkpoint('note_complete', 'Earnings note complete', 'FINAL', { fastSkippable: true }),
    checkpoint('assumptions_review', 'Key assumptions review', 'ASSUMPTION', { strictOnly: true }),
    checkpoint('result_review', 'Deliverable result review', 'RESULT', { strictOnly: true }),
  ]),
})

export const POLICY_IDS = Object.freeze(['original', 'fast', 'strict', 'custom'])
const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value)
const known = new Set(Object.keys(CHECKPOINTS))

const fail = (code, message) => { throw Object.assign(new Error(`${code}: ${message}`), { code }) }

/** Deep freeze without following prototypes supplied by callers. */
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) freeze(value[key])
    Object.freeze(value)
  }
  return value
}

/** Reject reserved keys that could smuggle a boundary change into a policy object. */
function assertNoBoundaryAttempts(level, where) {
  if (!isPlainObject(level)) fail('POLICY_INVALID', `${where} must be an object`)
  for (const key of Object.keys(level)) {
    if (key === 'policyId' || key === 'custom') continue
    fail('POLICY_LOCKED_BOUNDARY', `${where}.${key} is not a policy field; locked boundaries and external side effects cannot be configured`)
  }
}

function requirementsFor(agentId, policyId, customForAgent) {
  const list = CHECKPOINTS[agentId]
  const required = new Map()
  for (const item of list) {
    if (policyId === 'custom') {
      const want = customForAgent?.[item.id] === true
      if (item.mandatory || want) required.set(item.id, item.mandatory ? 'MANDATORY' : 'CUSTOM_ENABLED')
      continue
    }
    if (policyId === 'strict') { required.set(item.id, item.mandatory ? 'MANDATORY' : 'STRICT'); continue }
    if (item.strictOnly) continue
    if (policyId === 'fast' && item.fastSkippable) continue
    required.set(item.id, item.mandatory ? 'MANDATORY' : 'ORIGINAL')
  }
  return Object.fromEntries([...required.entries()])
}

function validateCustom(custom, agentIds) {
  if (!isPlainObject(custom)) fail('POLICY_INVALID', 'custom requires a per-agent map')
  for (const [agentId, toggles] of Object.entries(custom)) {
    if (!known.has(agentId)) fail('POLICY_UNKNOWN_AGENT', `unknown agent ${agentId}`)
    if (!isPlainObject(toggles)) fail('POLICY_INVALID', `custom.${agentId} must map checkpoint ids to booleans`)
    const catalogue = new Map(CHECKPOINTS[agentId].map(item => [item.id, item]))
    for (const [checkpointId, value] of Object.entries(toggles)) {
      const item = catalogue.get(checkpointId)
      if (!item) fail('POLICY_UNKNOWN_CHECKPOINT', `${agentId} has no checkpoint ${checkpointId}`)
      if (typeof value !== 'boolean') fail('POLICY_INVALID', `custom.${agentId}.${checkpointId} must be boolean`)
      if (value === false && item.mandatory) {
        fail('POLICY_MANDATORY_LOCKED', `${agentId}.${checkpointId} is mandatory and cannot be disabled`)
      }
    }
  }
}

/**
 * Resolve bundle default, Agent override and per-run override into an immutable snapshot.
 * Later levels win; every level is validated on its own so an invalid override fails loudly
 * instead of silently falling back.
 */
export function resolvePolicy({ bundle, agent, run, agentIds } = {}) {
  const activeAgentIds = agentIds === undefined ? Object.keys(CHECKPOINTS) : [...new Set(agentIds)]
  if (activeAgentIds.some(agentId => !known.has(agentId))) fail('POLICY_UNKNOWN_AGENT', 'active agent scope contains an unknown Agent')
  const levels = [['bundle', bundle ?? { policyId: 'original' }], ['agent', agent ?? null], ['run', run ?? null]]
  let policyId = 'original'
  let custom = null
  const applied = []
  for (const [name, level] of levels) {
    if (level === null) continue
    assertNoBoundaryAttempts(level, name)
    const id = level.policyId ?? (name === 'bundle' ? 'original' : policyId)
    if (!POLICY_IDS.includes(id)) fail('POLICY_UNKNOWN', `unknown policy ${String(id)}`)
    if (id === 'custom') {
      if (!level.custom) fail('POLICY_INVALID', `${name} selects custom without a per-agent map`)
      validateCustom(level.custom, Object.keys(CHECKPOINTS))
      custom = level.custom
    } else if (level.custom) {
      fail('POLICY_INVALID', `${name} supplies custom toggles but selects ${id}`)
    }
    policyId = id
    applied.push(name)
  }

  const requirements = {}
  for (const agentId of activeAgentIds) {
    requirements[agentId] = requirementsFor(agentId, policyId, custom?.[agentId])
  }
  const snapshot = {
    version: POLICY_VERSION,
    policyId,
    appliedLevels: applied,
    requirements,
    lockedBoundaries: LOCKED_BOUNDARIES.map(item => item.id),
    externalSideEffects: EXTERNAL_SIDE_EFFECTS,
  }
  const digestSource = JSON.stringify({ version: snapshot.version, policyId: snapshot.policyId, requirements })
  const digest = createHash('sha256').update(digestSource).digest('hex')
  return freeze({ ...snapshot, digest })
}

/** Required checkpoint ids for one Agent under a snapshot. */
export function requiredCheckpoints(snapshot, agentId) {
  if (!known.has(agentId)) fail('POLICY_UNKNOWN_AGENT', `unknown agent ${String(agentId)}`)
  const required = snapshot?.requirements?.[agentId]
  if (!required) fail('POLICY_SNAPSHOT_INVALID', 'snapshot lacks this agent')
  return Object.keys(required)
}

/** Explain one checkpoint decision for a reviewer, without implying approval. */
export function describeCheckpoint(agentId, checkpointId, snapshot) {
  const item = CHECKPOINTS[agentId]?.find(entry => entry.id === checkpointId)
  if (!item) fail('POLICY_UNKNOWN_CHECKPOINT', `${agentId} has no checkpoint ${checkpointId}`)
  const reason = snapshot?.requirements?.[agentId]?.[checkpointId]
  return freeze({
    agentId, checkpointId, label: item.label, kind: item.kind, provenance: item.provenance,
    required: !!reason, requirement: reason ?? 'NOT_REQUIRED_BY_POLICY',
    mandatory: item.mandatory, fastSkippable: item.fastSkippable, strictOnly: item.strictOnly,
  })
}
