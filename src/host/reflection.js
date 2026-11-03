/** Accurate hand-authored reflection of this Bundle's public P1 Service, not runtime readings. */
export function financeReflection() {
  const members = [
    { kind: 'method', name: 'snapshot', signature: 'snapshot(request: {}): Promise<Snapshot>', summary: 'Read the durable default binding and recheck the directory and native registry.' },
    { kind: 'method', name: 'bindWorkspace', signature: 'bindWorkspace(request: { path: string; expectedRevision: number }): Promise<BindResult>', summary: 'CAS-bind an existing fully qualified directory for new tasks only.' },
    { kind: 'method', name: 'unbindWorkspace', signature: 'unbindWorkspace(request: { expectedRevision: number }): Promise<BindResult>', summary: 'CAS-clear the default, retaining onboarding, Workspace registrations, files and Session history.' },
    { kind: 'method', name: 'follow', signature: 'follow(request: {}, signal: AbortSignal): AsyncIterable<Snapshot>', summary: 'Initial full snapshot and latest observed changes; cancellation/disposal closes the stream. No polling.' },
  ]
  const types = [
    { name: 'FinanceBinding', declaration: 'export interface FinanceBinding { workspaceId: string; path: string; boundAt: string }' },
    { name: 'FinanceError', declaration: 'export interface FinanceError { code: string; message: string }' },
    { name: 'Snapshot', declaration: "export interface Snapshot { version: string; stage: 'P1'; revision: number; onboardingVersion: number; binding: FinanceBinding | null; workspaceStatus: 'UNBOUND' | 'READY' | 'MISSING_DIRECTORY' | 'REGISTRY_MISSING' | 'PERMISSION_DENIED' | 'PATH_DRIFT'; error: FinanceError | null; limitations: string[] }" },
    { name: 'BindResult', declaration: "export interface BindResult { status: 'BOUND' | 'UNBOUND' | 'REJECTED'; snapshot: Snapshot; error: FinanceError | null }" },
  ]
  return {
    services: [{ key: 'financeOperations', exportName: 'FinanceOperations', description: 'P1 workspace defaults only. Existing Sessions and artifacts are not moved; financial execution is not implemented.', tags: [], members, types }],
    events: [], objects: [],
  }
}
