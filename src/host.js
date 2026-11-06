import { constants, watch } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FinanceCatalog } from './catalog.js'
import { access, realpath, stat } from 'node:fs/promises'
import { Service } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import { createFinanceContract } from './contract.js'
import { createBusinessTaskTemplates } from './business/task-templates.js'
import { WorkspaceBindingOperations } from './workspace-binding.js'
import { financeReflection } from './host/reflection.js'
import { createWorkspaceTool } from './host/tool.js'
import { POLICY_IDS, resolvePolicy } from './review/policy.js'

/** Native event-only directory watch. No polling, source writes or directory creation. */
function watchDirectory(directory, changed, failed) {
  const watcher = watch(directory, { persistent: false }, changed)
  watcher.on('error', failed)
  return () => watcher.close()
}

const DATA_ROW_NAME = '@local/dsh-financial-services/data-runtime-2'
const REVIEW_ROW_NAME = '@local/dsh-financial-services/review'
const DataPageConfig = z.strictObject({
  requestTimeoutMs: z.number().int().min(1).max(300000).default(10000),
  maxConcurrentQueries: z.number().int().min(1).max(128).default(32),
})
const ReviewPageConfig = z.object({
  policyId: z.enum(POLICY_IDS).default('original'),
  customJson: z.string().max(20000).default(''),
})

function rowConfigEntry(editor, rowId) {
  const name = rowId === 'finance-data' ? DATA_ROW_NAME : REVIEW_ROW_NAME
  return editor.configuration().find(({ entry }) => entry?.options?.id === rowId && entry?.options?.name === name)?.entry
}

function rowConfigValues(rowId, config) {
  if (rowId === 'finance-data') return DataPageConfig.parse(config ?? {})
  return ReviewPageConfig.parse(config ?? {})
}

function validateReviewPageConfig(config) {
  const custom = config.customJson.trim() ? JSON.parse(config.customJson) : undefined
  resolvePolicy({ bundle: { policyId: config.policyId, ...(custom === undefined ? {} : { custom }) } })
}

function safeConfigEditError(error) {
  const chain = []
  for (let item = error; item && chain.length < 5; item = item.cause) chain.push(item)
  const message = chain.map(item => String(item?.message ?? '')).join(' ')
  const code = chain.find(item => typeof item?.code === 'string')?.code
  if (code === 'STORE_CORRUPT' || message.includes('STORE_CORRUPT:')) {
    return { code: 'POLICY_HISTORY_STALE', message: 'The prior review decisions were preserved; this policy could not be applied and the prior configuration was restored.' }
  }
  if (/overridden by a home patch or command-line overlay/i.test(message)) {
    return { code: 'CONFIG_OVERLAY', message: 'A higher-priority configuration controls this row; edit that layer instead.' }
  }
  if (code?.startsWith('POLICY_')) {
    return { code: 'CONFIG_INVALID', message: 'The review policy or custom JSON is invalid; the prior configuration remains active.' }
  }
  return { code: 'CONFIG_REJECTED', message: 'The Host rejected the configuration update; the prior value remains active.' }
}

/** Financial Services Host service. Default export is the Loader's sole plugin form. */
export default class FinanceOperations extends TypertRemoteService {
  static inject = ['tools', 'typert', 'workspaceRegistry', 'storageDomain']

  constructor(ctx) {
    super(ctx, 'financeOperations')
    this.roleGrants = new WeakMap()
    this.financialActive = false
  }

