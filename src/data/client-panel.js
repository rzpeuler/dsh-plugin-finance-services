/** Browser-serialized factory. Everything it closes over is declared here or supplied by the parent. */
export function createDataSourcesClient(React, z, createDataRemoteContract, createDataSchemas) {
  const h = React.createElement
  const NS = 'financial-data-ui'
  const ADDRESS = 'dsh-resource://finance-data/current'
  const CATALOG_ADDRESS = 'dsh-resource://finance-catalog/current'
  const contract = createDataRemoteContract(z)
  const schemas = createDataSchemas(z)
  const ids = ['company.identity', 'financial.statements', 'filings', 'earnings.transcript',
    'earnings.consensus', 'prices.history', 'comps', 'transactions', 'macro.rates',
    'portfolio.nav', 'accounting.gl', 'accounting.subledger', 'crm.relationship', 'compliance.screening']
  const Id = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/)
  const Integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
  const unique = schema => schema.refine(values => new Set(values).size === values.length, 'Duplicate values')
  // Structural validation is not authorization. Only the Host intersects original role/source grants.
  const Binding = z.strictObject({
    adapterId: Id, sourceAllowlistKey: Id, scopeIds: unique(z.array(Id).min(1).max(128)),
    roleIds: unique(z.array(z.string().max(128).regex(/^finance-[a-z0-9]+(?:-[a-z0-9]+)*$/)).min(1).max(40)),
    capabilities: unique(z.array(schemas.Capability).min(1).max(14)), markets: unique(z.array(Id).min(1).max(64)),
    purposes: unique(z.array(z.enum(['research', 'valuation', 'reporting', 'reconciliation', 'screening'])).min(1).max(5)),
    priority: z.number().int().min(0).max(1000000), minQuality: z.number().int().min(0).max(100),
    enabled: z.boolean(), allowTestOnly: z.boolean(),
  })
  const Bindings = z.array(Binding).max(256).refine(values => new Set(values.map(value => JSON.stringify({ ...value,
    scopeIds: [...value.scopeIds].sort(), roleIds: [...value.roleIds].sort(), capabilities: [...value.capabilities].sort(),
    markets: [...value.markets].sort(), purposes: [...value.purposes].sort(),
  }))).size === values.length, 'Duplicate source bindings')
  const Status = z.strictObject({ state: z.enum(['READY', 'NOT_CONFIGURED', 'NOT_AUTHORIZED', 'UNAVAILABLE', 'ERROR']),
    verifiedAt: schemas.Timestamp, code: z.string().max(64).regex(/^[A-Z][A-Z0-9_]*$/).optional() })
  // Zod 4 forbids omit() directly on a refined object. Extend the exact metadata shape,
  // omit the private reference on an unrefined strict copy, then retain its invariant.
  const extendedMetadata = schemas.AdapterMetadata.safeExtend({ credentialConfigured: z.boolean(), status: Status })
  const Adapter = z.strictObject({ ...extendedMetadata.shape }).omit({ credentialRef: true })
    .refine(value => value.testOnly === (value.licenseClass === 'TEST_ONLY'), 'TEST_ONLY markers must agree')
  const Snapshot = z.strictObject({ contractVersion: z.literal('1.0.0'), revision: Integer,
    capabilities: unique(z.array(schemas.Capability).length(14)),
    adapters: z.array(Adapter).max(64).refine(values => new Set(values.map(value => value.id)).size === values.length, 'Duplicate adapters'),
    bindings: Bindings, diagnostics: z.strictObject({ observerFailures: Integer, disposalFailures: Integer,
      transition: z.string().min(1).max(128).optional() }), commercialExecutionVerified: z.literal(false) })
  const PolicyInput = z.strictObject({ expectedRevision: Integer, bindings: Bindings })
  const en = {
    title: 'Data sources and scoped policy', loading: 'Reading data sources…', unavailable: 'Data resource unavailable.',
    stale: 'Connection failed. Displayed data is stale; policy actions are disabled.', empty: 'No adapters are registered.',
    directory: 'Capability directory (not availability)', adapters: 'Registered adapters', bindings: 'Explicit source bindings',
    noBindings: 'No source bindings configured.', boundary: 'Credential configured does not mean authenticated, authorized or licensed. A declared capability is not proof of availability. Commercial execution is not verified.',
    status: 'Adapter status', license: 'License class', testOnly: 'TEST_ONLY', credentials: 'Credential configured', yes: 'Yes', no: 'No',
    markets: 'Markets', fields: 'Fields', quality: 'Quality', pit: 'Point-in-time', priority: 'Priority', verified: 'Status verified at',
    add: 'Add scoped source binding', adapter: 'Registered adapter', role: 'Non-writer role / Worker', source: 'Original role source allowlist key',
    capability: 'Declared adapter capability', scope: 'Exact native Agent / Session ID', scopeHint: 'Enter the exact native Agent / Session ID. No wildcard or implicit all-Sessions grant.',
    market: 'Market', purpose: 'Purpose', minQuality: 'Minimum quality (0–100)', allowTestOnly: 'Explicitly allow TEST_ONLY for this binding',
    save: 'Add binding', choose: 'Choose…', noRoles: 'No eligible non-writer roles with original source grants are available.',
    catalogLoading: 'Reading roles…', catalogUnavailable: 'Role catalogue unavailable; new bindings are disabled.',
    catalogStale: 'Role catalogue is stale; new bindings are disabled.', remove: 'Remove binding', applyPriority: 'Apply priority',
    disable: 'Disable binding', enable: 'Enable binding', enabled: 'Enabled', revision: 'Policy revision', saving: 'Saving policy…',
    applied: 'Host APPLIED. Waiting for the authoritative resource update; no execution is claimed.',
    invalid: 'Select an adapter, an eligible role and its original source, a capability, market and exact scope. Check numeric limits.',
    cancelled: 'Data UI was disposed. The result cannot be confirmed; reconnect before retrying.', failed: 'Policy request failed.',
    research: 'Research', valuation: 'Valuation', reporting: 'Reporting', reconciliation: 'Reconciliation', screening: 'Screening',
    diagnostics: 'Observer / disposal failures', noCoverage: 'No registered adapter declares this capability.',
  }
  const zh = {
    title: '数据源与限定范围策略', loading: '正在读取数据源…', unavailable: '数据资源不可用。',
    stale: '连接失败。显示内容已过期；策略操作已禁用。', empty: '尚未注册任何 Adapter。',
    directory: '能力目录（不代表可用性）', adapters: '已注册 Adapter', bindings: '明确的数据源绑定',
    noBindings: '尚未配置数据源绑定。', boundary: '已配置凭据不等于已认证、已授权或已获许可。声明能力不代表当前可用；尚未核验商业执行。',
    status: 'Adapter 状态', license: '许可类别', testOnly: 'TEST_ONLY', credentials: '已配置凭据', yes: '是', no: '否',
    markets: '市场', fields: '字段', quality: '质量', pit: '时间点一致性', priority: '优先级', verified: '状态核验时间',
    add: '添加限定范围的数据源绑定', adapter: '已注册 Adapter', role: '非写入角色 / Worker', source: '角色原始数据源白名单键',
    capability: 'Adapter 声明能力', scope: '精确原生 Agent / Session ID', scopeHint: '输入精确原生 Agent / Session ID；不允许通配符或隐式全部会话授权。',
    market: '市场', purpose: '用途', minQuality: '最低质量（0–100）', allowTestOnly: '明确允许此绑定使用 TEST_ONLY',
    save: '添加绑定', choose: '请选择…', noRoles: '没有带原始数据源权限的可选非写入角色。',
    catalogLoading: '正在读取角色…', catalogUnavailable: '角色目录不可用；无法添加绑定。',
    catalogStale: '角色目录已过期；无法添加绑定。', remove: '移除绑定', applyPriority: '应用优先级',
    disable: '停用绑定', enable: '启用绑定', enabled: '已启用', revision: '策略版本', saving: '正在保存策略…',
    applied: 'Host 返回 APPLIED；等待权威资源更新，不代表已执行金融任务。',
    invalid: '请选择 Adapter、合格角色及其原始数据源、能力、市场与精确范围，并检查数值限制。',
    cancelled: '数据界面已卸载；无法确认结果，请重新连接后再试。', failed: '策略请求失败。',
    research: '研究', valuation: '估值', reporting: '报告', reconciliation: '对账', screening: '筛查',
    diagnostics: '观察者 / 释放失败次数', noCoverage: '没有已注册 Adapter 声明此能力。',
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
    const updateDataPolicy = async request => {
      if (lifetime.signal.aborted) return cancelled()
      const parsed = PolicyInput.safeParse(request)
      if (!parsed.success) return { status: 'INVALID_REQUEST', error: { code: 'POLICY_INVALID', message: dataT('invalid') } }
      let result
      try {
        // No shadow snapshot, optimistic state or manual refresh; follow remains the sole source of truth.
        const input = contract.schemas.PolicyRequest.parse({ expectedRevision: parsed.data.expectedRevision, bindingsJson: JSON.stringify(parsed.data.bindings) })
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
        if (address !== ADDRESS) { yield { ok: false, error: { code: 'gateway/bad-request', message: address, details: {} } }; return }
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
    return { dataT, updateDataPolicy, dataAddress: ADDRESS, dataCatalogAddress: CATALOG_ADDRESS }
  }

  function BindingRow({ binding, index, live, busy, t, save, snapshot }) {
    const [priority, setPriority] = React.useState(String(binding.priority))
    const priorityId = React.useId()
    const replace = patch => save({ expectedRevision: snapshot.revision,
      bindings: snapshot.bindings.map((value, offset) => offset === index ? { ...value, ...patch } : value) })
    const validPriority = /^\d+$/.test(priority) && Number(priority) <= 1000000
    return h('li', { className: 'finance-p2__card' },
      h('strong', null, binding.adapterId),
      h('p', null, `${binding.roleIds.join(', ')} · ${binding.sourceAllowlistKey}`),
      h('p', null, `${t('scope')}: ${binding.scopeIds.join(', ')}`),
      h('p', null, `${binding.capabilities.join(', ')} · ${binding.markets.join(', ')} · ${binding.purposes.map(value => t(value)).join(', ')}`),
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

  function Panel({ useResource, dataT: t, updateDataPolicy, dataAddress = ADDRESS, dataCatalogAddress = CATALOG_ADDRESS }) {
    const resource = useResource(dataAddress)
    const catalog = useResource(dataCatalogAddress)
    const snapshot = resource.value
    const [draft, setDraft] = React.useState({ adapterId: '', roleId: '', source: '', capability: '', scope: '', market: '', purpose: 'research', priority: '0', minQuality: '0', allowTestOnly: false })
    const [busy, setBusy] = React.useState(false)
    const [reply, setReply] = React.useState(null)
    const prefix = React.useId()
    const pending = React.useRef(false)
    // This is a projection of the existing finance-catalog resource, never a second role parser or authority.
    const roles = [...(catalog.value?.agents ?? []), ...(catalog.value?.workers ?? [])]
      .filter(role => role.writer === false && role.allowedMcpServers?.length > 0)
    const role = roles.find(value => value.id === draft.roleId)
    const adapter = snapshot?.adapters.find(value => value.id === draft.adapterId)
    const capability = adapter?.capabilities.find(value => value.id === draft.capability)
    const live = resource.status === 'live' && !!snapshot
    const canAdd = live && catalog.status === 'live' && !busy && (snapshot?.bindings.length ?? 256) < 256
    const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value,
      ...(key === 'adapterId' ? { capability: '', market: '' } : {}),
      ...(key === 'roleId' ? { source: '' } : {}), ...(key === 'capability' ? { market: '' } : {}) }))
    const save = async request => {
      if (!live || pending.current) return
      pending.current = true
      setBusy(true)
      setReply(null)
      try { setReply(await updateDataPolicy(request)) }
      catch (error) { setReply({ status: 'REMOTE_ERROR', error: failureOf(error) }) }
      finally { pending.current = false; setBusy(false) }
    }
    const submit = event => {
      event.preventDefault()
      if (!canAdd || !adapter || !role || !role.allowedMcpServers.includes(draft.source) || !capability || !capability.markets.includes(draft.market)
        || !/^\d+$/.test(draft.priority) || !/^\d+$/.test(draft.minQuality)) {
        setReply({ status: 'INVALID_REQUEST', error: { code: 'POLICY_INVALID', message: t('invalid') } }); return
      }
      const binding = Binding.safeParse({ adapterId: adapter.id, sourceAllowlistKey: draft.source, scopeIds: [draft.scope.trim()],
        roleIds: [role.id], capabilities: [capability.id], markets: [draft.market], purposes: [draft.purpose],
        priority: Number(draft.priority), minQuality: Number(draft.minQuality), enabled: true, allowTestOnly: draft.allowTestOnly })
      if (!binding.success) { setReply({ status: 'INVALID_REQUEST', error: { code: 'POLICY_INVALID', message: t('invalid') } }); return }
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
    const notice = (r, loading, unavailable, stale) => h(React.Fragment, null,
      r.status === 'loading' ? h('p', { role: 'status' }, t(loading)) : null,
      r.status === 'none' ? h('p', { role: 'status' }, t(unavailable)) : null,
      r.status === 'failed' ? h('p', { role: 'alert', className: 'finance-p2__error' }, t(stale)) : null,
      r.failure ? h('p', { role: 'alert', className: 'finance-p2__error' }, `${r.failure.code ?? ''}: ${r.failure.message ?? ''}`) : null)
    return h('section', { className: 'finance-p2__card', 'aria-busy': busy || resource.status === 'loading' },
      h('h2', null, t('title')), h('p', { className: 'finance-p2__hint' }, t('boundary')),
      notice(resource, 'loading', 'unavailable', 'stale'),
      snapshot ? h(React.Fragment, null,
        h('p', null, `${t('revision')}: ${snapshot.revision}`), h('h3', null, t('adapters')),
        snapshot.adapters.length === 0 ? h('p', null, t('empty')) : null,
        snapshot.adapters.map(value => h('article', { key: value.id, className: 'finance-p2__card' },
          h('h4', null, `${value.label} · ${value.id} · ${value.version}`),
          h('p', null, `${t('status')}: ${value.status.state}${value.status.code ? ` / ${value.status.code}` : ''}`),
          h('p', null, `${t('license')}: ${value.licenseClass} · ${t('testOnly')}: ${t(value.testOnly ? 'yes' : 'no')} · ${t('credentials')}: ${t(value.credentialConfigured ? 'yes' : 'no')}`),
          h('p', { className: 'finance-p2__hint' }, `${t('verified')}: ${value.status.verifiedAt}`),
          h('ul', null, value.capabilities.map(cap => h('li', { key: cap.id }, h('strong', null, cap.id),
            h('p', null, `${t('markets')}: ${cap.markets.join(', ')} · ${t('fields')}: ${cap.fields.join(', ')}`),
            h('p', null, `${t('quality')}: ${cap.quality} · ${t('pit')}: ${t(cap.pointInTime ? 'yes' : 'no')} · ${t('priority')}: ${cap.priority}`)))))),
        h('h3', null, t('directory')), h('ul', null, ids.map(id => h('li', { key: id }, h('strong', null, id), ' — ',
          snapshot.adapters.filter(value => value.capabilities.some(cap => cap.id === id)).map(value => `${value.id} (${value.status.state})`).join(', ') || t('noCoverage')))),
        h('p', { className: 'finance-p2__hint' }, `${t('diagnostics')}: ${snapshot.diagnostics.observerFailures} / ${snapshot.diagnostics.disposalFailures}${snapshot.diagnostics.transition ? ` · ${snapshot.diagnostics.transition}` : ''}`)) : null,
      h('h3', null, t('add')), notice(catalog, 'catalogLoading', 'catalogUnavailable', 'catalogStale'),
      catalog.status === 'live' && roles.length === 0 ? h('p', null, t('noRoles')) : null,
      h('form', { className: 'finance-p2__form', onSubmit: submit, 'aria-busy': busy },
        select('adapterId', 'adapter', snapshot?.adapters.map(value => ({ id: value.id, label: `${value.label} (${value.id})` })) ?? []),
        select('roleId', 'role', roles.map(value => ({ id: value.id, label: `${value.name} (${value.id})` }))),
        select('source', 'source', role?.allowedMcpServers.map(id => ({ id })) ?? []),
        select('capability', 'capability', adapter?.capabilities.map(value => ({ id: value.id })) ?? []),
        input('scope', 'scope', { type: 'text', maxLength: 128, autoComplete: 'off', spellCheck: false, 'aria-describedby': `${prefix}-scope-hint` }),
        h('p', { id: `${prefix}-scope-hint`, className: 'finance-p2__hint' }, t('scopeHint')),
        select('market', 'market', capability?.markets.map(id => ({ id })) ?? []),
        select('purpose', 'purpose', ['research', 'valuation', 'reporting', 'reconciliation', 'screening'].map(id => ({ id, label: t(id) }))),
        input('priority', 'priority', { type: 'number', min: 0, max: 1000000, step: 1 }),
        input('minQuality', 'minQuality', { type: 'number', min: 0, max: 100, step: 1 }),
        h('label', { htmlFor: `${prefix}-test` }, h('input', { id: `${prefix}-test`, type: 'checkbox', checked: draft.allowTestOnly,
          disabled: !canAdd, onChange: event => change('allowTestOnly', event.target.checked) }), t('allowTestOnly')),
        h('button', { type: 'submit', disabled: !canAdd, className: 'finance-p2__primary' }, t(busy ? 'saving' : 'save'))),
      reply ? h('p', { role: reply.status === 'APPLIED' ? 'status' : 'alert', className: reply.status === 'APPLIED' ? 'finance-p2__hint' : 'finance-p2__error' },
        reply.status === 'APPLIED' ? t('applied') : `${reply.status}: ${reply.error?.code ?? ''} ${reply.error?.message ?? t('failed')}`) : null,
      h('h3', null, t('bindings')), snapshot ? (snapshot.bindings.length ? h('ul', null, snapshot.bindings.map((binding, index) =>
        h(BindingRow, { key: `${snapshot.revision}-${index}`, binding, index, live, busy, t, save, snapshot }))) : h('p', null, t('noBindings'))) : null)
  }
  return { remote: contract.remote, Panel, install }
}
