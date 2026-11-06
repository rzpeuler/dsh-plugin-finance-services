const TERMINAL = new Set(['COMPLETED', 'FAILED', 'BLOCKED', 'PARTIAL', 'INTERRUPTED', 'ABORTED'])

function eventFact(sessionId, event, kind, details = {}) {
  return { sessionId, kind, seq: event.seq, time: event.time, phaseId: details.phaseId ?? null,
    attemptId: details.attemptId ?? null, code: details.code ?? null }
}

function matchingRun(runs, predicate) {
  for (let index = runs.length - 1; index >= 0; index -= 1) if (predicate(runs[index])) return runs[index]
  return null
}

function statusOf(reason) {
  if (reason === 'completed') return 'COMPLETED'
  if (reason === 'error') return 'FAILED'
  if (reason === 'blocked') return 'BLOCKED'
  if (reason === 'max-tokens') return 'PARTIAL'
  if (reason === 'aborted') return 'ABORTED'
  return 'INTERRUPTED'
}

function safeCode(value, fallback) {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : fallback
}

function findEvent(document, sessionId, seq) {
  return document.runs.some(run => run.timeline.some(fact => fact.sessionId === sessionId && fact.seq === seq))
}

/** Build an idempotent Run record from one admitted human Session message. */
export function createRun(document, { runId, sessionId, agentId, message }) {
  if (document.runs.some(run => run.sessionId === sessionId && run.sourceSeq === message.seq)) return document
  const run = {
    runId, sessionId, agentId, taskType: null, title: null, subject: null,
    sourceSeq: message.seq, messageId: message.data.id, createdAt: message.time,
    status: 'SUBMITTED', turnNumber: null, phases: [], attempts: [], outputs: [], diagnostics: [],
    timeline: [eventFact(sessionId, message, 'run/submitted')],
  }
  return { version: 1, revision: document.revision + 1, prunedRuns: document.prunedRuns, runs: [...document.runs, run] }
}

