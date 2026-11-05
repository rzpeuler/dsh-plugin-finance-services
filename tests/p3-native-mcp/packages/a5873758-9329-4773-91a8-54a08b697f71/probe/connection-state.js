/** Probe-local evidence only; not a FinanceData Adapter or connection supervisor. */
export function createObservedConnectionState() {
  let state = { state: 'NOT_CONFIGURED', verifiedAt: new Date().toISOString(), code: 'MCP_NOT_CONFIGURED' };
  let ping = false, read = false;
  return {
    observe(kind, result) {
      if (!['ping', 'read'].includes(kind)) throw new Error('FIXED_NATIVE_OPERATION_REQUIRED');
      const verifiedAt = new Date().toISOString();
      if (result.isError) { ping = read = false; state = { state: 'UNAVAILABLE', verifiedAt, code: 'MCP_UNAVAILABLE' }; }
      else {
        if (kind === 'ping') ping = true;
        if (kind === 'read') read = true;
        state = ping && read ? { state: 'READY', verifiedAt } : { state: 'NOT_CONFIGURED', verifiedAt, code: 'MCP_NOT_CONFIGURED' };
      }
      return structuredClone(state);
    },
    getSnapshot() { return structuredClone(state); },
  };
}
