/** Shared strict Host/Client definitions. Keep this factory self-contained for Client embedding. */
export function createFinanceContract(z) {
  const packageName = '@local/dsh-financial-services'
  const Revision = z.number().int().nonnegative()
  const ErrorInfo = z.strictObject({ code: z.string().min(1), message: z.string().min(1) })
  const Binding = z.strictObject({
    workspaceId: z.string().min(1), path: z.string().min(1), boundAt: z.string().datetime(),
  })
  const EmptyRequest = z.strictObject({})
  const BindRequest = z.strictObject({ path: z.string().min(1), expectedRevision: Revision })
  const UnbindRequest = z.strictObject({ expectedRevision: Revision })
  const Snapshot = z.strictObject({
    version: z.string(), stage: z.literal('P1'), revision: Revision,
    onboardingVersion: Revision, binding: Binding.nullable(),
    workspaceStatus: z.enum(['UNBOUND', 'READY', 'MISSING_DIRECTORY', 'REGISTRY_MISSING', 'PERMISSION_DENIED', 'PATH_DRIFT']),
    error: ErrorInfo.nullable(), limitations: z.array(z.string()),
  })
  const BindResult = z.strictObject({
    status: z.enum(['BOUND', 'UNBOUND', 'REJECTED']), snapshot: Snapshot, error: ErrorInfo.nullable(),
  })
  const StateRoot = z.strictObject({
    version: z.literal(1), revision: Revision, onboardingVersion: Revision, binding: Binding.nullable(),
  })
  const ToolRequest = z.discriminatedUnion('action', [
    z.strictObject({ action: z.literal('status') }),
    z.strictObject({ action: z.literal('bind'), path: z.string().min(1), expectedRevision: Revision }),
    z.strictObject({ action: z.literal('unbind'), expectedRevision: Revision }),
  ])
  const schemas = { EmptyRequest, BindRequest, UnbindRequest, Snapshot, BindResult, StateRoot, ToolRequest }
  const codec = name => ({ mode: 'strict', typeSymbol: `${packageName}#${name}`, create: () => schemas[name] })
  const descriptor = (method, input, output, description) => ({
    id: `${packageName}#financeOperations/${method}`,
    service: 'financeOperations', namespace: 'financeOperations', method,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: codec(input) }],
    result: codec(output), description,
  })
  const descriptors = [
    descriptor('snapshot', 'EmptyRequest', 'Snapshot', 'Read the persisted default workspace binding and check its current directory and registry status.'),
    descriptor('bindWorkspace', 'BindRequest', 'BindResult', 'Bind an existing absolute directory for new financial tasks only; reject stale revisions without replacing the previous binding.'),
    descriptor('unbindWorkspace', 'UnbindRequest', 'BindResult', 'Clear only the default binding for new tasks; retain Workspace registrations, directories and Session history.'),
    {
      ...descriptor('follow', 'EmptyRequest', 'Snapshot', 'Follow the initial snapshot and subsequent observed changes until cancellation or service disposal.'),
      mode: 'stream', cancellation: { parameter: 'signal' },
    },
  ]
  return { remote: { package: packageName, descriptors }, schemas }
}
