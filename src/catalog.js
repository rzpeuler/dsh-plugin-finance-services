/** Validated packaged role assets and read-only draft preparation; never starts an Agent. */
import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { z } from 'zod'

const assetPath = z.string().min(1).refine(value => !isAbsolute(value) && !value.includes('\\') && !value.includes(':') && !value.split('/').some(part => part === '..' || part === ''), 'Expected a package-relative asset path')
const presetId = z.string().regex(/^finance-[a-z0-9]+(?:-[a-z0-9]+)*$/)
const sha256 = z.string().regex(/^[a-f0-9]{64}$/)
const roleSchema = z.object({
  id: presetId, kind: z.enum(['main', 'worker']), slug: z.string().min(1), name: z.string().min(1), description: z.string(),
  parentId: presetId.nullable(), builtinTools: z.array(z.enum(['read', 'grep', 'glob', 'write', 'edit', 'bash'])),
  allowedMcpServers: z.array(z.string().min(1)), writer: z.boolean(), shellRestricted: z.boolean(),
  workerPresetIds: z.array(presetId), skillNames: z.array(z.string().min(1)),
  source: z.object({ path: z.string().min(1), sha256 }).passthrough(),
  prompt: z.object({ originalPath: z.string().min(1), originalSha256: sha256, adaptedPath: assetPath, adaptedSha256: sha256 }).passthrough(),
  skillRoot: assetPath,
}).passthrough()
const manifestSchema = z.object({
  schemaVersion: z.literal(1), sourceTreeSha256: sha256, roles: z.array(roleSchema).length(40),
  skills: z.array(z.object({ name: z.string().min(1), description: z.string(), directory: assetPath,
    origins: z.array(z.unknown()), assetStatus: z.string(), issues: z.array(z.unknown()).default([]) }).passthrough()).length(63),
  commands: z.array(z.object({ id: z.string().min(1), name: z.string(), source: z.object({ path: z.string(), sha256 }).passthrough(),
    targetPresetId: presetId.nullable(), targetPresetIds: z.array(presetId).optional(), targetPresetChoices: z.array(presetId).optional(),
    selectionRequired: z.boolean(), promptPath: assetPath }).passthrough()).length(41),
  steering: z.array(z.object({ id: z.string().min(1), targetPresetId: presetId, title: z.string(), prompt: z.string(),
    source: z.object({ path: z.string(), sha256 }).passthrough() }).passthrough()).length(29),
}).passthrough()

/** Owns one immutable package manifest and verifies all authority-bearing references at startup. */
export class FinanceCatalog {
  constructor({ assetsRoot, presets, binding }) {
    this.assetsRoot = resolve(assetsRoot)
    this.presets = presets
    this.binding = binding
  }

  async initialize() {
    const manifest = manifestSchema.parse(JSON.parse(await readFile(resolve(this.assetsRoot, 'agent-manifest.json'), 'utf8')))
    const roles = new Map(manifest.roles.map(role => [role.id, role]))
    const skillNames = new Set(manifest.skills.map(skill => skill.name))
    if (roles.size !== 40 || skillNames.size !== 63) throw new Error('Financial manifest contains duplicate identities')
    const mains = manifest.roles.filter(role => role.kind === 'main')
    const workers = manifest.roles.filter(role => role.kind === 'worker')
    if (mains.length !== 10 || workers.length !== 30 || workers.filter(role => role.writer).length !== 10) throw new Error('Financial role counts differ from the audited source')
    for (const role of roles.values()) {
      if (role.skillNames.some(name => !skillNames.has(name))) throw new Error(`Unknown skill in ${role.id}`)
      if (role.writer !== role.builtinTools.includes('write')) throw new Error(`Writer flag disagrees with source permissions: ${role.id}`)
      if (role.shellRestricted !== role.builtinTools.includes('bash')) throw new Error(`Shell adaptation differs from source: ${role.id}`)
      if (role.kind === 'main') {
        if (role.parentId !== null || role.writer || role.builtinTools.some(name => ['write', 'edit', 'bash'].includes(name)) || role.workerPresetIds.length !== 3) throw new Error(`Invalid main role permissions: ${role.id}`)
        for (const child of role.workerPresetIds) if (roles.get(child)?.parentId !== role.id || roles.get(child)?.kind !== 'worker') throw new Error(`Invalid worker ownership: ${child}`)
      } else {
        if (roles.get(role.parentId)?.kind !== 'main' || role.workerPresetIds.length !== 0 || !roles.get(role.parentId).workerPresetIds.includes(role.id)) throw new Error(`Invalid worker parent: ${role.id}`)
        if (role.writer && role.allowedMcpServers.length !== 0) throw new Error(`Writer has source access: ${role.id}`)
      }
      const prompt = await readFile(this.resolveAsset(role.prompt.adaptedPath))
      if (createHash('sha256').update(prompt).digest('hex') !== role.prompt.adaptedSha256) throw new Error(`Adapted prompt hash mismatch: ${role.id}`)
      if (!(await stat(this.resolveAsset(role.skillRoot))).isDirectory()) throw new Error(`Missing role skill root: ${role.id}`)
    }
    if (new Set(mains.flatMap(role => role.skillNames)).size !== 63) throw new Error('Main role discovery does not cover all financial skills')
    for (const command of manifest.commands) {
      const targets = command.targetPresetIds ?? command.targetPresetChoices ?? (command.targetPresetId === null ? [] : [command.targetPresetId])
      if (targets.length === 0 || targets.some(id => roles.get(id)?.kind !== 'main')) throw new Error(`Invalid command role choices: ${command.id}`)
      if (command.selectionRequired !== (targets.length > 1)) throw new Error(`Ambiguous command was implicitly assigned: ${command.id}`)
      await stat(this.resolveAsset(command.promptPath))
    }
    this.manifest = manifest
    this.roles = roles
  }

