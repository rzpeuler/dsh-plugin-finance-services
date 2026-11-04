import { z } from 'zod'
import { posix, win32 } from 'node:path'

export const RoleId = z.string().regex(/^finance-[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160)
const unique = values => new Set(values).size === values.length
const definition = z.object({
  id: RoleId,
  kind: z.enum(['main', 'worker']),
  builtinTools: z.array(z.enum(['read', 'grep', 'glob', 'write', 'edit', 'bash'])).refine(unique),
  allowedMcpServers: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)).refine(unique),
  writer: z.boolean(),
  skillNames: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100)).refine(unique),
  skillRoots: z.array(z.string().min(1)).refine(roots => roots.every(p => win32.isAbsolute(p) || posix.isAbsolute(p))),
  workerPresetIds: z.array(RoleId).refine(unique),
}).passthrough()

/** Validate trusted disk-derived role data before registering any capability. */
export function validateRole(value, roleId) {
  const role = definition.parse(value)
  if (role.id !== roleId) throw new Error('ROLE_MISMATCH: Config roleId differs from the trusted role definition')
  if (role.kind === 'main' && (role.writer || role.builtinTools.some(t => ['write', 'edit', 'bash'].includes(t)) || role.workerPresetIds.length !== 3)) throw new Error('ROLE_INVALID: main roles must be readonly and own exactly three workers')
  if (role.kind === 'worker' && role.workerPresetIds.length) throw new Error('ROLE_INVALID: workers cannot delegate')
  if (role.writer && role.allowedMcpServers.length) throw new Error('ROLE_INVALID: writers cannot access MCP')
  if (!role.writer && role.builtinTools.some(t => ['write', 'edit'].includes(t))) throw new Error('ROLE_INVALID: source write/edit requires an explicit writer')
  for (const key of ['builtinTools', 'allowedMcpServers', 'skillNames', 'skillRoots', 'workerPresetIds']) Object.freeze(role[key])
  return Object.freeze(role)
}

/** Monotonic actual-dispatch guard, bound to one exact Agent (never a process-wide role mask). */
export function roleGuard({ agent, role, filesystem, ownTools, nativeTools, currentDefinition }) {
  return execution => {
    if (execution.agent !== agent) return undefined
    try { filesystem.check() } catch (error) { return error.message }
    const name = execution.name
    if (ownTools.has(name)) return currentDefinition(name) === ownTools.get(name) ? undefined : 'ROLE_TOOL_DENIED: role tool identity changed'
    if (nativeTools.has(name)) {
      if (currentDefinition(name) !== nativeTools.get(name)) return 'ROLE_TOOL_DENIED: native tool identity changed'
      if (name === 'skill' && (typeof execution.arguments?.name !== 'string' || !role.skillNames.includes(execution.arguments.name))) return 'SKILL_DENIED: skill is outside this role\'s assigned catalog'
      return undefined
    }
    if (name !== 'subagent' || role.kind !== 'main') return 'ROLE_TOOL_DENIED: tool is not granted to this finance role'
    const headerDepth = agent.session.header.delegationDepth ?? 0
    const runtimeDepth = agent.options?.subagentDepth ?? 0
    if (![headerDepth, runtimeDepth].every(n => Number.isSafeInteger(n) && n >= 0) || Math.max(headerDepth, runtimeDepth) >= 1 || agent.session.header.parentSession !== undefined) return 'DELEGATION_DEPTH_DENIED: finance delegation has an absolute depth limit of one'
    const args = execution.arguments
    if (!args || typeof args !== 'object' || Array.isArray(args) || !role.workerPresetIds.includes(args.agent_preset)) return 'DELEGATION_PRESET_DENIED: explicitly select one of this main role\'s three worker presets'
    if (args.cwd !== undefined && args.cwd !== filesystem.root) return 'DELEGATION_CWD_DENIED: omit cwd or use the exact current Workspace root'
    return undefined
  }
}
