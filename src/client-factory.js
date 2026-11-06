/**
 * Materialize the browser half without runtime feature imports.
 * @param {object} React Shell-owned React identity.
 * @param {object} z Shell-owned Zod namespace.
 * @param {Function} createFinanceContract Bundle-owned, self-contained contract factory.
 * @returns {object} Cordis function-plugin exports for the Client module loader.
 */
export function createFinanceClient(React, z, createFinanceContract, dataClient, reviewClient, workbenchClient, runClient = null) {
  const h = React.createElement
  const PACKAGE = '@local/dsh-financial-services'
  const PANEL = 'financial-services'
  const NS = 'financial-services'
  const ADDRESS = 'dsh-resource://finance-workspace/current'
  const CATALOG_ADDRESS = 'dsh-resource://finance-catalog/current'
  const ONBOARDING_VERSION = 1
  const en = {
    title: 'Financial Services',
    stage: 'FUX-01 / FRUN-01 · Agents, Sessions and real Run facts',
    introduction: 'Start with the ten financial Agents, choose a standard task or free chat, and inspect Runs derived from native Session events.',
    catalog: 'Installed catalogue', catalogLoading: 'Reading the installed catalogue…', catalogUnavailable: 'The catalogue resource is unavailable.',
    catalogStale: 'Catalogue connection failed. Any displayed entries are the last received state, not current verification.',
    agents: 'Main roles', workers: 'Owned Workers', skills: 'Skills', commands: 'Command templates', steering: 'Steering examples',
    workerVisibility: 'Only main roles appear in this catalogue. Internal Workers may also be visible in the native preset list; start tasks through a main role.',
    sourceTreeSha: 'Source tree SHA-256', sourcePath: 'Source path', sourceSha: 'Source SHA-256', promptSha: 'Adapted prompt SHA-256',
    preset: 'Preset ID', mount: 'Native preset status', diagnostic: 'Native diagnostic', writer: 'Controlled artifact writer', shell: 'Shell restricted',
    tools: 'Builtin tools', mcp: 'Allowed MCP servers (not proof of connection or authorization)', roleSkills: 'Native scoped Skills', workerIds: 'Allowed Worker presets',
    yes: 'Yes', no: 'No', empty: 'None', available: 'AVAILABLE', unavailablePreset: 'UNAVAILABLE',
    draft: 'Create task draft', drafting: 'Preparing native draft…', draftPrompt: 'Optional task prompt',
    draftHint: 'Opens a native draft only; never submits it. The bound Workspace determines the initial working directory. Existing drafts are kept.',
    draftReady: 'Native draft opened or retained. Nothing was submitted or executed.', draftRejected: 'The Host rejected this draft.',
    draftRemoteError: 'Draft preparation failed at the remote boundary.', draftStartFailed: 'Prepared intent, but opening the native draft failed. No execution is claimed.',
    draftCancelled: 'The bundle was unloaded; the draft result cannot be confirmed. Check the native Workspace before retrying.',
    draftNotReady: 'Bind and verify a Workspace and an available native main preset before preparing a draft.',
    skillSearch: 'Search all Skills by name, description, status or issue', noSkills: 'No Skills match this search.',
    assetStatus: 'Asset status', issues: 'Asset/dependency issues', skillHint: 'Skills are invoked through each role’s native scope, not by granting all roles every tool. BLOCKED and EXTERNAL_RUNTIME_ADAPTATION_REQUIRED are restrictions, not completed execution.',
    chooseRole: 'Choose a specific main role for this command; no default role is inferred.', noTargets: 'No matching main role target is available.',
    commandSelection: 'Explicit role selection required', commandHint: 'Templates prepare drafts only. Source assets, Office execution, commercial MCP authorization and deterministic review gates may remain restricted.',
    workspace: 'Workspace binding',
    path: 'Existing directory (absolute path)',
    pathHint: 'Choose an existing directory or enter its full path. This action does not create a directory.',
    pathPlaceholder: 'Enter an existing absolute directory path',
    pick: 'Choose directory…',
    save: 'Save workspace binding',
    saving: 'Saving…',
    picking: 'Opening directory picker…',
    loading: 'Reading workspace configuration…',
    unavailable: 'The workspace resource is not available. Check whether the bundle is enabled.',
    stale: 'Connection failed. Any binding shown below is the last received state, not a current verification.',
    saved: 'Saved on Host',
    unbound: 'Not bound',
    canonicalPath: 'Canonical path',
    workspaceId: 'Workspace ID',
    revision: 'Configuration revision',
    boundAt: 'Bound at',
    statusLabel: 'Directory status',
    'status.UNBOUND': 'No directory bound',
    'status.READY': 'Directory and Workspace registration verified',
    'status.MISSING_DIRECTORY': 'Saved directory is missing',
    'status.REGISTRY_MISSING': 'Workspace registration is missing',
    'status.PERMISSION_DENIED': 'Access to the directory was denied',
    'status.PATH_DRIFT': 'Workspace path differs from the saved binding',
    limits: 'P2 scope and limitations',
    scope: 'FUX-01 and FRUN-01 provide Agents, Skills, Runs, Deliverables, Review Queue, Data Sources, Settings and native unsent drafts. Runs begin only after durable user-authored Session messages and record real Session events. Artifact production, Office business execution and an end-to-end financial workflow remain out of scope.',
    boundaries: 'No reports are published, client messages sent, ledger entries posted, trades or fund operations executed, or final compliance decisions signed.',
    switching: 'A new binding affects future tasks only. Existing Sessions, files and history are not moved or deleted.',
    hostLimits: 'Host-reported limitations',
    guidanceTitle: 'Set up your financial workspace',
    guidance: 'Choose a real directory before using future financial tasks. The saved binding and onboarding version are restored from Host configuration.',
    open: 'Open Financial Services',
    details: 'Open bundle details',
    dismiss: 'Not now',
    unknownError: 'The operation failed without an error message.',
    rejected: 'The Host rejected the binding.',
    required: 'Enter or choose an existing absolute directory path.',
    requestFailed: 'The request failed. Check the error below before trying again.',
    cancelled: 'Financial Services was unloaded. Check any pending binding save or native draft after re-enabling the bundle.',
    configDataTitle: 'Finance data runtime', configReviewTitle: 'Finance review policy',
    configTimeout: 'Request timeout (ms)', configConcurrency: 'Maximum concurrent queries',
    configPolicy: 'Review policy', configCustomJson: 'Custom policy JSON',
    configSave: 'Save configuration', configSaving: 'Saving configuration…', configSaved: 'Configuration saved through the Host Config Editor.',
    configLoading: 'Loading current Host configuration…', configUnavailable: 'Current configuration values are not available from the Host.',
    configConflict: 'Configuration changed elsewhere. Reload this page before saving.',
    configSaveFailed: 'The Host refused this configuration update.', configInvalid: 'Enter values within the documented range and policy rules.',
    navAgents: 'Agents', navSkills: 'Skills', navRuns: 'Runs', navDeliverables: 'Deliverables', navReviews: 'Review Queue', navData: 'Data Sources', navSettings: 'Settings',
    domainBankingResearch: 'Banking & Research', domainAdvisoryModeling: 'Advisory & Modeling', domainRiskControl: 'Risk & Control', domainFundOperations: 'Fund Operations', domainOther: 'Other',
    agentHomeTitle: 'Choose a financial Agent', agentHomeHint: 'Availability reflects the installed native preset and declared skill assets, not a successful query or business execution.',
    agentNoResults: 'No Agents match this search.', viewAgent: 'View Agent details',
    searchAgents: 'Search Agents by name, description, domain, or dependency', statusCanDraft: 'Can prepare a native draft', statusPartial: 'Declared dependency gaps', statusUnavailable: 'Native preset unavailable',
    detailOverview: 'Overview', detailCapabilities: 'Capabilities', detailDependencies: 'Dependencies', detailHistory: 'History', backAgents: 'Back to Agents', agentDetails: 'Agent details',
    availabilityHint: 'Draft creation also requires a ready Workspace. Model, data-source and commercial-service access are not inferred from this status.',
    standardTask: 'Standard task', chooseTask: 'Choose a native command or steering template', freeChat: 'Free conversation', taskNone: 'No standard template is declared for this Agent.',
    freeChatHint: 'Opens the native DSH chat draft with this Agent preset; no prompt is submitted.', dependencyNote: 'Allowlisted services are not evidence of connection, credentials, authorization, or a successful query.',
    noWorkerDetails: 'No owned Worker details are declared.', noSkillDetails: 'No scoped Skills are declared.', advancedInfo: 'Advanced implementation facts',
    settingsIntro: 'Workspace binding, configuration and implementation diagnostics. Workspace changes apply to future native drafts only.', pageRunsIntro: 'Runs are derived from durable user-authored messages and native Session events.',
  }
  const zh = {
    title: 'Financial Services',
    stage: 'FUX-01 / FRUN-01 · Agents、Session 与真实 Run 事实',
    introduction: '从十个金融 Agent 开始，选择标准任务或自由对话，并查看由原生 Session 事件派生的 Runs。',
    catalog: '已安装目录', catalogLoading: '正在读取已安装目录…', catalogUnavailable: '目录资源当前不可用。',
    catalogStale: '目录连接失败。下方如有条目，仅为最后收到的状态，并非当前核验结果。',
    agents: '主角色', workers: '所属 Worker', skills: 'Skills', commands: '命令模板', steering: 'Steering 样例',
    workerVisibility: '此目录仅列主角色。内部 Worker 也可能出现在原生 Preset 列表中；请通过主角色发起任务。',
    sourceTreeSha: '源目录 SHA-256', sourcePath: '来源路径', sourceSha: '源文件 SHA-256', promptSha: '适配 Prompt SHA-256',
    preset: 'Preset ID', mount: '原生 Preset 状态', diagnostic: '原生诊断', writer: '受控成果写入角色', shell: 'Shell 受限',
    tools: '内置工具', mcp: '允许的 MCP Server（不代表已连接或授权）', roleSkills: '原生作用域 Skills', workerIds: '允许的 Worker Preset',
    yes: '是', no: '否', empty: '无', available: 'AVAILABLE', unavailablePreset: 'UNAVAILABLE',
    draft: '创建任务草稿', drafting: '正在准备原生草稿…', draftPrompt: '可选任务提示词',
    draftHint: '只打开原生草稿，不提交。起始工作目录由已绑定 Workspace 决定；已有草稿保持不变。',
    draftReady: '原生草稿已打开或保留，未提交、未执行任务。', draftRejected: 'Host 拒绝了此草稿。',
    draftRemoteError: '草稿准备在远程边界失败。', draftStartFailed: '意图已准备，但原生草稿打开失败；不代表执行成功。',
    draftCancelled: 'Bundle 已卸载，无法确认草稿结果；重试前请核对原生工作区。',
    draftNotReady: '请先绑定并核验工作区，并确保原生主角色 Preset 可用。',
    skillSearch: '按名称、说明、状态或问题搜索全部 Skills', noSkills: '没有匹配的 Skill。',
    assetStatus: '资产状态', issues: '资产与依赖问题', skillHint: '实际调用通过各角色的原生 Skill 作用域，不向全部角色开放所有工具。BLOCKED 和 EXTERNAL_RUNTIME_ADAPTATION_REQUIRED 表示受限，不代表已执行。',
    chooseRole: '请为此命令明确选择一个主角色，不推测默认角色。', noTargets: '没有匹配的主角色目标。',
    commandSelection: '必须明确选择角色', commandHint: '模板只准备草稿。源资产、Office 执行、商业 MCP 授权及确定性审核关口仍可能受限。',
    workspace: '工作区绑定',
    path: '现有目录（绝对路径）',
    pathHint: '选择已有目录或输入完整路径；此操作不会新建目录。',
    pathPlaceholder: '输入真实存在目录的绝对路径',
    pick: '选择目录…',
    save: '保存工作区绑定',
    saving: '正在保存…',
    picking: '正在打开目录选择器…',
    loading: '正在读取工作区配置…',
    unavailable: '工作区资源当前不可用，请确认 Bundle 已启用。',
    stale: '连接失败。下方如有绑定信息，仅为最后收到的状态，并非当前核验结果。',
    saved: '已保存到 Host',
    unbound: '尚未绑定',
    canonicalPath: '规范路径',
    workspaceId: '工作区 ID',
    revision: '配置修订号',
    boundAt: '绑定时间',
    statusLabel: '目录状态',
    'status.UNBOUND': '尚未绑定目录',
    'status.READY': '目录及工作区注册已核验',
    'status.MISSING_DIRECTORY': '已保存的目录不存在',
    'status.REGISTRY_MISSING': '工作区注册记录不存在',
    'status.PERMISSION_DENIED': '没有目录访问权限',
    'status.PATH_DRIFT': '工作区路径与已保存的绑定不一致',
    limits: 'P2 范围与限制',
    scope: 'FUX-01 与 FRUN-01 提供 Agents、Skills、Runs、成果、审核、数据源、设置和原生未提交草稿。Run 仅在用户消息持久化后建立，并记录真实 Session 事件。成果生成、Office 业务执行和金融业务端到端闭环仍不在范围内。',
    boundaries: '不会发布报告、发送客户资料、正式记账、执行交易或资金操作，也不会代替人工完成最终合规签字。',
    switching: '更换绑定仅影响未来的新任务；不会移动或删除已有会话、文件和历史。',
    hostLimits: 'Host 返回的限制',
    guidanceTitle: '设置金融工作目录',
    guidance: '在后续使用金融任务前，请选择真实存在的目录。已保存的绑定及引导版本均从 Host 配置恢复。',
    open: '打开 Financial Services',
    details: '打开 Bundle 详情',
    dismiss: '暂不设置',
    unknownError: '操作失败，但未返回错误信息。',
    rejected: 'Host 拒绝了此目录绑定。',
    required: '请输入或选择真实存在目录的绝对路径。',
    requestFailed: '请求失败，请查看下方错误后重试。',
    cancelled: 'Financial Services 已卸载；如有在途绑定保存或原生草稿，请重新启用后核对其最终状态。',
    configDataTitle: '财务数据运行时', configReviewTitle: '财务审核策略',
    configTimeout: '请求超时（毫秒）', configConcurrency: '最大并发查询数',
    configPolicy: '审核策略', configCustomJson: '自定义策略 JSON',
    configSave: '保存配置', configSaving: '正在保存配置…', configSaved: '已通过 Host 原生配置编辑器保存。',
    configLoading: '正在读取 Host 当前配置…', configUnavailable: 'Host 当前配置值不可用。',
    configConflict: '配置已被其他操作修改，请重新载入此页后再保存。',
    configSaveFailed: 'Host 拒绝了此配置更新。', configInvalid: '请输入符合范围与策略规则的值。',
    navAgents: 'Agents', navSkills: 'Skills', navRuns: 'Runs', navDeliverables: '成果', navReviews: '审核', navData: '数据源', navSettings: '设置',
    domainBankingResearch: '银行与研究', domainAdvisoryModeling: '顾问与建模', domainRiskControl: '风险与控制', domainFundOperations: '基金运营', domainOther: '其他',
    agentHomeTitle: '选择金融 Agent', agentHomeHint: '可用状态反映已安装的原生 Preset 与已声明的 Skill 资产，不代表查询成功或业务已执行。',
    agentNoResults: '没有匹配的 Agent。', viewAgent: '查看 Agent 详情',
    searchAgents: '按名称、说明、业务领域或依赖搜索 Agent', statusCanDraft: '可准备原生草稿', statusPartial: '存在依赖缺口', statusUnavailable: '原生 Preset 不可用',
    detailOverview: '概览', detailCapabilities: '能力', detailDependencies: '依赖', detailHistory: '历史', backAgents: '返回 Agents', agentDetails: 'Agent 详情',
    availabilityHint: '创建草稿还要求 Workspace 就绪。此状态不推断模型、数据源或商业服务访问权限。',
    standardTask: '标准任务', chooseTask: '选择原生命令或 Steering 模板', freeChat: '自由对话', taskNone: '此 Agent 未声明标准模板。',
    freeChatHint: '使用此 Agent Preset 打开原生 DSH 聊天草稿；不会提交提示词。', dependencyNote: '服务允许列表不代表已连接、已配置凭据、已获授权或查询成功。',
    noWorkerDetails: '未声明所属 Worker 详情。', noSkillDetails: '未声明作用域 Skill。', advancedInfo: '高级实现信息',
    settingsIntro: '工作区绑定、配置和实现诊断。工作区更改仅影响未来的原生草稿。', pageRunsIntro: 'Runs 来源于持久化的用户消息和原生 Session 事件。'
  }
  const CSS = `
.finance-p2 { box-sizing: border-box; color: var(--dsw-alias-label-primary); font: inherit; line-height: 1.55; min-width: 0; }
.finance-p2--page { height: 100%; overflow: auto; padding: clamp(16px, 4vw, 40px); background: var(--dsw-alias-bg-base); }
.finance-p2__body { max-width: 880px; margin: 0 auto; display: grid; gap: 20px; }
.finance-p2 h1 { font-size: 24px; margin: 0; font-weight: 600; }
.finance-p2 h2 { font-size: 17px; margin: 0 0 12px; font-weight: 600; }
.finance-p2 p { margin: 8px 0; }
.finance-p2__eyebrow, .finance-p2__hint { color: var(--dsw-alias-label-secondary); font-size: 13px; }
.finance-p2__card { border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; padding: clamp(14px, 3vw, 24px); background: var(--dsw-alias-bg-layer-1); min-width: 0; }
.finance-p2__facts { display: grid; grid-template-columns: minmax(110px, 1fr) minmax(0, 3fr); gap: 8px 16px; margin: 16px 0; }
.finance-p2 dt { color: var(--dsw-alias-label-secondary); }
.finance-p2 dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.finance-p2__form { display: grid; gap: 10px; margin-top: 20px; }
.finance-p2 input, .finance-p2 select { box-sizing: border-box; width: 100%; min-width: 0; padding: 10px 12px; border: 1px solid var(--dsw-alias-label-tertiary); border-radius: 8px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font: inherit; }
.finance-p2 input[type="checkbox"] { width: auto; min-width: 16px; min-height: 16px; padding: 0; }
.finance-p2 input::placeholder { color: var(--dsw-alias-label-secondary); }
.finance-p2__actions { display: flex; flex-wrap: wrap; gap: 10px; }
.finance-p2 button { min-height: 38px; max-width: 100%; border: 1px solid var(--dsw-alias-label-tertiary); border-radius: 8px; padding: 8px 14px; font: inherit; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-button-elevated-fill); cursor: pointer; }
.finance-p2 button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.finance-p2 button.finance-p2__primary { background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-inverted); }
.finance-p2 button:disabled, .finance-p2 input:disabled { opacity: .55; cursor: not-allowed; }
.finance-p2 :focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 3px; }
.finance-p2__error { color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 95%, var(--dsw-alias-label-primary)); overflow-wrap: anywhere; }
.finance-p2__badge { display: inline-block; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; padding: 2px 8px; font-size: 13px; }
.finance-p2 ul { margin: 8px 0; padding-inline-start: 22px; }
.finance-p2 li { overflow-wrap: anywhere; }
.finance-p2 textarea { box-sizing: border-box; width: 100%; min-height: 90px; padding: 10px; border: 1px solid var(--dsw-alias-label-tertiary); border-radius: 8px; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); font: inherit; resize: vertical; }
.finance-p2 details { border-top: 1px solid var(--dsw-alias-border-l2); padding-block: 12px; min-width: 0; }
.finance-p2 summary { cursor: pointer; overflow-wrap: anywhere; font-weight: 600; }
.finance-p2__list { display: grid; gap: 12px; }
.finance-p2__nav { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 10px; margin: 8px 0 16px; }
.finance-p2__nav button[aria-current="page"] { border-color: var(--dsw-alias-state-business-primary); background: var(--dsw-alias-interactive-bg-hover); }
.finance-p2__agent-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 12px; }
.finance-p2__agent-card { min-width: 0; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); padding: 16px; }
.finance-p2__tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
.finance-p2__tabs [aria-selected="true"] { border-color: var(--dsw-alias-state-business-primary); background: var(--dsw-alias-interactive-bg-hover); }
@media (max-width: 520px) { .finance-p2__facts { grid-template-columns: minmax(0, 1fr); gap: 3px; } .finance-p2 dd { margin-bottom: 9px; } .finance-p2__actions button { flex: 1 1 180px; } .finance-p2__tabs button { flex: 1 1 120px; } }
`

  function failureOf(error) {
    return {
      code: typeof error?.code === 'string' ? error.code : 'gateway/internal',
      message: typeof error?.message === 'string' ? error.message : String(error),
      details: error?.details ?? {},
    }
  }

  function ErrorNotice({ error, t, id }) {
    if (!error) return null
    return h('p', { role: 'alert', id, className: 'finance-p2__error' },
      error.code ? `${error.code}: ` : '', error.message || t('unknownError'))
  }

  function RowConfiguration({ t, view, kind, getRowConfig, saveRowConfig }) {
    const rowId = kind === 'data' ? 'finance-data' : 'finance-review'
    const [readState, setReadState] = React.useState({ status: 'loading' })
    const [config, setConfig] = React.useState(null)
    const [draft, setDraft] = React.useState(null)
    const [saveState, setSaveState] = React.useState('idle')
    const [saveError, setSaveError] = React.useState('')
    React.useEffect(() => {
      let active = true
      setReadState({ status: 'loading' })
      Promise.resolve().then(() => getRowConfig?.()).then(remote => {
        if (!active) return
        if (!remote?.ok) {
          setReadState({ status: 'unavailable', message: remote?.error?.message ?? t('configUnavailable') })
          return
        }
        const result = remote.value
        if (result?.status !== 'READY') {
          setReadState({ status: 'unavailable', message: result?.error?.message ?? t('configUnavailable') })
          return
        }
        const value = JSON.parse(result.configJson)
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid configuration shape')
        setConfig(value)
        setDraft(value)
        setReadState({ status: 'ready' })
      }).catch(() => {
        if (active) setReadState({ status: 'unavailable', message: t('configUnavailable') })
      })
      setSaveState('idle')
      setSaveError('')
      return () => { active = false }
    }, [rowId, view])

    const summary = readState.status === 'ready'
      ? kind === 'data'
        ? `${t('configTimeout')}: ${config.requestTimeoutMs} · ${t('configConcurrency')}: ${config.maxConcurrentQueries}`
        : `${t('configPolicy')}: ${config.policyId}`
      : readState.status === 'loading' ? t('configLoading') : readState.message
    if (view === 'summary') return h('span', null, summary)

    if (readState.status !== 'ready' || !config || !draft) {
      return h('section', { className: 'finance-p2 finance-p2__card', role: readState.status === 'unavailable' ? 'alert' : 'status' },
        h('h2', null, t(kind === 'data' ? 'configDataTitle' : 'configReviewTitle')),
        h('p', { className: 'finance-p2__hint' }, summary))
    }

    const saving = saveState === 'saving'
    const valueOf = key => draft[key] ?? config[key]
    const input = (key, label, min, max) => {
      const id = `finance-config-${kind}-${key}`
      return h('label', { htmlFor: id, className: 'finance-p2__field' },
        h('span', null, label),
        h('input', { id, type: 'number', min, max, step: 1, value: String(valueOf(key)), disabled: saving,
          onChange: event => setDraft({ ...draft, [key]: event.target.value === '' ? '' : Number(event.target.value) }) }))
    }
    const submit = async event => {
      event?.preventDefault?.()
      if (saving) return
      const next = kind === 'data'
        ? { requestTimeoutMs: valueOf('requestTimeoutMs'), maxConcurrentQueries: valueOf('maxConcurrentQueries') }
        : { policyId: valueOf('policyId'), customJson: valueOf('customJson') }
      if (kind === 'data' && (!Number.isInteger(next.requestTimeoutMs) || next.requestTimeoutMs < 1 || next.requestTimeoutMs > 300000
        || !Number.isInteger(next.maxConcurrentQueries) || next.maxConcurrentQueries < 1 || next.maxConcurrentQueries > 128)) {
        setSaveState('invalid'); return
      }
      if (kind === 'review' && (!['original', 'fast', 'strict', 'custom'].includes(next.policyId)
        || next.policyId === 'custom' && !next.customJson.trim()
        || next.policyId !== 'custom' && next.customJson.trim())) { setSaveState('invalid'); return }
      if (kind === 'review' && next.customJson.trim()) {
        try { JSON.parse(next.customJson) } catch { setSaveState('invalid'); return }
      }
      setSaveState('saving')
      setSaveError('')
      try {
        const remote = await saveRowConfig?.({ expectedJson: JSON.stringify(config), configJson: JSON.stringify(next) })
        if (!remote?.ok) {
          setSaveError(remote?.error?.message ?? t('configSaveFailed'))
          setSaveState('failed')
          return
        }
        const result = remote.value
        if (result?.status === 'APPLIED') {
          setConfig(next); setDraft(next); setSaveState('saved')
        } else if (result?.status === 'CONFLICT') setSaveState('conflict')
        else {
          setSaveError(result?.error?.message ?? t('configSaveFailed'))
          setSaveState('failed')
        }
      } catch { setSaveError(t('configSaveFailed')); setSaveState('failed') }
    }

    return h('section', { className: 'finance-p2 finance-p2__card', 'aria-live': 'polite' },
      h('h2', null, t(kind === 'data' ? 'configDataTitle' : 'configReviewTitle')),
      kind === 'data'
        ? h('div', { className: 'finance-p2__form' },
          input('requestTimeoutMs', t('configTimeout'), 1, 300000),
          input('maxConcurrentQueries', t('configConcurrency'), 1, 128))
        : h('div', { className: 'finance-p2__form' },
          h('label', { htmlFor: 'finance-config-review-policy', className: 'finance-p2__field' },
            h('span', null, t('configPolicy')),
            h('select', { id: 'finance-config-review-policy', value: String(valueOf('policyId')), disabled: saving,
              onChange: event => setDraft({ ...draft, policyId: event.target.value, ...(event.target.value === 'custom' ? {} : { customJson: '' }) }) },
              ...['original', 'fast', 'strict', 'custom'].map(policyId => h('option', { key: policyId, value: policyId }, policyId)))),
          h('label', { htmlFor: 'finance-config-review-json', className: 'finance-p2__field' },
            h('span', null, t('configCustomJson')),
            h('textarea', { id: 'finance-config-review-json', value: String(valueOf('customJson') ?? ''), disabled: saving,
              onChange: event => setDraft({ ...draft, customJson: event.target.value }) }))),
      h('div', { className: 'finance-p2__actions' },
        h('button', { type: 'button', disabled: saving, onClick: submit }, saving ? t('configSaving') : t('configSave'))),
      saveState === 'saved' ? h('p', { className: 'finance-p2__hint', role: 'status' }, t('configSaved')) : null,
      saveState === 'conflict' ? h('p', { className: 'finance-p2__error', role: 'alert' }, t('configConflict')) : null,
      saveState === 'failed' ? h('p', { className: 'finance-p2__error', role: 'alert' }, saveError || t('configSaveFailed')) : null,
      saveState === 'invalid' ? h('p', { className: 'finance-p2__error', role: 'alert' }, t('configInvalid')) : null)
  }

  const FinanceDataRowConfig = props => h(RowConfiguration, { ...props, kind: 'data' })
  const FinanceReviewRowConfig = props => h(RowConfiguration, { ...props, kind: 'review' })

  function FinanceIcon({ size }) {
    return h('svg', { width: size, height: size, viewBox: '0 0 32 32', fill: 'none', 'aria-hidden': true, focusable: false },
      h('path', { d: 'M5 6h14l8 8v12H5V6Z', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round' }),
      h('path', { d: 'M19 6v8h8M10 22v-4m6 4v-8m6 8v-4', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }))
  }

  function DraftAction({ t, startDraft, agent, ready, commandId, steeringId, allowPrompt = false }) {
    const [prompt, setPrompt] = React.useState('')
    const [busy, setBusy] = React.useState(false)
    const [result, setResult] = React.useState(null)
    const fieldId = React.useId()
    const enabled = ready && agent.mountStatus === 'AVAILABLE' && !busy
    async function prepare() {
      if (!enabled) return
      setBusy(true)
      setResult(null)
      try {
        const request = { agentId: agent.id }
        if (commandId !== undefined) request.commandId = commandId
        else if (steeringId !== undefined) request.steeringId = steeringId
        else if (allowPrompt && prompt.trim()) request.prompt = prompt
        setResult(await startDraft(request))
      } catch (error) {
        setResult({ status: 'REMOTE_ERROR', error: failureOf(error) })
      } finally { setBusy(false) }
    }
    const messages = { DRAFT_READY: 'draftReady', REJECTED: 'draftRejected', REMOTE_ERROR: 'draftRemoteError', START_FAILED: 'draftStartFailed', CANCELLED: 'draftCancelled' }
    return h('div', { className: 'finance-p2__form', 'aria-busy': busy },
      allowPrompt ? h(React.Fragment, null,
        h('label', { htmlFor: fieldId }, t('draftPrompt')),
        h('textarea', { id: fieldId, value: prompt, maxLength: 64000, disabled: busy, 'aria-describedby': `${fieldId}-hint`, onChange: event => setPrompt(event.target.value) })) : null,
      h('p', { id: `${fieldId}-hint`, className: 'finance-p2__hint' }, t('draftHint')),
      !enabled && !busy ? h('p', { className: 'finance-p2__hint' }, t('draftNotReady')) : null,
      h('div', { className: 'finance-p2__actions' }, h('button', { type: 'button', disabled: !enabled, onClick: prepare },
        `${t(busy ? 'drafting' : 'draft')}${allowPrompt ? '' : ` · ${agent.name}`}`)),
      result ? h('p', { role: result.status === 'DRAFT_READY' ? 'status' : 'alert' }, t(messages[result.status] ?? 'requestFailed')) : null,
      h(ErrorNotice, { error: result?.error, t }))
  }

  function RoleFacts({ role, t }) {
    const facts = [
      ['preset', role.id], ['mount', t(role.mountStatus === 'AVAILABLE' ? 'available' : 'unavailablePreset')],
      ['diagnostic', role.diagnostic ?? t('empty')], ['writer', t(role.writer ? 'yes' : 'no')], ['shell', t(role.shellRestricted ? 'yes' : 'no')],
      ['tools', role.builtinTools.join(', ') || t('empty')], ['mcp', role.allowedMcpServers.join(', ') || t('empty')],
      ['roleSkills', role.skillNames.join(', ') || t('empty')], ['workerIds', role.workerPresetIds.join(', ') || t('empty')],
      ['sourcePath', role.sourcePath], ['sourceSha', role.sourceSha256], ['promptSha', role.adaptedPromptSha256],
    ]
    return h(React.Fragment, null, h('p', null, role.description),
      h('dl', { className: 'finance-p2__facts' }, facts.map(([key, value]) =>
        h(React.Fragment, { key }, h('dt', null, t(key)), h('dd', null, value)))))
  }

  function Catalogue({ t, useResource, startDraft, ready }) {
    const resource = useResource(CATALOG_ADDRESS)
    const catalog = resource.value
    const [search, setSearch] = React.useState('')
    const searchId = React.useId()
    const canDraft = ready && resource.status === 'live'
    const query = search.trim().toLocaleLowerCase()
    const skills = catalog?.skills.filter(skill => [skill.name, skill.description, skill.assetStatus, ...skill.issues].join(' ').toLocaleLowerCase().includes(query)) ?? []
    return h('section', { className: 'finance-p2__card', 'aria-busy': resource.status === 'loading' },
      h('h2', null, t('catalog')),
      resource.status === 'loading' ? h('p', { role: 'status' }, t('catalogLoading')) : null,
      resource.status === 'none' ? h('p', { role: 'status' }, t('catalogUnavailable')) : null,
      resource.status === 'failed' ? h('p', { role: 'alert' }, t('catalogStale')) : null,
      h(ErrorNotice, { error: resource.failure, t }),
      catalog ? h(React.Fragment, null,
        h('dl', { className: 'finance-p2__facts' }, h('dt', null, t('sourceTreeSha')), h('dd', null, catalog.sourceTreeSha256)),
        h('h2', null, `${t('agents')} · ${catalog.agents.length}`),
        h('p', { className: 'finance-p2__hint' }, t('workerVisibility')),
        catalog.agents.map(agent => h('details', { key: agent.id },
          h('summary', null, `${agent.name} · ${agent.mountStatus}`),
          h(RoleFacts, { role: agent, t }),
          h(DraftAction, { t, startDraft, agent, ready: canDraft, allowPrompt: true }),
          h('h3', null, t('workers')),
          catalog.workers.filter(worker => worker.parentId === agent.id && agent.workerPresetIds.includes(worker.id)).map(worker =>
            h('details', { key: worker.id }, h('summary', null, worker.name), h(RoleFacts, { role: worker, t }))),
          h('h3', null, t('steering')),
          catalog.steering.filter(item => item.targetPresetId === agent.id).map(item => h('details', { key: item.id },
            h('summary', null, item.title), h(DraftAction, { t, startDraft, agent, ready: canDraft, steeringId: item.id }))))),
        h('details', null, h('summary', null, `${t('commands')} · ${catalog.commands.length}`),
          h('p', { className: 'finance-p2__hint' }, t('commandHint')),
          catalog.commands.map(command => {
            const targets = catalog.agents.filter(agent => command.targetPresetIds.includes(agent.id))
            return h('details', { key: command.id }, h('summary', null, command.name),
              h('dl', { className: 'finance-p2__facts' }, h('dt', null, t('sourcePath')), h('dd', null, command.sourcePath)),
              command.selectionRequired ? h('p', null, t('commandSelection')) : null,
              h('p', null, t(targets.length ? 'chooseRole' : 'noTargets')),
              targets.map(agent => h(DraftAction, { key: agent.id, t, startDraft, agent, ready: canDraft, commandId: command.id })))
          })),
        h('details', null, h('summary', null, `${t('skills')} · ${catalog.skills.length}`),
          h('p', { className: 'finance-p2__hint' }, t('skillHint')),
          h('label', { htmlFor: searchId }, t('skillSearch')),
          h('input', { id: searchId, type: 'search', value: search, onChange: event => setSearch(event.target.value) }),
          skills.length === 0 ? h('p', { role: 'status' }, t('noSkills')) : null,
          skills.map(skill => h('details', { key: skill.name }, h('summary', null, `${skill.name} · ${skill.assetStatus}`),
            h('p', null, skill.description), h('p', null, `${t('assetStatus')}: ${skill.assetStatus}`),
            h('p', { className: 'finance-p2__hint' }, t('issues')),
            skill.issues.length ? h('ul', null, skill.issues.map((issue, index) => h('li', { key: index }, issue))) : h('p', null, t('empty'))))),
        catalog.limitations.length ? h(React.Fragment, null, h('h3', null, t('hostLimits')),
          h('ul', null, catalog.limitations.map((limit, index) => h('li', { key: index }, limit)))) : null) : null)
  }

  const DOMAIN_BY_SLUG = {
    'pitch-agent': 'domainBankingResearch', 'market-researcher': 'domainBankingResearch', 'earnings-reviewer': 'domainBankingResearch',
    'meeting-prep-agent': 'domainAdvisoryModeling', 'model-builder': 'domainAdvisoryModeling',
    'gl-reconciler': 'domainRiskControl', 'kyc-screener': 'domainRiskControl',
    'valuation-reviewer': 'domainFundOperations', 'month-end-closer': 'domainFundOperations', 'statement-auditor': 'domainFundOperations',
  }

  function hasAgentGaps(agent, catalog) {
    const skillNames = agent.skillNames ?? []
    const skills = skillNames.map(name => catalog.skills.find(skill => skill.name === name)).filter(Boolean)
    const workerIds = agent.workerPresetIds ?? []
    const workers = workerIds.map(id => catalog.workers.find(worker => worker.id === id)).filter(Boolean)
    return skills.length !== skillNames.length || skills.some(skill => skill.assetStatus !== 'AVAILABLE' || skill.issues.length > 0)
      || workers.length !== workerIds.length || workers.some(worker => worker.parentId !== agent.id || worker.mountStatus !== 'AVAILABLE')
  }

  function AgentHome({ t, useResource, startDraft, ready, runClient, runProps }) {
    const resource = useResource(CATALOG_ADDRESS)
    const catalog = resource.value
    const [search, setSearch] = React.useState('')
    const [selectedId, setSelectedId] = React.useState(null)
    const [detailTab, setDetailTab] = React.useState('overview')
    const searchId = React.useId()
    const query = search.trim().toLocaleLowerCase()
    if (resource.status === 'loading' && !catalog) return h('p', { role: 'status' }, t('catalogLoading'))
    if (!catalog) return h('p', { role: resource.status === 'failed' ? 'alert' : 'status' }, t(resource.status === 'failed' ? 'catalogStale' : 'catalogUnavailable'))
    const agents = catalog.agents.filter(agent => [agent.name, agent.description, agent.slug, t(DOMAIN_BY_SLUG[agent.slug] ?? 'domainOther')]
      .join(' ').toLocaleLowerCase().includes(query))
    const selected = selectedId ? catalog.agents.find(agent => agent.id === selectedId) : null
    if (selected) return h(AgentDetails, { key: selected.id, t, catalog, agent: selected, ready, startDraft, useResource, runClient, runProps,
      activeTab: detailTab, setActiveTab: setDetailTab, back: () => { setSelectedId(null); setDetailTab('overview') } })
    const groups = new Map()
    for (const agent of agents) {
      const domain = t(DOMAIN_BY_SLUG[agent.slug] ?? 'domainOther')
      groups.set(domain, [...(groups.get(domain) ?? []), agent])
    }
    return h('section', { className: 'finance-p2__list', 'aria-busy': resource.status === 'loading' },
      h('h2', null, t('agentHomeTitle')), h('p', { className: 'finance-p2__hint' }, t('agentHomeHint')),
      h('label', { htmlFor: searchId }, t('searchAgents')),
      h('input', { id: searchId, type: 'search', value: search, onChange: event => setSearch(event.target.value) }),
      agents.length === 0 ? h('p', { role: 'status' }, t('agentNoResults')) : null,
      [...groups.entries()].map(([domain, items]) => h('section', { key: domain }, h('h3', null, domain),
        h('div', { className: 'finance-p2__agent-grid' }, items.map(agent => {
          const gaps = hasAgentGaps(agent, catalog)
          const state = agent.mountStatus !== 'AVAILABLE' ? 'statusUnavailable' : gaps ? 'statusPartial' : 'statusCanDraft'
          return h('article', { key: agent.id, className: 'finance-p2__agent-card' },
            h('h4', null, agent.name), h('p', { className: 'finance-p2__hint' }, domain),
            h('p', null, agent.description), h('p', { className: 'finance-p2__badge' }, t(state)),
            h('button', { type: 'button', onClick: () => { setSelectedId(agent.id); setDetailTab('overview') } }, t('viewAgent')))
        })))))
  }

  function AgentDetails({ t, catalog, agent, ready, startDraft, useResource, runClient, runProps, activeTab, setActiveTab, back }) {
    const tabs = [['overview', 'detailOverview'], ['capabilities', 'detailCapabilities'], ['dependencies', 'detailDependencies'], ['history', 'detailHistory']]
    const commands = catalog.commands.filter(item => item.targetPresetIds.includes(agent.id))
    const steering = catalog.steering.filter(item => item.targetPresetId === agent.id)
    const options = [...commands.map(item => ({ id: item.id, label: item.name, kind: 'command' })),
      ...steering.map(item => ({ id: item.id, label: item.title, kind: 'steering' }))]
    const [selectedTask, setSelectedTask] = React.useState('')
    const task = options.find(item => `${item.kind}:${item.id}` === selectedTask)
    const workers = catalog.workers.filter(worker => worker.parentId === agent.id && agent.workerPresetIds.includes(worker.id))
    const skills = (agent.skillNames ?? []).map(name => catalog.skills.find(skill => skill.name === name)).filter(Boolean)
    const availability = agent.mountStatus !== 'AVAILABLE' ? 'statusUnavailable' : hasAgentGaps(agent, catalog) ? 'statusPartial' : 'statusCanDraft'
    const content = activeTab === 'overview' ? h(React.Fragment, null,
      h('p', null, agent.description), h('p', { className: 'finance-p2__badge' }, t(availability)),
      h('p', { className: 'finance-p2__hint' }, t('availabilityHint')),
      h('h3', null, t('standardTask')),
      options.length ? h(React.Fragment, null,
        h('label', { htmlFor: 'finance-standard-task' }, t('chooseTask')),
        h('select', { id: 'finance-standard-task', value: selectedTask, onChange: event => setSelectedTask(event.target.value) },
          h('option', { value: '' }, t('chooseTask')),
          options.map(item => h('option', { key: `${item.kind}:${item.id}`, value: `${item.kind}:${item.id}` }, item.label))),
        task ? h(DraftAction, { t, startDraft, agent, ready, allowPrompt: false,
          ...(task.kind === 'command' ? { commandId: task.id } : { steeringId: task.id }) }) : null)
        : h('p', { className: 'finance-p2__hint' }, t('taskNone')),
      h('h3', null, t('freeChat')),
      h('p', { className: 'finance-p2__hint' }, t('freeChatHint')),
      h(DraftAction, { t, startDraft, agent, ready, allowPrompt: false }))
      : activeTab === 'capabilities' ? h(React.Fragment, null,
        h('h3', null, t('workers')),
        workers.length ? h('ul', null, workers.map(worker => h('li', { key: worker.id }, `${worker.name}: ${worker.description}`))) : h('p', null, t('noWorkerDetails')),
        h('h3', null, t('skills')),
        skills.length ? h('ul', null, skills.map(skill => h('li', { key: skill.name }, `${skill.name} · ${skill.assetStatus}`))) : h('p', null, t('noSkillDetails')),
        h('p', { className: 'finance-p2__hint' }, t('workerVisibility')))
      : activeTab === 'dependencies' ? h(React.Fragment, null,
        h('h3', null, t('mcp')), h('ul', null, (agent.allowedMcpServers ?? []).map(id => h('li', { key: id }, id))),
        h('p', { className: 'finance-p2__hint' }, t('dependencyNote')),
        h('h3', null, t('issues')),
        skills.map(skill => h('article', { key: skill.name }, h('strong', null, `${skill.name} · ${skill.assetStatus}`),
          skill.issues.length ? h('ul', null, skill.issues.map((issue, index) => h('li', { key: index }, issue))) : h('p', null, t('empty')))))
      : runClient?.RecentPanel ? h(runClient.RecentPanel, { ...runProps, useResource, agentFilter: agent.id }) : h('p', null, t('pageRunsIntro'))
    return h('section', { className: 'finance-p2__card' },
      h('button', { type: 'button', onClick: back }, t('backAgents')),
      h('h2', null, agent.name), h('div', { className: 'finance-p2__tabs', role: 'tablist', 'aria-label': t('agentDetails') },
        tabs.map(([id, label]) => h('button', { key: id, type: 'button', role: 'tab', 'aria-selected': activeTab === id,
          onClick: () => setActiveTab(id) }, t(label)))),
      h('div', { role: 'tabpanel' }, content))
  }

  function SkillsPage({ t, useResource }) {
    const resource = useResource(CATALOG_ADDRESS)
    const catalog = resource.value
    const [search, setSearch] = React.useState('')
    const searchId = React.useId()
    const query = search.trim().toLocaleLowerCase()
    const skills = catalog?.skills.filter(skill => [skill.name, skill.description, skill.assetStatus, ...skill.issues].join(' ').toLocaleLowerCase().includes(query)) ?? []
    return h('section', { className: 'finance-p2__card', 'aria-busy': resource.status === 'loading' },
      h('h2', null, t('skills')), resource.status === 'loading' ? h('p', { role: 'status' }, t('catalogLoading')) : null,
      resource.status === 'failed' ? h('p', { role: 'alert' }, t('catalogStale')) : null,
      h('label', { htmlFor: searchId }, t('skillSearch')),
      h('input', { id: searchId, type: 'search', value: search, onChange: event => setSearch(event.target.value) }),
      skills.length === 0 ? h('p', { role: 'status' }, t('noSkills')) : null,
      skills.map(skill => h('article', { key: skill.name }, h('h3', null, `${skill.name} · ${skill.assetStatus}`),
        h('p', null, skill.description), skill.issues.length ? h('ul', null, skill.issues.map((issue, index) => h('li', { key: index }, issue))) : h('p', null, t('empty')))))
  }

  function WorkspaceForm({ t, resource, snapshot, facts, draft, setDraft, activity, busy, canBind, choose, submit, actionError, hintId, fieldId, errorId }) {
    return h('section', { className: 'finance-p2__card' }, h('h2', null, t('workspace')),
      resource.status === 'loading' ? h('p', { role: 'status' }, t('loading')) : null,
      resource.status === 'none' ? h('p', { role: 'status' }, t('unavailable')) : null,
      resource.status === 'failed' ? h('p', { role: 'alert', className: 'finance-p2__error' }, t('stale')) : null,
      h(ErrorNotice, { error: resource.failure, t }),
      snapshot ? h(React.Fragment, null, h('span', { className: 'finance-p2__badge' }, t(snapshot.binding ? 'saved' : 'unbound')),
        h('dl', { className: 'finance-p2__facts' }, facts.map(([key, value]) => h(React.Fragment, { key }, h('dt', null, t(key)), h('dd', null, value)))),
        h(ErrorNotice, { error: snapshot.error, t })) : null,
      h('form', { className: 'finance-p2__form', onSubmit: submit, 'aria-busy': busy },
        h('label', { htmlFor: fieldId }, t('path')),
        h('input', { id: fieldId, type: 'text', value: draft, placeholder: t('pathPlaceholder'), disabled: busy, autoComplete: 'off', spellCheck: false,
          'aria-describedby': `${hintId}${actionError ? ` ${errorId}` : ''}`, 'aria-invalid': Boolean(actionError), onChange: event => setDraft(event.target.value) }),
        h('p', { id: hintId, className: 'finance-p2__hint' }, t('pathHint')),
        h('div', { className: 'finance-p2__actions' }, h('button', { type: 'button', onClick: choose, disabled: busy }, t(activity === 'pick' ? 'picking' : 'pick')),
          h('button', { type: 'submit', disabled: !canBind || draft.trim() === '', className: 'finance-p2__primary' }, t(activity === 'bind' ? 'saving' : 'save'))),
        h(ErrorNotice, { error: actionError, t, id: errorId })), h('p', { className: 'finance-p2__hint' }, t('switching')))
  }

  function WorkspacePage(props) {
    const { t, useResource, bindWorkspace, pickDirectory } = props
    const resource = useResource(ADDRESS)
    const snapshot = resource.value
    const [draft, setDraft] = React.useState('')
    const [activity, setActivity] = React.useState(null)
    const [actionError, setActionError] = React.useState(null)
    const fieldId = React.useId()
    const hintId = `${fieldId}-hint`
    const errorId = `${fieldId}-error`
    const busy = activity !== null
    const canBind = resource.status === 'live' && !busy

    async function choose() {
      setActivity('pick')
      setActionError(null)
      try {
        const selected = await pickDirectory()
        if (selected !== null) setDraft(selected)
      } catch (error) {
        setActionError(failureOf(error))
      } finally {
        setActivity(null)
      }
    }

    async function submit(event) {
      event.preventDefault()
      if (!canBind) return
      if (draft.trim() === '') {
        setActionError({ message: t('required') })
        return
      }
      setActivity('bind')
      setActionError(null)
      try {
        const result = await bindWorkspace({ path: draft, expectedRevision: snapshot.revision })
        if (!result.ok) setActionError(result.error)
        else if (result.value.status !== 'BOUND') setActionError(result.value.error ?? { message: t('rejected') })
        // Saved facts arrive only through the resource, never a second snapshot cache.
      } catch (error) {
        setActionError(failureOf(error))
      } finally {
        setActivity(null)
      }
    }

    const catalogResource = useResource(CATALOG_ADDRESS)
    const [page, setPage] = React.useState('agents')
    const facts = snapshot ? [
      ['statusLabel', t(`status.${snapshot.workspaceStatus}`)],
      ['revision', String(snapshot.revision)],
      ...(snapshot.binding ? [
        ['canonicalPath', snapshot.binding.path],
        ['workspaceId', snapshot.binding.workspaceId],
        ['boundAt', snapshot.binding.boundAt],
      ] : []),
    ] : []

    if (props.view === 'summary') return h('span', null, t('stage'))
    const runProps = props.runProps ?? {}
    const ready = resource.status === 'live' && snapshot?.workspaceStatus === 'READY'
    const pages = [['agents', 'navAgents'], ['skills', 'navSkills'], ['runs', 'navRuns'], ['deliverables', 'navDeliverables'],
      ['reviews', 'navReviews'], ['data', 'navData'], ['settings', 'navSettings']]
    let content
    if (page === 'agents') content = h(AgentHome, { t, useResource, startDraft: props.startDraft, ready, runClient, runProps })
    else if (page === 'skills') content = h(SkillsPage, { t, useResource })
    else if (page === 'runs') content = runClient?.RecentPanel ? h(runClient.RecentPanel, { ...runProps, useResource }) : h('p', { role: 'status' }, t('unavailable'))
    else if (page === 'deliverables') content = workbenchClient ? h(workbenchClient.Panel, { ...props, section: 'deliverables' }) : h('p', { role: 'status' }, t('unavailable'))
    else if (page === 'reviews') content = reviewClient ? h(reviewClient.Panel, props) : h('p', { role: 'status' }, t('unavailable'))
    else if (page === 'data') content = dataClient ? h(dataClient.Panel, props) : h('p', { role: 'status' }, t('unavailable'))
    else content = h(React.Fragment, null,
      h('p', { className: 'finance-p2__hint' }, t('settingsIntro')),
      h(WorkspaceForm, { t, resource, snapshot, facts, draft, setDraft, activity, busy, canBind, choose, submit, actionError, hintId, fieldId, errorId }),
      h('section', { className: 'finance-p2__card' }, h('h2', null, t('limits')), h('p', null, t('scope')),
        h('p', { className: 'finance-p2__hint' }, t('boundaries')),
        snapshot?.limitations?.length ? h(React.Fragment, null, h('h3', null, t('hostLimits')),
          h('ul', null, snapshot.limitations.map(limit => h('li', { key: limit }, limit)))) : null),
      h('details', { className: 'finance-p2__card' }, h('summary', null, t('advancedInfo')),
        catalogResource.value ? h(React.Fragment, null,
          catalogResource.status === 'failed' ? h('p', { role: 'alert' }, t('catalogStale')) : null,
          h('p', { className: 'finance-p2__hint' }, `${t('sourceTreeSha')}: ${catalogResource.value.sourceTreeSha256}`),
          catalogResource.value.agents.map(agent => h('details', { key: agent.id }, h('summary', null, agent.name), h(RoleFacts, { role: agent, t })))
        ) : h('p', { role: catalogResource.status === 'failed' ? 'alert' : 'status' }, t(catalogResource.status === 'failed' ? 'catalogStale' : 'catalogUnavailable'))))
    return h('section', { className: 'finance-p2 finance-p2--page', 'aria-busy': busy || resource.status === 'loading' },
      h('style', null, CSS),
      h('div', { className: 'finance-p2__body' },
        h('header', null, h('p', { className: 'finance-p2__eyebrow' }, t('stage')), h('h1', null, t('title')),
          h('p', { className: 'finance-p2__hint' }, t('introduction'))),
        h('nav', { className: 'finance-p2__nav', 'aria-label': t('title') }, pages.map(([id, label]) =>
          h('button', { key: id, type: 'button', 'aria-current': page === id ? 'page' : undefined, onClick: () => setPage(id) }, t(label)))),
        page === 'runs' ? h('p', { className: 'finance-p2__hint' }, t('pageRunsIntro')) : null,
        content))
  }

  function ActivationGuide(props) {
    const { t } = props
    const resource = props.useResource(ADDRESS)
    const snapshot = resource.value
    if (snapshot && (snapshot.binding !== null || snapshot.onboardingVersion >= ONBOARDING_VERSION)) return null
    return h('section', { className: 'finance-p2 finance-p2__card' },
      h('style', null, CSS),
      h('h2', null, t('guidanceTitle')),
      h('p', null, t('guidance')),
      resource.status === 'loading' ? h('p', { role: 'status' }, t('loading')) : null,
      resource.status === 'none' ? h('p', { role: 'status' }, t('unavailable')) : null,
      resource.status === 'failed' ? h('p', { role: 'alert', className: 'finance-p2__error' }, t('stale')) : null,
      h(ErrorNotice, { error: resource.failure, t }),
      h('div', { className: 'finance-p2__actions' },
        h('button', { type: 'button', onClick: () => { props.openWorkbench(); props.onDismiss() } }, t('open')),
        h('button', { type: 'button', onClick: props.onOpenDetails }, t('details')),
        h('button', { type: 'button', onClick: props.onDismiss }, t('dismiss'))))
  }

  return {
    inject: ['slots', 'remote', 'resources', 'uiWorkspace', 'layout', 'locale', 'sidebarRightTabs'],
    async apply(rootCtx) {
      await rootCtx.remote.$mount(createFinanceContract(z).remote)
      if (dataClient) await rootCtx.remote.$mount(dataClient.remote)
      if (reviewClient) await rootCtx.remote.$mount(reviewClient.remote)
      if (runClient) await rootCtx.remote.$mount(runClient.remote)
      // Every mounted namespace is explicitly injected before any callback captures it.
      rootCtx.inject(['remote.financeOperations', ...(dataClient ? ['remote.financeData'] : []), ...(reviewClient ? ['remote.financeReview'] : []), ...(runClient ? ['remote.financeRuns'] : [])], ctx => {
      const dataProps = dataClient ? dataClient.install(ctx) : {}
      const reviewProps = reviewClient ? reviewClient.install(ctx) : {}
      const workbenchProps = workbenchClient ? workbenchClient.install(ctx) : {}
      const lifetime = new AbortController()
      ctx.effect(() => () => lifetime.abort(), 'financial-services: callback lifetime')
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'financial-services: dictionaries')
      const t = ctx.locale.bind(NS)
      // Old callbacks may finish after dictionary disposal; capture their cancellation copy while owned.
      const cancellationMessage = t('cancelled')
      const stopped = () => ({ ok: false, error: { code: 'gateway/cancelled', message: cancellationMessage, details: {} } })
      const bindWorkspace = async request => {
        if (lifetime.signal.aborted) return stopped()
        const result = await ctx.remote.financeOperations.bindWorkspace(request)
        return lifetime.signal.aborted ? stopped() : result
      }
      // Return a draft intent, never a Session ID or an execution-success state.
      const draftFailure = (status, error, intent = {}) => ({
        workspaceId: null, agentPreset: null, prompt: '', whenDraftExists: 'keep', autoSubmit: false,
        ...intent, status, error,
      })
      const startDraft = async request => {
        if (lifetime.signal.aborted) return draftFailure('CANCELLED', stopped().error)
        let result
        try { result = await ctx.remote.financeOperations.prepareDraft(request) }
        catch (error) { return draftFailure(lifetime.signal.aborted ? 'CANCELLED' : 'REMOTE_ERROR', lifetime.signal.aborted ? stopped().error : failureOf(error)) }
        if (lifetime.signal.aborted) return draftFailure('CANCELLED', stopped().error)
        if (!result.ok) return draftFailure('REMOTE_ERROR', result.error)
        const intent = result.value
        if (intent.status !== 'DRAFT_READY') return intent
        try {
          // uiWorkspace.startSession returns void. Native Workspace owns cwd and existing-draft behavior.
          await ctx.uiWorkspace.startSession(intent.workspaceId, {
            agentPreset: intent.agentPreset, prompt: intent.prompt, whenDraftExists: 'keep',
          })
          return lifetime.signal.aborted ? draftFailure('CANCELLED', stopped().error, intent) : intent
        } catch (error) {
          return draftFailure(lifetime.signal.aborted ? 'CANCELLED' : 'START_FAILED', lifetime.signal.aborted ? stopped().error : failureOf(error), intent)
        }
      }
      const pickDirectory = async () => {
        if (lifetime.signal.aborted) throw stopped().error
        const selected = await ctx.uiWorkspace.pickDirectory()
        if (lifetime.signal.aborted) throw stopped().error
        return selected
      }
      const openWorkbench = () => {
        if (!lifetime.signal.aborted) ctx.layout.selectPanel(PANEL)
      }
      ctx.effect(() => ctx.resources.register({
        protocol: 'finance-workspace',
        async *open(address, { signal }) {
          if (signal.aborted || lifetime.signal.aborted) return
          if (address !== ADDRESS) {
            yield { ok: false, error: { code: 'gateway/bad-request', message: address, details: {} } }
            return
          }
          const stream = ctx.remote.$stream({
            name: 'financial-services workspace',
            async *open(generationSignal) {
              try {
                // Every reopened generation reads a fresh baseline; follow also begins with a complete Host snapshot.
                const initial = await ctx.remote.financeOperations.snapshot({})
                if (generationSignal.aborted) return
                yield initial
                // Streaming invocations yield decoded Snapshots, unlike unary RemoteResults.
                for await (const value of ctx.remote.financeOperations.follow({}, generationSignal)) yield { ok: true, value }
              } catch (error) {
                if (generationSignal.aborted) return
                // Publish stale state before the native supervisor waits for a new carrier generation.
                yield { ok: false, error: failureOf(error) }
                throw error
              }
            },
            ended: () => new Error('financial-services workspace follow ended'),
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
      }), 'financial-services: workspace resource')
      ctx.effect(() => ctx.resources.register({
        protocol: 'finance-catalog',
        async *open(address, { signal }) {
          if (signal.aborted || lifetime.signal.aborted) return
          if (address !== CATALOG_ADDRESS) {
            yield { ok: false, error: { code: 'gateway/bad-request', message: address, details: {} } }
            return
          }
          try {
            const result = await ctx.remote.financeOperations.catalog({})
            if (!signal.aborted && !lifetime.signal.aborted) yield result
          } catch (error) {
            if (!signal.aborted && !lifetime.signal.aborted) yield { ok: false, error: failureOf(error) }
          }
        },
      }), 'financial-services: catalogue resource')
      const runProps = runClient ? runClient.install(ctx) : {}
      if (runClient) runClient.registerTabs(ctx)
      const inject = () => ({ bindWorkspace, pickDirectory, openWorkbench, startDraft, runProps, ...dataProps, ...reviewProps, ...workbenchProps })
      const rowConfigInject = rowId => () => ({
        getRowConfig: () => ctx.remote.financeOperations.rowConfig({ rowId }),
        saveRowConfig: request => ctx.remote.financeOperations.saveRowConfig({ rowId, ...request }),
      })
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL, locale: NS, inject }, WorkspacePage))
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: PANEL, order: 30, label: () => t('title'), locale: NS,
      }, FinanceIcon))
      ctx.slots.inject('plugins.bundle.activation', () => ctx.slots.register({
        name: 'plugins.bundle.activation', key: PACKAGE, locale: NS, inject,
      }, ActivationGuide))
      // Plugin Manager row configuration is keyed by `<bundle package>#<row id>`.
      // Do not put the Financial Services workbench in the bundle-config slot: that slot is a settings page.
      ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config', key: `${PACKAGE}#finance-data`, locale: NS, inject: rowConfigInject('finance-data'),
      }, FinanceDataRowConfig))
      ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config', key: `${PACKAGE}#finance-review`, locale: NS, inject: rowConfigInject('finance-review'),
      }, FinanceReviewRowConfig))
      })
    },
  }
}
