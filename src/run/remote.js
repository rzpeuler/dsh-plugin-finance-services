/** Strict, browser-serializable read descriptors for Host-owned FinanceRuns. */
export function createFinanceRunsRemoteContract(z) {
  const owner = '@local/dsh-financial-services/run-api-v1'
  const JsonText = z.string().max(2000000)
    .refine(text => new TextEncoder().encode(text).byteLength <= 2000000, 'JSON exceeds UTF-8 limit')
    .refine(text => { try { JSON.parse(text); return true } catch { return false } }, 'Expected JSON')
  const schemas = {
    SnapshotRequest: z.strictObject({ sessionId: z.string().min(1).max(128) }),
    RecentRequest: z.strictObject({ limit: z.number().int().min(1).max(200).default(100) }),
    Snapshot: z.strictObject({ snapshotJson: JsonText }),
    Recent: z.strictObject({ runsJson: JsonText }),
  }
  const method = (name, input, output, description) => ({
    id: `${owner}#financeRuns/${name}`, service: 'financeRuns', namespace: 'financeRuns', method: name,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: `${owner}#${input}`, create: () => schemas[input] } }],
    result: { mode: 'strict', typeSymbol: `${owner}#${output}`, create: () => schemas[output] }, description,
  })
  const descriptors = [
    method('snapshot', 'SnapshotRequest', 'Snapshot', 'Read the persisted FinanceRun projection for one exact Session; empty results do not imply a submitted task.'),
    method('listRecent', 'RecentRequest', 'Recent', 'Read the bounded newest-first FinanceRun index across Sessions; content, credentials and tool arguments are excluded.'),
    {
      ...method('follow', 'SnapshotRequest', 'Snapshot', 'Stream the initial persisted FinanceRun snapshot and later changes for one Session until cancellation.'),
      mode: 'stream', cancellation: { parameter: 'signal' },
    },
    {
      ...method('followRecent', 'RecentRequest', 'Recent', 'Stream the initial bounded newest-first FinanceRun index and later durable changes until cancellation.'),
      mode: 'stream', cancellation: { parameter: 'signal' },
    },
  ]
  return { schemas, remote: { package: owner, descriptors } }
}