  async* [Service.init]() {
    const { remote, schemas } = createFinanceContract(z)
    const domain = await this.ctx.storageDomain.open(defineDomain({
      name: 'financial_services', version: 1,
      tables: { state: domainTable(schemas.StateRoot) },
    }))
    const operations = new WorkspaceBindingOperations({
      table: domain.table('state'), registry: this.ctx.workspaceRegistry, schemas,
      filesystem: { realpath, stat, access: path => access(path, constants.R_OK | constants.X_OK) },
      watchDirectory,
      reportError: error => this.ctx.logger.warn('Financial Services directory monitoring failed: %s', String(error)),
    })
    this.operations = operations
    let registryRefresh
    // Register cleanup before asynchronous initialization; even failed activation releases the handle.
    yield async () => {
      this.financialActive = false
      if (registryRefresh !== undefined) clearImmediate(registryRefresh)
      await operations.dispose()
      await domain.close()
    }
    await operations.initialize()
    this.schemas = schemas
    this.catalogData = new FinanceCatalog({
      assetsRoot: fileURLToPath(new URL('../assets/', import.meta.url)),
      presets: () => this.ctx.get('agentPresets'), binding: operations,
    })
    await this.catalogData.initialize()
    this.financialActive = true
    this.ctx.on('domain/changed', change => {
      if (change.domain !== 'workspace' || registryRefresh !== undefined) return
      // Registry publishes its entity projection after its durable domain writes settle.
      registryRefresh = setImmediate(() => {
        registryRefresh = undefined
        operations.invalidate()
      })
    })
    this.ctx.effect(() => this.ctx.typert.register({
      package: remote.package, face: 'host',
      schemas: Object.entries(schemas).map(([name, schema]) => ({ name, create: () => schema })),
      model: financeReflection(), invocations: remote.descriptors,
    }), 'finance.strictRemote')
    this.ctx.effect(() => this.ctx.tools.register(createWorkspaceTool(this, schemas, z)), 'finance.workspaceTool')
  }

  /** @param request - Exactly {}. @returns Current durable binding and observed status. */
  snapshot(request) {
    return this.requireOperations().snapshot(request)
  }

  /** @param request - Existing absolute path and current revision. @returns Bound or explicit business rejection. */
  bindWorkspace(request) {
    return this.requireOperations().bindWorkspace(request)
  }

  /** @param request - Current revision. @returns Cleared default or explicit business rejection; never deletes data. */
  unbindWorkspace(request) {
    return this.requireOperations().unbindWorkspace(request)
  }

  /** @param request - Exactly {}. @param signal - Native gateway cancellation. @returns Full initial snapshot and observed changes. */
  follow(request, signal) {
    return this.requireOperations().follow(request, signal)
  }

  /** Trusted plugin-only admission; never a Remote/Tool method. The Agent effect owns its revocation. */
  registerRoleRuntime(agent, roleId) {
    if (!this.financialActive || !agent || typeof agent !== 'object') throw new Error('ROLE_AUTHORITY_UNAVAILABLE: financial role admission is unavailable')
    const role = this.catalogData.role(roleId)
    const grant = { roleId, sourceSha256: role.source.sha256, adaptedPromptSha256: role.prompt.adaptedSha256 }
    this.roleGrants.set(agent, grant)
    return () => { if (this.roleGrants.get(agent) === grant) this.roleGrants.delete(agent) }
  }

  /** Trusted floor-only check. A retained revision cannot borrow a different source/Prompt version's grant. */
  isRoleRuntimeActive(agent, roleId, expected) {
    if (!this.financialActive || this.operations?.closed) return false
    const grant = this.roleGrants.get(agent)
    return grant?.roleId === roleId && grant.sourceSha256 === expected.sourceSha256 && grant.adaptedPromptSha256 === expected.adaptedPromptSha256
  }

  /** @param roleId - A trusted preset Config identity. @returns Validated role and its permitted Skill resource roots. */
  /** Declared intake templates only: no file access, no authorization, no started run. */
  taskTemplates(request) {
    this.requireOperations()
    this.schemas.EmptyRequest.parse(request)
    const library = createBusinessTaskTemplates(z)
    const templates = library.list().templates.map(header => {
      const detail = library.describe(header.presetId)
      // Publish the declared reference identities only; the schema itself stays behind describe().
      const checkpoints = Array.isArray(detail.sourceCheckpoints)
        ? detail.sourceCheckpoints.map(item => String(item.id ?? item.label ?? item)).slice(0, 16) : []
      const sourceRefs = Array.isArray(detail.sourceRefs)
        ? detail.sourceRefs.map(item => String(item.path ?? item.id ?? item)).slice(0, 16) : []
      return { presetId: header.presetId, title: header.title, templateVersion: detail.templateVersion, checkpoints, sourceRefs }
    })
    const payload = JSON.stringify({ templateVersion: library.list().templateVersion, templates })
    return this.schemas.TaskTemplates.parse({ templatesJson: payload.slice(0, 200000) })
  }

