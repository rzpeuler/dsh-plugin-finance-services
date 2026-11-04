/** Hand-authored reflection of the Bundle's Remote surface; trusted preset admission helpers are not remotely callable. */
export function financeReflection() {
  const members = [
    { kind: 'method', name: 'snapshot', signature: 'snapshot(request: {}): Promise<Snapshot>', summary: 'Read the durable default binding and recheck the directory and native registry.' },
    { kind: 'method', name: 'bindWorkspace', signature: 'bindWorkspace(request: { path: string; expectedRevision: number }): Promise<BindResult>', summary: 'CAS-bind an existing fully qualified directory for new tasks only.' },
    { kind: 'method', name: 'unbindWorkspace', signature: 'unbindWorkspace(request: { expectedRevision: number }): Promise<BindResult>', summary: 'CAS-clear the default, retaining onboarding, Workspace registrations, files and Session history.' },
    { kind: 'method', name: 'catalog', signature: 'catalog(request: {}): Promise<Catalog>', summary: 'Read ten source-backed main roles, thirty internal Workers, sixty-three Skills and draft templates with native preset diagnostics.' },
    { kind: 'method', name: 'prepareDraft', signature: 'prepareDraft(request: PrepareDraftRequest): Promise<PreparedDraft>', summary: 'Validate a main role, template and bound Workspace; return an unsent draft intent without creating or executing a Session.' },
    { kind: 'method', name: 'follow', signature: 'follow(request: {}, signal: AbortSignal): AsyncIterable<Snapshot>', summary: 'Initial full snapshot and latest observed changes; cancellation/disposal closes the stream. No polling.' },
  ]
  const types = [
    { name: 'FinanceBinding', declaration: 'export interface FinanceBinding { workspaceId: string; path: string; boundAt: string }' },
    { name: 'FinanceError', declaration: 'export interface FinanceError { code: string; message: string }' },
    { name: 'Snapshot', declaration: "export interface Snapshot { version: string; stage: 'P1'; revision: number; onboardingVersion: number; binding: FinanceBinding | null; workspaceStatus: 'UNBOUND' | 'READY' | 'MISSING_DIRECTORY' | 'REGISTRY_MISSING' | 'PERMISSION_DENIED' | 'PATH_DRIFT'; error: FinanceError | null; limitations: string[] }" },
    { name: 'BindResult', declaration: "export interface BindResult { status: 'BOUND' | 'UNBOUND' | 'REJECTED'; snapshot: Snapshot; error: FinanceError | null }" },
    { name: 'PublicRole', declaration: "export interface PublicRole { id: string; kind: 'main' | 'worker'; slug: string; name: string; description: string; parentId: string | null; writer: boolean; shellRestricted: boolean; builtinTools: string[]; allowedMcpServers: string[]; workerPresetIds: string[]; skillNames: string[]; sourcePath: string; sourceSha256: string; adaptedPromptSha256: string; mountStatus: 'AVAILABLE' | 'UNAVAILABLE'; diagnostic: string | null }" },
    { name: 'Catalog', declaration: "export interface Catalog { stage: 'P2'; sourceTreeSha256: string; agents: PublicRole[]; workers: PublicRole[]; skills: { name: string; description: string; assetStatus: string; issues: string[] }[]; commands: { id: string; name: string; sourcePath: string; targetPresetIds: string[]; selectionRequired: boolean }[]; steering: { id: string; targetPresetId: string; title: string }[]; limitations: string[] }" },
    { name: 'PrepareDraftRequest', declaration: 'export interface PrepareDraftRequest { agentId: string; prompt?: string; commandId?: string; steeringId?: string }' },
    { name: 'PreparedDraft', declaration: "export interface PreparedDraft { status: 'DRAFT_READY' | 'REJECTED'; workspaceId: string | null; agentPreset: string | null; prompt: string; whenDraftExists: 'keep'; autoSubmit: false; error: FinanceError | null }" },
  ]
  return {
    services: [{ key: 'financeOperations', exportName: 'FinanceOperations', description: 'Workspace defaults, source-backed role catalogue and unsent draft preparation. Role-runtime admission helpers are trusted plugin-only, not Remote APIs. Commercial adapters, Office execution and deterministic Review Gate are not yet implemented.', tags: [], members, types }],
    events: [], objects: [],
  }
}