/** Append one durable Session lifecycle fact to its matching Run projection. */
export function applySessionEvent(document, sessionId, event) {
  if (event.type === 'user/message' || !document.runs.some(run => run.sessionId === sessionId)) return document
  if (findEvent(document, sessionId, event.seq)) return document
  const runs = document.runs.map(run => run.sessionId !== sessionId ? run : ({
    ...run, phases: run.phases.map(phase => ({ ...phase })), attempts: run.attempts.map(attempt => ({ ...attempt })),
    outputs: [...run.outputs], diagnostics: [...run.diagnostics], timeline: [...run.timeline],
  }))
  const scopedRuns = runs.filter(run => run.sessionId === sessionId)
  let run = null
  let phaseId = null
  let attemptId = null
  let code = null

  if (event.type === 'turn/start') {
    run = matchingRun(scopedRuns, item => item.status === 'SUBMITTED') ?? matchingRun(scopedRuns, item => item.status === 'RUNNING')
    if (!run) return document
    run.status = 'RUNNING'
    run.turnNumber = event.data.turn
    phaseId = `turn-${event.data.turn}`
    if (!run.phases.some(phase => phase.phaseId === phaseId)) {
      run.phases.push({ phaseId, kind: 'turn', name: `Turn ${event.data.turn}`, status: 'RUNNING', startedAt: event.time, endedAt: null, errorCode: null })
    }
  } else if (event.type === 'step/start' || event.type === 'step/end') {
    run = matchingRun(scopedRuns, item => item.turnNumber === event.data.turn && item.status === 'RUNNING')
    if (!run) return document
    phaseId = `step-${event.data.turn}-${event.data.step}`
    let phase = run.phases.find(item => item.phaseId === phaseId)
    if (!phase) {
      phase = { phaseId, kind: 'step', name: `Step ${event.data.step}`, status: 'RUNNING', startedAt: event.time, endedAt: null, errorCode: null }
      run.phases.push(phase)
    }
    if (event.type === 'step/end') { phase.status = 'ENDED'; phase.endedAt = event.time }
  } else if (event.type === 'tool/call') {
    run = matchingRun(scopedRuns, item => item.turnNumber === event.data.turn && item.status === 'RUNNING')
    if (!run) return document
    attemptId = `tool-${event.data.callId}`
    if (!run.attempts.some(attempt => attempt.attemptId === attemptId)) {
      run.attempts.push({ attemptId, kind: 'tool', name: event.data.name, targetSessionId: null, turn: event.data.turn, step: event.data.step,
        status: 'RUNNING', startedAt: event.time, endedAt: null, errorCode: null })
    }
  } else if (event.type === 'tool/result') {
    const callId = event.data.message?.toolCallId
    if (typeof callId !== 'string') return document
    run = matchingRun(scopedRuns, item => item.attempts.some(attempt => attempt.attemptId === `tool-${callId}`))
    if (!run) return document
    attemptId = `tool-${callId}`
    const attempt = run.attempts.find(item => item.attemptId === attemptId)
    attempt.status = event.data.message.isError ? 'FAILED' : 'COMPLETED'
    attempt.endedAt = event.time
    if (event.data.message.isError) {
      code = safeCode(event.data.error?.code, 'TOOL_ERROR')
      attempt.errorCode = code
      run.diagnostics.push({ code, eventSeq: event.seq, time: event.time, source: 'tool/result' })
    }
  } else if (event.type === 'assistant/message') {
    run = matchingRun(scopedRuns, item => item.turnNumber === event.data.turn && item.status === 'RUNNING')
    if (!run) return document
    if (!run.outputs.some(output => output.messageId === event.data.message.id)) {
      run.outputs.push({ messageId: event.data.message.id, seq: event.seq, time: event.time, turn: event.data.turn, step: event.data.step,
        interrupted: event.data.interrupted === true })
    }
    phaseId = `step-${event.data.turn}-${event.data.step}`
  } else if (event.type === 'assistant/attempt') {
    run = matchingRun(scopedRuns, item => item.turnNumber === event.data.turn && item.status === 'RUNNING')
    if (!run) return document
    attemptId = `model-${event.data.turn}-${event.data.step}-${event.seq}`
    run.attempts.push({ attemptId, kind: 'model', name: 'model', targetSessionId: null,
      turn: event.data.turn, step: event.data.step, status: 'NO_MESSAGE', startedAt: null, endedAt: event.time, errorCode: null })
  } else if (event.type === 'turn/end') {
    run = matchingRun(scopedRuns, item => item.turnNumber === event.data.turn && item.status === 'RUNNING')
    if (!run) return document
    const reason = event.data.reason?.kind
    run.status = statusOf(reason)
    phaseId = `turn-${event.data.turn}`
    const phase = run.phases.find(item => item.phaseId === phaseId)
    if (phase) {
      phase.status = run.status
      phase.endedAt = event.time
      if (reason === 'error') phase.errorCode = safeCode(event.data.reason?.error?.code, 'TURN_ERROR')
    }
    for (const stepPhase of run.phases) {
      if (stepPhase.kind === 'step' && stepPhase.status === 'RUNNING' && stepPhase.phaseId.startsWith(`step-${event.data.turn}-`)) {
        stepPhase.status = 'ENDED'
        stepPhase.endedAt = event.time
      }
    }
    for (const attempt of run.attempts) {
      if (attempt.kind !== 'tool' || attempt.turn !== event.data.turn || attempt.status !== 'RUNNING') continue
      attempt.status = 'NO_RESULT'
      attempt.endedAt = event.time
      run.diagnostics.push({ code: 'TOOL_RESULT_MISSING', eventSeq: event.seq, time: event.time, source: 'turn/end' })
    }
    if (run.status !== 'COMPLETED') {
      code = reason === 'error' ? safeCode(event.data.reason?.error?.code, 'TURN_ERROR') : `TURN_${String(reason ?? 'UNKNOWN').replaceAll('-', '_').toUpperCase()}`
      run.diagnostics.push({ code, eventSeq: event.seq, time: event.time, source: 'turn/end' })
    }
  } else {
    return document
  }

  run.timeline.push(eventFact(sessionId, event, event.type, { phaseId, attemptId, code }))
  return { version: 1, revision: document.revision + 1, prunedRuns: document.prunedRuns, runs }
}