  resolveAsset(path) {
    assetPath.parse(path)
    const absolute = resolve(this.assetsRoot, path)
    const suffix = relative(this.assetsRoot, absolute)
    if (suffix === '..' || suffix.startsWith('..' + sep) || isAbsolute(suffix)) throw new Error('Asset path escapes the installed package')
    return absolute
  }

  role(roleId) {
    if (!this.roles) throw new Error('Financial catalogue is not active')
    const role = this.roles.get(roleId)
    if (!role) throw new Error(`Unknown financial role: ${roleId}`)
    return structuredClone({ ...role, skillRoots: [this.resolveAsset(role.skillRoot)] })
  }

  skillRoot(roleId) {
    return this.resolveAsset(this.role(roleId).skillRoot)
  }

  async viewRole(role) {
    let mountStatus = 'UNAVAILABLE'
    let diagnostic = 'The native preset registry is unavailable.'
    const presets = this.presets()
    if (presets) {
      try {
        const preset = await presets.resolve(role.id)
        diagnostic = preset.broken ?? null
        mountStatus = diagnostic === null ? 'AVAILABLE' : 'UNAVAILABLE'
      } catch (error) { diagnostic = String(error.message ?? error) }
    }
    return { id: role.id, kind: role.kind, slug: role.slug, name: role.name, description: role.description,
      parentId: role.parentId, writer: role.writer, shellRestricted: role.shellRestricted,
      builtinTools: role.builtinTools, allowedMcpServers: role.allowedMcpServers,
      workerPresetIds: role.workerPresetIds, skillNames: role.skillNames,
      sourcePath: role.source.path, sourceSha256: role.source.sha256,
      adaptedPromptSha256: role.prompt.adaptedSha256, mountStatus, diagnostic }
  }

  async catalog() {
    if (!this.manifest) throw new Error('Financial catalogue is not active')
    const roles = await Promise.all(this.manifest.roles.map(role => this.viewRole(role)))
    return { stage: 'P2', sourceTreeSha256: this.manifest.sourceTreeSha256,
      agents: roles.filter(role => role.kind === 'main'), workers: roles.filter(role => role.kind === 'worker'),
      skills: this.manifest.skills.map(skill => ({ name: skill.name, description: skill.description, assetStatus: skill.assetStatus,
        issues: skill.issues.map(issue => typeof issue === 'string' ? issue : JSON.stringify(issue)) })),
      commands: this.manifest.commands.map(command => ({ id: command.id, name: command.name, sourcePath: command.source.path,
        targetPresetIds: command.targetPresetIds ?? command.targetPresetChoices ?? [command.targetPresetId], selectionRequired: command.selectionRequired })),
      steering: this.manifest.steering.map(item => ({ id: item.id, targetPresetId: item.targetPresetId, title: item.title })),
      limitations: ['Preset registration and skill discovery do not establish financial business execution.',
        'Commercial sources remain unconfigured; Office execution and deterministic Review Gate are not yet implemented.',
        'Missing upstream templates remain explicitly unavailable; do not invent or substitute them.',
        'Internal Worker presets may appear in the native preset roster; this directory lists only ten main roles.'] }
  }

  async prepareDraft(request) {
    const reject = (code, message) => ({ status: 'REJECTED', workspaceId: null, agentPreset: null, prompt: '',
      whenDraftExists: 'keep', autoSubmit: false, error: { code, message } })
    const role = this.roles?.get(request.agentId)
    if (!role || role.kind !== 'main') return reject('MAIN_AGENT_REQUIRED', 'Choose one of the ten main financial Agents, not an internal Worker.')
    const active = await this.viewRole(role)
    if (active.mountStatus !== 'AVAILABLE') return reject('PRESET_UNAVAILABLE', active.diagnostic ?? 'The native preset is unavailable.')
    const state = await this.binding.snapshot({})
    if (state.workspaceStatus !== 'READY' || state.binding === null) return reject('WORKSPACE_NOT_READY', 'Bind an accessible financial Workspace before creating a draft.')
    let body = request.prompt ?? ''
    if (request.commandId !== undefined) {
      const command = this.manifest.commands.find(item => item.id === request.commandId)
      if (!command || !(command.targetPresetIds ?? command.targetPresetChoices ?? [command.targetPresetId]).includes(role.id)) return reject('COMMAND_ROLE_MISMATCH', 'Select a main Agent offered for this command.')
      body = await readFile(this.resolveAsset(command.promptPath), 'utf8')
    }
    if (request.steeringId !== undefined) {
      const example = this.manifest.steering.find(item => item.id === request.steeringId && item.targetPresetId === role.id)
      if (!example) return reject('EXAMPLE_ROLE_MISMATCH', 'This steering example belongs to another main Agent.')
      body = example.prompt
    }
    const prompt = `[Financial Services draft — not submitted]\nAgent: ${role.name} (${role.id})\nConfirm inputs, dates, source authorization and the original review checkpoints before execution. No publication, client communications, ledger posting, trading or compliance sign-off.\n\n${body || 'Describe the requested task and attach the required source files before sending.'}`
    return { status: 'DRAFT_READY', workspaceId: state.binding.workspaceId, agentPreset: role.id, prompt,
      whenDraftExists: 'keep', autoSubmit: false, error: null }
  }
}
