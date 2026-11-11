/** Browser-serialized factory. Everything it closes over is declared here or supplied by the parent. */
export function createDataSourcesClient(React, z, createDataRemoteContract, createDataSchemas) {
  const h = React.createElement
  const NS = 'financial-data-ui'
  const DATA_ADDRESS = 'dsh-resource://finance-data/current'
  const CATALOG_ADDRESS = 'dsh-resource://finance-catalog/current'
  const contract = createDataRemoteContract(z)
  const schemas = createDataSchemas(z)
  const ids = ['company.identity', 'financial.statements', 'filings', 'earnings.transcript',
    'earnings.consensus', 'prices.history', 'comps', 'transactions', 'macro.rates',
    'portfolio.nav', 'accounting.gl', 'accounting.subledger', 'crm.relationship', 'compliance.screening', 'corporate.actions']
  const Id = schemas.Entity.shape.scheme
  const Integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
  const unique = schema => schema.refine(values => new Set(values).size === values.length, 'Duplicate values')
  // Mirrors SourceBinding exactly; policy remains Host-authoritative and the strict schema rejects extras.
  const Binding = z.strictObject({
    adapterId: Id, sourceAllowlistKey: Id.optional(), sourceId: Id.optional(),
    licenseAssessment: schemas.LicenseAssessment.optional(), scopeIds: unique(z.array(Id).min(1).max(128)),

    roleIds: unique(z.array(z.string().min(1).max(128).regex(/^finance-[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1).max(40)),
    capabilities: unique(z.array(schemas.Capability).min(1).max(ids.length)),
    markets: unique(z.array(Id).min(1).max(64)),
    purposes: unique(z.array(z.enum(['research', 'valuation', 'reporting', 'reconciliation', 'screening'])).min(1).max(5)),
    temporalModes: unique(z.array(schemas.TemporalMode).min(1).max(3)),
    corporateActionDateBases: unique(z.array(schemas.CorporateActionDateBasis).min(1).max(5)).optional(),
    priority: z.number().int().min(0).max(1000000), minQuality: z.number().int().min(0).max(100),
    enabled: z.boolean(), allowTestOnly: z.boolean(),
  }).refine(binding => (binding.sourceAllowlistKey !== undefined) !== (binding.sourceId !== undefined),
  'Exactly one source key is required')
    .refine(binding => binding.sourceId === undefined || binding.licenseAssessment !== undefined,
      'Direct financial-source grants require a LicenseAssessment')
    .refine(binding => binding.capabilities.includes('corporate.actions')
    ? binding.corporateActionDateBases !== undefined
    : binding.corporateActionDateBases === undefined,
  'corporateActionDateBases is required only when corporate.actions is bound')
  const canonicalBinding = binding => JSON.stringify({ ...binding,
    sourceAllowlistKey: binding.sourceAllowlistKey ?? null,
    sourceId: binding.sourceId ?? null,
    licenseAssessment: binding.licenseAssessment ?? null,
    scopeIds: [...binding.scopeIds].sort(), roleIds: [...binding.roleIds].sort(),
    capabilities: [...binding.capabilities].sort(), markets: [...binding.markets].sort(),
    purposes: [...binding.purposes].sort(), temporalModes: [...binding.temporalModes].sort(),
    corporateActionDateBases: binding.corporateActionDateBases ? [...binding.corporateActionDateBases].sort() : null,
  })
  const Bindings = z.array(Binding).max(256).refine(values =>
    new Set(values.map(canonicalBinding)).size === values.length, 'Duplicate source bindings')
  const Status = z.strictObject({ state: z.enum(['READY', 'NOT_CONFIGURED', 'NOT_AUTHORIZED', 'UNAVAILABLE', 'ERROR']),
    verifiedAt: schemas.Timestamp,
    authenticationStatus: z.enum(['UNKNOWN', 'NOT_REQUIRED', 'AUTHENTICATION_OK', 'AUTHENTICATION_FAILED', 'CREDENTIAL_SERVICE_UNAVAILABLE']).optional(),
    connectionStatus: z.enum(['UNKNOWN', 'CONNECTED', 'DISCONNECTED', 'UNAVAILABLE']).optional(),
    code: z.string().max(64).regex(/^[A-Z][A-Z0-9_]*$/).optional() })
  const Adapter = z.strictObject({ ...schemas.AdapterMetadata.shape,
    credentialConfigured: z.boolean(), status: Status,
    registrationStatus: z.literal('REGISTERED').optional(), connectionStatus: z.string().max(32).optional(),
    authenticationStatus: z.enum(['UNKNOWN', 'NOT_REQUIRED', 'AUTHENTICATION_OK', 'AUTHENTICATION_FAILED', 'CREDENTIAL_SERVICE_UNAVAILABLE']).optional(),
    licenseAssessmentStatuses: unique(z.array(z.enum(['UNKNOWN', 'REVIEW_REQUIRED', 'VERIFIED', 'RESTRICTED', 'DENIED'])).min(1).max(5)).optional(),
  }).omit({ credentialRef: true })
    .refine(value => value.testOnly === (value.licenseClass === 'TEST_ONLY'), 'TEST_ONLY markers must agree')
  const Snapshot = z.strictObject({ revision: Integer,
    capabilities: unique(z.array(schemas.Capability).length(ids.length)),
    adapters: z.array(Adapter).max(64).refine(values => new Set(values.map(value => value.id)).size === values.length, 'Duplicate adapters'),
    bindings: Bindings, diagnostics: z.strictObject({ observerFailures: Integer, disposalFailures: Integer }),
    commercialExecutionVerified: z.literal(false) })
  const PolicyInput = z.strictObject({ expectedRevision: Integer, bindings: Bindings })
  const en = {
    title: 'Data sources and scoped policy', loading: 'Reading data sources…', unavailable: 'Data resource unavailable.',
    stale: 'Connection failed. Displayed data is stale; policy actions are disabled.', empty: 'No adapters are registered.',
    directory: 'Capability directory (not availability)', adapters: 'Registered adapters', bindings: 'Explicit source bindings',
    noBindings: 'No source bindings configured.', boundary: 'Credentials, declarations, evidence URIs and permission checkboxes do not prove supplier rights. This UI has no trusted reviewer identity; external source queries remain blocked.',
    status: 'Adapter status', license: 'License class', testOnly: 'TEST_ONLY', credentials: 'Credential configured', yes: 'Yes', no: 'No',
    markets: 'Markets', fields: 'Fields', quality: 'Quality', pit: 'Point-in-time', priority: 'Priority', verified: 'Status verified at',
    add: 'Add scoped source binding', adapter: 'Registered adapter', role: 'Non-writer role / Worker', source: 'Independent financial source',
    assessmentStatus: 'License assessment', evidenceUri: 'License evidence URI (credential-free HTTPS / URN)', evidenceLabel: 'Evidence label',
    licenseOperations: 'User-entered permission claims (not verified; cannot enable queries)', automatedAccess: 'Automated access claimed',
    modelProcessing: 'Model processing permitted', sessionLogging: 'Session logging permitted', retention: 'Retention terms',
    redistribution: 'Redistribution terms', expiresAt: 'Assessment expiry date', licenseAssessment: 'LicenseAssessment',
    licenseNextAction: 'Host has no trusted reviewer identity API. VERIFIED is disabled; an evidence URI or user claim cannot establish supplier rights.', registrationState: 'Registration',
    connectionState: 'Connection', authenticationMode: 'Authentication mode', authenticationState: 'Authentication status', licenseState: 'License assessment',
    capability: 'Declared adapter capability', scope: 'Exact native Agent / Session ID', scopeHint: 'Enter the exact native Agent / Session ID. No wildcard or implicit all-Sessions grant.',
    market: 'Market', purpose: 'Purpose', minQuality: 'Minimum quality (0–100)', allowTestOnly: 'Explicitly allow TEST_ONLY for this binding',
    save: 'Add binding', choose: 'Choose…', noRoles: 'No eligible non-writer roles are available.',
    catalogLoading: 'Reading roles…', catalogUnavailable: 'Role catalogue unavailable; new bindings are disabled.',
    catalogStale: 'Role catalogue is stale; new bindings are disabled.', remove: 'Remove binding', applyPriority: 'Apply priority',
    disable: 'Disable binding', enable: 'Enable binding', enabled: 'Enabled', revision: 'Policy revision', saving: 'Saving policy…',
    applied: 'Host APPLIED. Waiting for the authoritative resource update; no execution is claimed.',
    invalid: 'Select an adapter/source, a non-writer role, capability, market, purpose and exact scope. Check assessment inputs and numeric limits.',
    cancelled: 'Data UI was disposed. The result cannot be confirmed; reconnect before retrying.', failed: 'Policy request failed.',
    research: 'Research', valuation: 'Valuation', reporting: 'Reporting', reconciliation: 'Reconciliation', screening: 'Screening',
    diagnostics: 'Observer / disposal failures', noCoverage: 'No registered adapter declares this capability.',
    dataTitle: 'A-share data control plane',
    dataCapabilities: 'Capability directory (not availability)', dataNoAdapters: 'No adapter is registered.',
    dataNoRights: 'No source rights are available. Register an adapter and configure an exact direct financial-source grant.',
    dataNoBindings: 'No source bindings configured.', dataNoEligibleRoles: 'No eligible non-writer role is available; do not create a binding.',
    dataUnconfigured: 'Control-plane resource is unavailable; no source state is assumed.',
    dataPermissions: 'Registration, connection, authentication and a public response are not permission. The Host has no trusted reviewer identity API: Client-entered VERIFIED, evidence URIs and permission checkboxes are unverified claims, not supplier grants. Remote VERIFIED writes are rejected; direct-source queries remain blocked. Legacy MCP bindings retain their separate checks.',
    dataPermissionCheck: 'Permission: not established here; no external query until a trusted Host review path exists.',
    dataTemporalModes: 'Temporal modes', dataDateBases: 'Corporate-action date bases', dataPriceAdjustments: 'Adapter-declared price adjustments (not binding policy)',
    dataNoCoverage: 'No registered adapter declares this capability.', dataCommercial: 'Commercial execution verified',
    dataSource: 'Underlying source ID', dataRevision: 'Policy revision', dataPolicy: 'Source policy',
    dataSave: 'Save binding', dataApplied: 'Host APPLIED. Waiting for authoritative catalog update.',
    dataInvalid: 'Choose an explicitly registered adapter, eligible role/source, capability, market, purpose and exact scope; select temporal mode(s) and validate bounds.',
    strict: 'Strict', date_bounded: 'Date-bounded', current_only: 'Current snapshot only',
    announcement_date: 'Announcement date', record_date: 'Record date', ex_date: 'Ex-date', payment_date: 'Payment date', effective_date: 'Effective date',
  }
  const zh = {
    title: '数据源与限定范围策略', loading: '正在读取数据源…', unavailable: '数据资源不可用。',
    stale: '连接失败。显示内容已过期；策略操作已禁用。', empty: '尚未注册任何 Adapter。',
    directory: '能力目录（不代表可用性）', adapters: '已注册 Adapter', bindings: '明确的数据源绑定',
    noBindings: '尚未配置数据源绑定。', boundary: '凭据、能力声明、证据 URI 和权限勾选均不证明供应商授予了权限。本界面没有可信审核者身份接口；外部数据查询仍被阻止。',
    status: 'Adapter 状态', license: '许可类别', testOnly: 'TEST_ONLY', credentials: '已配置凭据', yes: '是', no: '否',
    markets: '市场', fields: '字段', quality: '质量', pit: '时间点一致性', priority: '优先级', verified: '状态核验时间',
    add: '添加限定范围的数据源绑定', adapter: '已注册 Adapter', role: '非写入角色 / Worker', source: '独立金融数据来源',
    assessmentStatus: '许可评估', evidenceUri: '许可依据 URI（无凭据 HTTPS / URN）', evidenceLabel: '证据标签',
    licenseOperations: '用户录入的权限声明（未核验，不能启用查询）', automatedAccess: '声明允许自动访问',
    modelProcessing: '允许模型处理', sessionLogging: '允许会话记录', retention: '留存条款',
    redistribution: '再分发条款', expiresAt: '评估到期日', licenseAssessment: '许可评估',
    licenseNextAction: 'Host 没有可信审核者身份接口；已禁用 VERIFIED。证据 URI 或用户声明不能证明供应商授权。', registrationState: '注册状态',
    connectionState: '连接状态', authenticationMode: '认证方式', authenticationState: '认证状态', licenseState: '许可评估状态',
    capability: 'Adapter 声明能力', scope: '精确原生 Agent / Session ID', scopeHint: '输入精确原生 Agent / Session ID；不允许通配符或隐式全部会话授权。',
    market: '市场', purpose: '用途', minQuality: '最低质量（0–100）', allowTestOnly: '明确允许此绑定使用 TEST_ONLY',
    save: '添加绑定', choose: '请选择…', noRoles: '没有可选的非写入角色。',
    catalogLoading: '正在读取角色…', catalogUnavailable: '角色目录不可用；无法添加绑定。',
    catalogStale: '角色目录已过期；无法添加绑定。', remove: '移除绑定', applyPriority: '应用优先级',
    disable: '停用绑定', enable: '启用绑定', enabled: '已启用', revision: '策略版本', saving: '正在保存策略…',
    applied: 'Host 返回 APPLIED；等待权威资源更新，不代表已执行金融任务。',
    invalid: '请选择 Adapter/来源、非写入角色、能力、市场、用途和精确范围，并检查许可评估输入与数值限制。',
    cancelled: '数据界面已卸载；无法确认结果，请重新连接后再试。', failed: '策略请求失败。',
    research: '研究', valuation: '估值', reporting: '报告', reconciliation: '对账', screening: '筛查',
    diagnostics: '观察者 / 释放失败次数', noCoverage: '没有已注册 Adapter 声明此能力。',
    dataTitle: 'A 股数据控制面',
    dataCapabilities: '能力目录（不代表可用性）', dataNoAdapters: '尚未注册 Adapter。',
    dataNoRights: '当前没有数据源权限：请注册 Adapter 并配置精确的独立金融来源 grant。',
    dataNoBindings: '尚未配置数据源绑定。', dataNoEligibleRoles: '没有可选的合格非写入角色；不能创建绑定。',
    dataUnconfigured: '控制面资源不可用；不假定任何数据源状态。',
    dataPermissions: '注册、连接、认证和公开响应都不代表许可。Host 没有可信审核者身份接口：Client 输入的 VERIFIED、证据 URI 和权限勾选仅是未核验声明，不是供应商授权；远程 VERIFIED 写入会被拒绝，独立来源查询继续阻止。旧 MCP binding 保留独立校验。',
    dataPermissionCheck: '权限：当前未建立；可信 Host 审核流程存在前不执行外部查询。',
    dataTemporalModes: '时间模式', dataDateBases: '公司行动日期基准', dataPriceAdjustments: 'Adapter 声明的复权方式（不是绑定策略）',
    dataNoCoverage: '没有已注册 Adapter 声明此能力。', dataCommercial: '商业执行已核验',
    dataSource: '底层来源 ID', dataRevision: '策略版本', dataPolicy: '用户策略',
    dataSave: '保存绑定', dataApplied: 'Host 已 APPLIED；等待权威目录更新。',
    dataInvalid: '请选择已注册 Adapter、合格角色/来源、能力、市场、用途和精确范围；选择时间模式并检查数值限制。',
    strict: '严格', date_bounded: '按日期界定', current_only: '仅当前快照',
    announcement_date: '公告日期', record_date: '股权登记日', ex_date: '除权除息日', payment_date: '派息日', effective_date: '生效日',
  }
  const failureOf = error => ({ code: typeof error?.code === 'string' ? error.code.slice(0, 64) : 'gateway/internal',
    message: typeof error?.message === 'string' ? error.message.slice(0, 512) : en.failed, details: {} })
  const invalidSnapshot = () => ({ ok: false, error: { code: 'finance-data/invalid-snapshot', message: 'Invalid bounded finance-data catalogue.', details: {} } })
  const decodeCatalog = value => {
    try { return { ok: true, value: Snapshot.parse(JSON.parse(contract.schemas.Catalog.parse(value).catalogJson)) } }
    catch { return invalidSnapshot() }
  }
  const decodeUnary = result => {
    if (result?.ok === false && result.error) return { ok: false, error: failureOf(result.error) }
    return result?.ok === true ? decodeCatalog(result.value) : invalidSnapshot()
  }

  function install(ctx) {
    const lifetime = new AbortController()
    ctx.effect(() => () => lifetime.abort(), 'financial-data: callback lifetime')
    ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'financial-data: dictionaries')
    const dataT = ctx.locale.bind(NS)
    const cancelledMessage = dataT('cancelled')
    const cancelled = () => ({ status: 'CANCELLED', error: { code: 'gateway/cancelled', message: cancelledMessage } })
    // Exposed only to the user-facing panel callback; no agent Tool is registered here.
    const updateDataPolicy = async request => {
      if (lifetime.signal.aborted) return cancelled()
      const parsed = PolicyInput.safeParse(request)
      if (!parsed.success) return { status: 'INVALID_REQUEST', error: { code: 'POLICY_INVALID', message: dataT('dataInvalid') } }
      let result
      try {
        const input = contract.schemas.PolicyRequest.parse({
          expectedRevision: parsed.data.expectedRevision, bindingsJson: JSON.stringify(parsed.data.bindings),
        })
        result = await ctx.remote.financeData.setBindings(input)
        if (lifetime.signal.aborted) return cancelled()
        if (result?.ok !== true) return { status: 'REMOTE_ERROR', error: failureOf(result?.error) }
        return contract.schemas.PolicyResult.parse(result.value)
      } catch (error) {
        return lifetime.signal.aborted ? cancelled() : { status: 'REMOTE_ERROR', error: failureOf(error) }
      }
    }
    ctx.effect(() => ctx.resources.register({
      protocol: 'finance-data',
      async *open(address, { signal }) {
        if (signal.aborted || lifetime.signal.aborted) return
        if (address !== DATA_ADDRESS) { yield { ok: false, error: { code: 'gateway/bad-request', message: address, details: {} } }; return }
        const stream = ctx.remote.$stream({
          name: 'financial-services data',
          async *open(generationSignal) {
            try {
              const initial = await ctx.remote.financeData.catalog({})
              if (generationSignal.aborted) return
              yield decodeUnary(initial)
              // follow yields raw Catalog DTOs, NOT RemoteResults. Wrap exactly once after decoding.
              for await (const value of ctx.remote.financeData.follow({}, generationSignal)) {
                if (generationSignal.aborted) return
                yield decodeCatalog(value)
              }
            } catch (error) {
              if (generationSignal.aborted) return
              yield { ok: false, error: failureOf(error) }
              throw error
            }
          },
          ended: () => new Error('financial-services data follow ended'),
        })
        const close = () => { void stream.dispose() }
        signal.addEventListener('abort', close, { once: true })
        lifetime.signal.addEventListener('abort', close, { once: true })
        try {
          for await (const item of stream) {
            if (signal.aborted || lifetime.signal.aborted) return
            item.accept()
            yield item.value
          }
        } catch (error) {
          if (!signal.aborted && !lifetime.signal.aborted) yield { ok: false, error: failureOf(error) }
        } finally {
          signal.removeEventListener('abort', close)
          lifetime.signal.removeEventListener('abort', close)
          await stream.dispose()
        }
      },
    }), 'financial-data: resource')
    return { dataT, updateDataPolicy, dataAddress: DATA_ADDRESS, dataCatalogAddress: CATALOG_ADDRESS }
  }

  function BindingRow({ binding, index, live, busy, t, save, snapshot }) {
    const [priority, setPriority] = React.useState(String(binding.priority))
    const priorityId = React.useId()
    const replace = patch => save({ expectedRevision: snapshot.revision,
      bindings: snapshot.bindings.map((value, offset) => offset === index ? { ...value, ...patch } : value) })
    const validPriority = /^\d+$/.test(priority) && Number(priority) <= 1000000
    return h('li', { className: 'finance-p2__card' },
      h('strong', null, binding.adapterId),
      h('p', null, `${binding.roleIds.join(', ')} · ${binding.sourceId ? `financial source ${binding.sourceId}` : `legacy MCP ${binding.sourceAllowlistKey}`}`),
      binding.licenseAssessment ? h('p', { className: 'finance-p2__hint' }, `${t('licenseAssessment')}: ${binding.licenseAssessment.assessmentStatus} · ${binding.licenseAssessment.evidenceRefs.length} evidence reference(s) · ${t('licenseNextAction')}`) : null,
      h('p', null, `${t('scope')}: ${binding.scopeIds.join(', ')}`),
      h('p', null, `${binding.capabilities.join(', ')} · ${binding.markets.join(', ')} · ${binding.purposes.map(value => t(value)).join(', ')}`),
      h('p', null, `${t('dataTemporalModes')}: ${binding.temporalModes.map(value => t(value)).join(', ')}`),
      binding.corporateActionDateBases ? h('p', null, `${t('dataDateBases')}: ${binding.corporateActionDateBases.map(value => t(value)).join(', ')}`) : null,
      h('p', null, `${t('enabled')}: ${t(binding.enabled ? 'yes' : 'no')} · ${t('minQuality')}: ${binding.minQuality} · ${t('testOnly')}: ${t(binding.allowTestOnly ? 'yes' : 'no')}`),
      h('label', { htmlFor: priorityId }, `${t('priority')} (0–1000000)`),
      h('input', { id: priorityId, type: 'number', min: 0, max: 1000000, step: 1, value: priority, disabled: !live || busy,
        onChange: event => setPriority(event.target.value) }),
      h('div', { className: 'finance-p2__actions' },
        h('button', { type: 'button', disabled: !live || busy || !validPriority, onClick: () => replace({ priority: Number(priority) }) }, t('applyPriority')),
        h('button', { type: 'button', disabled: !live || busy, onClick: () => replace({ enabled: !binding.enabled }) }, t(binding.enabled ? 'disable' : 'enable')),
        h('button', { type: 'button', disabled: !live || busy, onClick: () => save({ expectedRevision: snapshot.revision,
          bindings: snapshot.bindings.filter((_, offset) => offset !== index) }) }, t('remove'))))
  }

  function Panel({ useResource, dataT: t, updateDataPolicy, dataAddress = DATA_ADDRESS,
    dataCatalogAddress = CATALOG_ADDRESS }) {
    const resource = useResource(dataAddress)
    const catalog = useResource(dataCatalogAddress)
    const snapshot = Snapshot.safeParse(resource.value).success ? resource.value : null
    const [draft, setDraft] = React.useState({ adapterId: '', roleId: '', source: '', capability: '', scope: '', market: '', purpose: '', temporalModes: [], corporateActionDateBases: [], priority: '0', minQuality: '0', allowTestOnly: false,
      assessmentStatus: 'REVIEW_REQUIRED', evidenceUri: '', evidenceLabel: '', automatedAccess: false, modelProcessing: false, sessionLogging: false,
      retention: 'UNKNOWN', redistribution: 'UNKNOWN', expiresAt: '' })
    const [busy, setBusy] = React.useState(false)
    const [reply, setReply] = React.useState(null)
    const pending = React.useRef(false)
    const prefix = React.useId()
    // This is a projection of the existing finance-catalog resource, never a second role parser or authority.
    const roles = [...(catalog.value?.agents ?? []), ...(catalog.value?.workers ?? [])]
      .filter(role => role.writer === false)
    const role = roles.find(value => value.id === draft.roleId)
    const adapter = snapshot?.adapters.find(value => value.id === draft.adapterId)
    const capability = adapter?.capabilities.find(value => value.id === draft.capability)
    const live = resource.status === 'live' && !!snapshot
    const canAdd = live && catalog.status === 'live' && typeof updateDataPolicy === 'function' &&
      !!snapshot?.adapters.length && !!roles.length && !busy && snapshot.bindings.length < 256
    const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value,
      ...(key === 'adapterId' ? { capability: '', market: '' } : {}),
      ...(key === 'roleId' ? { source: '' } : {}), ...(key === 'capability' ? { market: '' } : {}) }))
    const save = async request => {
      if (!live || pending.current || typeof updateDataPolicy !== 'function') return
      pending.current = true
      setBusy(true)
      setReply(null)
      try { setReply(await updateDataPolicy(request)) }
      catch (error) { setReply({ status: 'REMOTE_ERROR', error: failureOf(error) }) }
      finally { pending.current = false; setBusy(false) }
    }
    const submit = event => {
      event.preventDefault()
      if (!canAdd || !adapter || !role || draft.source !== adapter.sourceId || !capability ||
        !capability.markets.includes(draft.market) || !draft.purpose || !draft.scope.trim() ||
        !/^\d+$/.test(draft.priority) || !/^\d+$/.test(draft.minQuality) ||
        (capability.id === 'corporate.actions' && draft.corporateActionDateBases.length === 0)) {
        setReply({ status: 'INVALID_REQUEST', error: { code: 'POLICY_INVALID', message: t('dataInvalid') } }); return
      }
      const value = { adapterId: adapter.id, sourceId: draft.source, scopeIds: [draft.scope.trim()],
        roleIds: [role.id], capabilities: [capability.id], markets: [draft.market], purposes: [draft.purpose],
        temporalModes: [...draft.temporalModes], priority: Number(draft.priority), minQuality: Number(draft.minQuality),
        enabled: true, allowTestOnly: draft.allowTestOnly,
        licenseAssessment: {
          version: 1, sourceId: draft.source, assessmentStatus: draft.assessmentStatus,
          evidenceRefs: draft.evidenceUri.trim() ? [{ uri: draft.evidenceUri.trim(), label: draft.evidenceLabel.trim() || 'User-entered reference; not validated' }] : [],
          allowedPurposes: [draft.purpose], capabilityIds: [capability.id],
          automatedAccess: draft.automatedAccess, modelProcessing: draft.modelProcessing, sessionLogging: draft.sessionLogging,
          retention: draft.retention, redistribution: draft.redistribution,
          reviewedAt: null,
          expiresAt: draft.expiresAt ? new Date(`${draft.expiresAt}T23:59:59.000Z`).toISOString() : null,
        } }
      if (capability.id === 'corporate.actions') value.corporateActionDateBases = [...draft.corporateActionDateBases]
      const binding = Binding.safeParse(value)
      if (!binding.success) { setReply({ status: 'INVALID_REQUEST', error: { code: 'POLICY_INVALID', message: t('dataInvalid') } }); return }
      void save({ expectedRevision: snapshot.revision, bindings: [...snapshot.bindings, binding.data] })
    }
    const select = (key, label, options) => h(React.Fragment, { key },
      h('label', { htmlFor: `${prefix}-${key}` }, t(label)),
      h('select', { id: `${prefix}-${key}`, value: draft[key], disabled: !canAdd || options.length === 0,
        required: true, onChange: event => change(key, event.target.value) },
      h('option', { value: '' }, t('choose')), options.map(option => h('option', { key: option.id, value: option.id }, option.label ?? option.id))))
    const input = (key, label, attributes = {}) => h(React.Fragment, { key },
      h('label', { htmlFor: `${prefix}-${key}` }, t(label)),
      h('input', { id: `${prefix}-${key}`, value: draft[key], disabled: !canAdd, required: true,
        onChange: event => change(key, event.target.value), ...attributes }))
    const checkboxGroup = (key, label, options) => h('fieldset', { className: 'finance-p2__form' },
      h('legend', null, t(label)), options.map(value => h('label', { key: value, htmlFor: `${prefix}-${key}-${value}` },
        h('input', { id: `${prefix}-${key}-${value}`, type: 'checkbox', checked: draft[key].includes(value), disabled: !canAdd,
          onChange: event => setDraft(previous => ({ ...previous,
            [key]: event.target.checked ? [...previous[key], value] : previous[key].filter(item => item !== value) })) }), t(value))))
    const notice = (r, loading, unavailable, stale) => h(React.Fragment, null,
      r.status === 'loading' ? h('p', { role: 'status' }, t(loading)) : null,
      r.status === 'none' ? h('p', { role: 'status' }, t(unavailable)) : null,
      r.status === 'failed' ? h('p', { role: 'alert', className: 'finance-p2__error' }, t(stale)) : null,
      r.failure ? h('p', { role: 'alert', className: 'finance-p2__error' }, `${r.failure.code ?? ''}: ${r.failure.message ?? ''}`) : null)
    return h('section', { className: 'finance-p2__card', 'aria-busy': busy || resource.status === 'loading' },
      h('h2', null, t('dataTitle')), h('p', { className: 'finance-p2__hint' }, t('boundary')),
      notice(resource, 'loading', 'dataUnconfigured', 'stale'),
      h('p', { className: 'finance-p2__error', role: 'note' }, t('dataPermissions')),
      snapshot ? h(React.Fragment, null,
        h('p', null, `${t('dataRevision')}: ${snapshot.revision}`),
        h('p', { className: 'finance-p2__hint' }, `${t('diagnostics')}: ${snapshot.diagnostics.observerFailures} / ${snapshot.diagnostics.disposalFailures}`),
        h('p', { className: 'finance-p2__error', role: 'note' }, `${t('dataCommercial')}: ${t(snapshot.commercialExecutionVerified ? 'yes' : 'no')}`),
        snapshot.adapters.length === 0 ? h('p', { role: 'status' }, t('dataNoAdapters')) : null,
        catalog.status === 'live' && roles.length === 0 ? h('p', { role: 'status' }, t('dataNoEligibleRoles')) : null,
        snapshot.adapters.length === 0 && roles.length === 0 ? h('p', { role: 'alert', className: 'finance-p2__error' }, t('dataNoRights')) : null,
        h('h3', null, t('adapters')),
        snapshot.adapters.slice(0, 64).map(value => h('article', { key: value.id, className: 'finance-p2__card' },
          h('h4', null, `${value.label} · ${value.id} · ${value.version}`),
          h('p', null, `${t('dataSource')}: ${value.sourceId} · ${t('license')}: ${value.licenseClass} · ${t('testOnly')}: ${t(value.testOnly ? 'yes' : 'no')}`),
          h('p', null, `${t('status')}: ${value.status.state}${value.status.code ? ` / ${value.status.code}` : ''}`),
          h('p', null, `${t('registrationState')}: ${value.registrationStatus ?? 'REGISTERED'} · ${t('connectionState')}: ${value.connectionStatus ?? 'UNKNOWN'} · ${t('authenticationMode')}: ${value.authenticationMode ?? 'UNKNOWN'} · ${t('authenticationState')}: ${value.authenticationStatus ?? value.status.authenticationStatus ?? 'UNKNOWN'}`),
          h('p', null, `${t('verified')}: ${value.status.verifiedAt} · ${t('credentials')}: ${t(value.credentialConfigured ? 'yes' : 'no')} · ${t('licenseState')}: ${(value.licenseAssessmentStatuses ?? ['UNKNOWN']).join(', ')}`),
          h('p', { className: 'finance-p2__hint' }, t('dataPermissionCheck')), 
          h('ul', null, value.capabilities.slice(0, 15).map(cap => h('li', { key: cap.id }, h('strong', null, cap.id),
            h('p', null, `${t('markets')}: ${cap.markets.join(', ')} · ${t('fields')}: ${cap.fields.join(', ')}`),
            h('p', null, `${t('quality')}: ${cap.quality} · ${t('priority')}: ${cap.priority} · ${t('dataTemporalModes')}: ${cap.temporalModes.map(mode => t(mode)).join(', ')}`),
            cap.corporateActionDateBases ? h('p', null, `${t('dataDateBases')}: ${cap.corporateActionDateBases.map(value => t(value)).join(', ')}`) : null,
            cap.priceAdjustments ? h('p', null, `${t('dataPriceAdjustments')}: ${cap.priceAdjustments.join(', ')}`) : null))))),
        h('h3', null, t('dataCapabilities')), h('ul', null, snapshot.capabilities.slice(0, 15).map(id => {
          const providers = snapshot.adapters.filter(value => value.capabilities.some(cap => cap.id === id))
          return h('li', { key: id }, h('strong', null, id), ' — ', providers.length
            ? providers.map(value => `${value.id} (${value.status.state})`).join(', ')
            : t('dataNoCoverage'))
        }))) : null,
      h('h3', null, t('dataPolicy')),
      snapshot ? h(React.Fragment, null,
        h('h4', null, t('add')), notice(catalog, 'catalogLoading', 'catalogUnavailable', 'catalogStale'),
        catalog.status === 'live' && roles.length === 0 ? h('p', { role: 'status' }, t('dataNoEligibleRoles')) : null,
        h('form', { className: 'finance-p2__form', onSubmit: submit, 'aria-busy': busy },
          select('adapterId', 'adapter', snapshot.adapters.map(value => ({ id: value.id, label: `${value.label} (${value.id})` }))),
          select('roleId', 'role', roles.map(value => ({ id: value.id, label: `${value.name} (${value.id})` }))),
          select('source', 'source', adapter ? [{ id: adapter.sourceId, label: `${adapter.sourceId} (independent financial-source grant)` }] : []),
          select('capability', 'capability', adapter?.capabilities.map(value => ({ id: value.id })) ?? []),
          select('assessmentStatus', 'assessmentStatus', ['UNKNOWN', 'REVIEW_REQUIRED', 'RESTRICTED', 'DENIED'].map(id => ({ id }))),
          input('evidenceUri', 'evidenceUri', { type: 'url', maxLength: 2048, autoComplete: 'off', required: false }),
          input('evidenceLabel', 'evidenceLabel', { type: 'text', maxLength: 256, autoComplete: 'off', required: false }),
          h('fieldset', { className: 'finance-p2__form' }, h('legend', null, t('licenseOperations')),
            ...[['automatedAccess', 'automatedAccess'], ['modelProcessing', 'modelProcessing'], ['sessionLogging', 'sessionLogging']].map(([key, label]) =>
              h('label', { key, htmlFor: `${prefix}-${key}` }, h('input', { id: `${prefix}-${key}`, type: 'checkbox', checked: draft[key], disabled: !canAdd,
                onChange: event => change(key, event.target.checked) }), t(label)))),
          select('retention', 'retention', ['NONE', 'SESSION_ONLY', 'DURATION_LIMITED', 'UNRESTRICTED', 'UNKNOWN'].map(id => ({ id }))),
          select('redistribution', 'redistribution', ['PROHIBITED', 'RESTRICTED', 'ALLOWED', 'UNKNOWN'].map(id => ({ id }))),
          input('expiresAt', 'expiresAt', { type: 'date', required: false }),
          input('scope', 'scope', { type: 'text', maxLength: 128, autoComplete: 'off', spellCheck: false, 'aria-describedby': `${prefix}-scope-hint` }),
          h('p', { id: `${prefix}-scope-hint`, className: 'finance-p2__hint' }, t('scopeHint')),
          select('market', 'market', capability?.markets.map(id => ({ id })) ?? []),
          select('purpose', 'purpose', ['research', 'valuation', 'reporting', 'reconciliation', 'screening'].map(id => ({ id, label: t(id) }))),
          checkboxGroup('temporalModes', 'dataTemporalModes', schemas.TemporalMode.options),
          capability?.id === 'corporate.actions' ? checkboxGroup('corporateActionDateBases', 'dataDateBases', schemas.CorporateActionDateBasis.options) : null,
          input('priority', 'priority', { type: 'number', min: 0, max: 1000000, step: 1 }),
          input('minQuality', 'minQuality', { type: 'number', min: 0, max: 100, step: 1 }),
          h('label', { htmlFor: `${prefix}-test` }, h('input', { id: `${prefix}-test`, type: 'checkbox', checked: draft.allowTestOnly,
            disabled: !canAdd, onChange: event => change('allowTestOnly', event.target.checked) }), t('allowTestOnly')),
          h('button', { type: 'submit', disabled: !canAdd, className: 'finance-p2__primary' }, t(busy ? 'saving' : 'dataSave'))),
        reply ? h('p', { role: reply.status === 'APPLIED' ? 'status' : 'alert', className: reply.status === 'APPLIED' ? 'finance-p2__hint' : 'finance-p2__error' },
          reply.status === 'APPLIED' ? t('dataApplied') : `${reply.status}: ${reply.error?.code ?? ''} ${reply.error?.message ?? t('failed')}`) : null,
        h('h4', null, t('bindings')), snapshot.bindings.length ? h('ul', null, snapshot.bindings.slice(0, 256).map((binding, index) =>
          h(BindingRow, { key: `${snapshot.revision}-${index}`, binding, index, live: live, busy: busy, t, save: save, snapshot: snapshot }))) : h('p', null, t('dataNoBindings'))) : null)
  }
  return { remote: contract.remote, Panel, install }
}
