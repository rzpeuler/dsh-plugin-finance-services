/** TEST_ONLY strict descriptors shared by the disposable Host and Client halves. */
export function createP2ClientContract(z) {
  const packageName = '@local/dsh-financial-services-p2-client-test-only'
  const RunId = z.string().uuid()
  const JsonText = z.string().max(2_000_000)
    .refine(text => new TextEncoder().encode(text).byteLength <= 2_000_000, 'Serialized JSON exceeds 2,000,000 UTF-8 bytes')
    .refine(text => {
      try { JSON.parse(text); return true } catch { return false }
    }, 'Expected serialized JSON')
  const schemas = {
    BeginRequest: z.strictObject({ runId: RunId, allowNavigation: z.literal(true) }),
    BeginResult: z.strictObject({ runId: RunId, workspaceId: z.string(), path: z.string(), baselineJson: JsonText }),
    InspectRequest: z.strictObject({ runId: RunId, sessionId: z.string().min(1), agentPreset: z.string().regex(/^finance-[a-z0-9-]+$/) }),
    InspectResult: z.strictObject({ sessionId: z.string(), agentPreset: z.string(), cwd: z.string(), blank: z.literal(true), modelTurns: z.literal(0), eventTypes: z.array(z.string()) }),
    FinishRequest: z.strictObject({ runId: RunId, clientReportJson: JsonText }),
    FinishResult: z.strictObject({ reportPath: z.string(), restoredBinding: z.boolean(), removedOwnedRegistry: z.boolean() }),
    BaselineRequest: z.strictObject({}),
    BaselineResult: z.strictObject({ snapshotJson: JsonText }),
  }
  const descriptor = (method, input, output, description) => ({
    id: `${packageName}#financeP2ClientTestOnly/${method}`,
    service: 'financeP2ClientTestOnly', namespace: 'financeP2ClientTestOnly', method,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: {
      mode: 'strict', typeSymbol: `${packageName}#${input}`, create: () => schemas[input],
    } }],
    result: { mode: 'strict', typeSymbol: `${packageName}#${output}`, create: () => schemas[output] }, description,
  })
  const descriptors = [
    descriptor('baseline', 'BaselineRequest', 'BaselineResult', 'TEST_ONLY read the real Host finance snapshot without mutation.'),
    descriptor('begin', 'BeginRequest', 'BeginResult', 'TEST_ONLY allocate one uniquely owned directory and Workspace after the Client navigation safety gate; do not create a Session.'),
    descriptor('inspect', 'InspectRequest', 'InspectResult', 'TEST_ONLY inspect an owned native Session header and event types without activating or prompting it.'),
    descriptor('finish', 'FinishRequest', 'FinishResult', 'TEST_ONLY receive bounded JSON evidence, CAS-restore the old binding and unregister only the owned Workspace; retain files and Session history.'),
  ]
  return { remote: { package: packageName, descriptors }, schemas }
}