  async roleDefinition(roleId) {
    this.requireOperations()
    return this.catalogData.role(roleId)
  }

  /** @param roleId - A declared role identity. @returns Its native filesystem Skill scan root, never a user-supplied path. */
  skillRoot(roleId) {
    this.requireOperations()
    return this.catalogData.skillRoot(roleId)
  }

  /** @param request - Exactly {}. @returns Source-backed catalogue with actual native preset diagnostics. */
  async catalog(request) {
    this.requireOperations()
    this.schemas.EmptyRequest.parse(request)
    return this.schemas.Catalog.parse(await this.catalogData.catalog())
  }

  /** @param request - Main role and at most one template or free-form prompt. @returns An unsent draft intent, not a created Session. */
  async prepareDraft(request) {
    this.requireOperations()
    const input = this.schemas.PrepareDraftRequest.parse(request)
    return this.schemas.PreparedDraft.parse(await this.catalogData.prepareDraft(input))
  }

  /** Read the active Loader config for one whitelisted Plugin Manager row. */
  rowConfig(request) {
    const { rowId } = this.schemas.RowConfigRequest.parse(request)
    const editor = this.ctx.get('configEditor')
    if (!editor) return this.schemas.RowConfigSnapshot.parse({ status: 'UNAVAILABLE', rowId, configJson: '',
      error: { code: 'CONFIG_EDITOR_UNAVAILABLE', message: 'The native configuration editor is unavailable.' } })
    try {
      const entry = rowConfigEntry(editor, rowId)
      if (!entry) return this.schemas.RowConfigSnapshot.parse({ status: 'UNAVAILABLE', rowId, configJson: '',
        error: { code: 'CONFIG_ROW_UNAVAILABLE', message: 'The configured Loader row is not available.' } })
      const config = rowConfigValues(rowId, entry.options.config)
      return this.schemas.RowConfigSnapshot.parse({ status: 'READY', rowId, configJson: JSON.stringify(config), error: null })
    } catch {
      return this.schemas.RowConfigSnapshot.parse({ status: 'UNAVAILABLE', rowId, configJson: '',
        error: { code: 'CONFIG_VALUE_UNAVAILABLE', message: 'The current row configuration cannot be represented by this form.' } })
    }
  }

  /** Persist only the exposed fields through ConfigEditor; reject stale or invalid drafts. */
  async saveRowConfig(request) {
    const input = this.schemas.SaveRowConfigRequest.parse(request)
    const editor = this.ctx.get('configEditor')
    const result = (status, error = null) => this.schemas.SaveRowConfigResult.parse({ status, rowId: input.rowId, error })
    if (!editor) return result('UNAVAILABLE', { code: 'CONFIG_EDITOR_UNAVAILABLE', message: 'The native configuration editor is unavailable.' })
    try {
      const expected = rowConfigValues(input.rowId, JSON.parse(input.expectedJson))
      const next = rowConfigValues(input.rowId, JSON.parse(input.configJson))
      if (input.rowId === 'finance-review') validateReviewPageConfig(next)
      const entry = rowConfigEntry(editor, input.rowId)
      if (!entry) return result('UNAVAILABLE', { code: 'CONFIG_ROW_UNAVAILABLE', message: 'The configured Loader row is not available.' })
      await editor.edit(entry, current => {
        const actual = rowConfigValues(input.rowId, current)
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw Object.assign(new Error('Configuration changed since this page was loaded.'), { code: 'CONFIG_CONFLICT' })
        }
        return { ...current, ...next }
      })
      return result('APPLIED')
    } catch (error) {
      if (error?.code === 'CONFIG_CONFLICT') return result('CONFLICT', { code: 'CONFIG_CONFLICT', message: 'Configuration changed since this page was loaded. Reload it before saving.' })
      return result('REJECTED', safeConfigEditError(error))
    }
  }

  requireOperations() {
    if (this.operations === undefined) throw new Error('Financial Services is not active.')
    return this.operations
  }
}
