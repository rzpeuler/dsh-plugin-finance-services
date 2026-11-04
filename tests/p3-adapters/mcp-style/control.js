/** TEST_ONLY, process-local Host controls. No Remote decorators, tools or model exposure. */
const STATES = new Set(['READY', 'NOT_CONFIGURED', 'NOT_AUTHORIZED', 'UNAVAILABLE', 'ERROR'])
const STATE_CODES = new Set(['FIXTURE_NOT_CONFIGURED', 'FIXTURE_NOT_AUTHORIZED', 'FIXTURE_UNAVAILABLE', 'FIXTURE_ERROR'])
const FAILURE_CODES = new Set(['FIXTURE_QUERY_FAILED', 'FIXTURE_UNAVAILABLE'])
export const fault = code => Object.assign(new Error(`TEST_ONLY adapter: ${code}`), { code })
export function createControl(initialState = 'READY') {
  if (!STATES.has(initialState)) throw fault('INVALID_TEST_STATE')
  let snapshot = { state: initialState, verifiedAt: new Date().toISOString() }
  let closed = false
  let nextFailure
  let observerFailures = 0
  const listeners = new Set()
  const ensureOpen = () => { if (closed) throw fault('ADAPTER_DISPOSED') }
  const getSnapshot = () => ({ ...snapshot })
  const changed = () => {
    ensureOpen()
    snapshot = { ...snapshot, verifiedAt: new Date().toISOString() }
    let notified = 0
    for (const listener of [...listeners]) {
      try { listener(); notified++ } catch { observerFailures++ }
    }
    // Failures are contained, counted and visible; never retain arbitrary error/secret text.
    return { notified, observerFailures }
  }
  const state = {
    getSnapshot,
    subscribe(listener) {
      ensureOpen()
      if (typeof listener !== 'function') throw fault('INVALID_TEST_LISTENER')
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const control = Object.freeze({
    getSnapshot,
    setState(value, code) {
      ensureOpen()
      if (!STATES.has(value) || (code !== undefined && !STATE_CODES.has(code))) throw fault('INVALID_TEST_STATE')
      snapshot = { state: value, verifiedAt: new Date().toISOString(), ...(code === undefined ? {} : { code }) }
      return changed()
    },
    failNextQuery(code = 'FIXTURE_QUERY_FAILED') {
      ensureOpen()
      if (!FAILURE_CODES.has(code)) throw fault('INVALID_TEST_FAILURE')
      nextFailure = code
      return { armed: true }
    },
    changed,
    diagnostics: () => ({ closed, listenerCount: listeners.size, observerFailures, failureArmed: nextFailure !== undefined }),
  })
  return {
    state, control,
    beforeQuery(signal, consumeFailure = true) {
      ensureOpen()
      signal?.throwIfAborted()
      if (snapshot.state !== 'READY') throw fault(snapshot.state)
      if (consumeFailure && nextFailure) { const code = nextFailure; nextFailure = undefined; throw fault(code) }
    },
    dispose() { if (closed) return; closed = true; nextFailure = undefined; listeners.clear() },
  }
}
