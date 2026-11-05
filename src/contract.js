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
  const PublicRole = z.strictObject({
    id: z.string(), kind: z.enum(['main', 'worker']), slug: z.string(), name: z.string(), description: z.string(),
    parentId: z.string().nullable(), writer: z.boolean(), shellRestricted: z.boolean(),
    builtinTools: z.array(z.string()), allowedMcpServers: z.array(z.string()), workerPresetIds: z.array(z.string()), skillNames: z.array(z.string()),
    sourcePath: z.string(), sourceSha256: z.string(), adaptedPromptSha256: z.string(),
    mountStatus: z.enum(['AVAILABLE', 'UNAVAILABLE']), diagnostic: z.string().nullable(),
  })
  const TaskTemplate = z.strictObject({
    presetId: z.string().min(1).max(128), title: z.string().min(1).max(200),
    templateVersion: z.string().min(1).max(32), checkpoints: z.array(z.string().min(1).max(96)).max(16),
    sourceRefs: z.array(z.string().max(256)).max(16),
  })
  const TaskTemplates = z.strictObject({ templatesJson: z.string().max(200000) })
  const Catalog = z.strictObject({
    stage: z.literal('P2'), sourceTreeSha256: z.string(), agents: z.array(PublicRole).length(10), workers: z.array(PublicRole).length(30),
    skills: z.array(z.strictObject({ name: z.string(), description: z.string(), assetStatus: z.string(), issues: z.array(z.string()) })).length(63),
    commands: z.array(z.strictObject({ id: z.string(), name: z.string(), sourcePath: z.string(), targetPresetIds: z.array(z.string()), selectionRequired: z.boolean() })).length(41),
    steering: z.array(z.strictObject({ id: z.string(), targetPresetId: z.string(), title: z.string() })).length(29),
    limitations: z.array(z.string()),
  })
  const PrepareDraftRequest = z.strictObject({ agentId: z.string().regex(/^finance-[a-z0-9-]+$/), prompt: z.string().max(64000).optional(),
    commandId: z.string().optional(), steeringId: z.string().optional() }).refine(value => [value.prompt, value.commandId, value.steeringId].filter(item => item !== undefined).length <= 1,
    'Choose a free-form prompt, command or steering example, not several at once')
  const PreparedDraft = z.strictObject({ status: z.enum(['DRAFT_READY', 'REJECTED']), workspaceId: z.string().nullable(), agentPreset: z.string().nullable(),
    prompt: z.string(), whenDraftExists: z.literal('keep'), autoSubmit: z.literal(false), error: ErrorInfo.nullable() })
  const schemas = { EmptyRequest, BindRequest, UnbindRequest, Snapshot, BindResult, StateRoot, ToolRequest, Catalog, PrepareDraftRequest, PreparedDraft, TaskTemplates, TaskTemplate }
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
    descriptor('catalog', 'EmptyRequest', 'Catalog', 'Read the installed main roles, internal Workers, scoped Skills and draft templates with native preset diagnostics.'),
    descriptor('taskTemplates', 'EmptyRequest', 'TaskTemplates', 'Read the ten declared task-intake templates with their version and required checkpoints. It reports declarations, not authorization, files or a started run.'),
    descriptor('prepareDraft', 'PrepareDraftRequest', 'PreparedDraft', 'Validate a main role, template and bound Workspace; return an unsent draft intent without creating a Session or executing it.'),
    {
      ...descriptor('follow', 'EmptyRequest', 'Snapshot', 'Follow the initial snapshot and subsequent observed changes until cancellation or service disposal.'),
      mode: 'stream', cancellation: { parameter: 'signal' },
    },
  ]
  return { remote: { package: packageName, descriptors }, schemas }
}