/** Associate a child Session turn with the parent Run turn whose event interval contains it. */
export function applyWorkerEvent(document, { parentSessionId, childSessionId, agentId }, event) {
  if (event.type !== 'turn/start' && event.type !== 'turn/end') return document
  if (findEvent(document, childSessionId, event.seq)) return document
  const runs = document.runs.map(run => run.sessionId !== parentSessionId ? run : ({
    ...run, attempts: run.attempts.map(attempt => ({ ...attempt })), diagnostics: [...run.diagnostics], timeline: [...run.timeline],
  }))
  const scopedRuns = runs.filter(run => run.sessionId === parentSessionId)
  const attemptId = `worker-${childSessionId}-${event.data.turn}`
  if (event.type === 'turn/start') {
    const run = matchingRun(scopedRuns, item => item.phases.some(phase => phase.kind === 'turn' && phase.startedAt <= event.time && (phase.endedAt === null || event.time <= phase.endedAt)))
    if (!run) return document
    if (run.attempts.some(attempt => attempt.attemptId === attemptId)) return document
    run.attempts.push({ attemptId, kind: 'worker', name: agentId ?? 'Worker', targetSessionId: childSessionId,
      turn: run.turnNumber, step: null, status: 'RUNNING', startedAt: event.time, endedAt: null, errorCode: null })
    run.timeline.push(eventFact(childSessionId, event, 'worker/turn-start', { attemptId }))
  } else {
    const run = matchingRun(scopedRuns, item => item.attempts.some(attempt => attempt.attemptId === attemptId && attempt.status === 'RUNNING'))
    if (!run) return document
    const attempt = run.attempts.find(item => item.attemptId === attemptId)
    attempt.status = statusOf(event.data.reason?.kind)
    attempt.endedAt = event.time
    if (attempt.status !== 'COMPLETED') {
      attempt.errorCode = event.data.reason?.kind === 'error' ? safeCode(event.data.reason?.error?.code, 'WORKER_ERROR')
        : `WORKER_${String(event.data.reason?.kind ?? 'UNKNOWN').replaceAll('-', '_').toUpperCase()}`
      run.diagnostics.push({ code: attempt.errorCode, eventSeq: event.seq, time: event.time, source: 'worker/turn/end' })
    }
    run.timeline.push(eventFact(childSessionId, event, 'worker/turn-end', { attemptId, code: attempt.errorCode }))
  }
  return { version: 1, revision: document.revision + 1, prunedRuns: document.prunedRuns, runs }
}

/** Mark only persisted in-progress Runs as interrupted after service reactivation. */
export function interruptActiveRuns(document, time = Date.now()) {
  let changed = false
  const runs = document.runs.map(run => {
    if (run.status !== 'RUNNING') return run
    changed = true
    const phases = run.phases.map(phase => phase.status === 'RUNNING'
      ? { ...phase, status: 'INTERRUPTED', endedAt: time, errorCode: 'TRACKER_RESTARTED' } : phase)
    const attempts = run.attempts.map(attempt => attempt.status === 'RUNNING'
      ? { ...attempt, status: 'INTERRUPTED', endedAt: time, errorCode: 'TRACKER_RESTARTED' } : attempt)
    return { ...run, status: 'INTERRUPTED', phases, attempts,
      diagnostics: [...run.diagnostics, { code: 'TRACKER_RESTARTED', eventSeq: [...run.timeline].reverse().find(fact => fact.sessionId === run.sessionId)?.seq ?? run.sourceSeq, time, source: 'financeRuns/restart' }],
      timeline: [...run.timeline, { sessionId: run.sessionId, kind: 'run/interrupted', seq: [...run.timeline].reverse().find(fact => fact.sessionId === run.sessionId)?.seq ?? run.sourceSeq,
        time, phaseId: null, attemptId: null, code: 'TRACKER_RESTARTED' }] }
  })
  return changed ? { version: 1, revision: document.revision + 1, prunedRuns: document.prunedRuns, runs } : document
}

/** Return detached newest-first Run projections. */
export function recentRuns(document, limit = 100) {
  return document.runs.slice().sort((a, b) => b.createdAt - a.createdAt || b.sourceSeq - a.sourceSeq).slice(0, limit)
    .map(run => ({ ...run, phases: run.phases.map(phase => ({ ...phase })), attempts: run.attempts.map(attempt => ({ ...attempt })),
      outputs: run.outputs.map(output => ({ ...output })), diagnostics: run.diagnostics.map(diagnostic => ({ ...diagnostic })), timeline: run.timeline.map(fact => ({ ...fact })) }))
}

/** Return the immutable empty document used before the first Run is persisted. */
export function emptyRunDocument() { return { version: 1, revision: 0, prunedRuns: 0, runs: [] } }

/** Report whether a status has a terminal Session event. */
export function isTerminalRun(status) { return TERMINAL.has(status) }
