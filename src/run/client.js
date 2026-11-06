/** Client read model, native right-sidebar tabs, and recent Run navigation. */
export function createFinanceRunsClient(React, z, createRemoteContract) {
  const h = React.createElement
  const NS = 'financialServicesRuns'
  const PREFIX = 'dsh-resource://finance-run/session/'
  const RECENT_ADDRESS = 'dsh-resource://finance-run/recent'
  const kinds = [
    { kind: 'finance-run-progress', id: '@local/dsh-financial-services/run-progress', title: 'progress', description: 'progressDescription', panel: 'progress' },
    { kind: 'finance-run-inputs', id: '@local/dsh-financial-services/run-inputs', title: 'inputs', description: 'inputsDescription', panel: 'inputs' },
    { kind: 'finance-run-outputs', id: '@local/dsh-financial-services/run-outputs', title: 'outputs', description: 'outputsDescription', panel: 'outputs' },
    { kind: 'finance-run-diagnostics', id: '@local/dsh-financial-services/run-diagnostics', title: 'diagnostics', description: 'diagnosticsDescription', panel: 'diagnostics' },
  ]
  const en = {
    meta: { title: 'Finance Runs', description: 'Read-only Session-linked finance task progress and diagnostics.' },
    progress: 'Progress', inputs: 'Inputs', outputs: 'Outputs', diagnostics: 'Diagnostics', runs: 'Runs', tool: 'Tool', worker: 'Worker', model: 'Model', modelAttempt: 'Model attempt with no committed assistant message',
    progressDescription: 'Real Session, turn, step, tool, and Worker events; no estimated completion.',
    inputsDescription: 'Submitted message identity and Session reference; message content stays in native Chat.',
    outputsDescription: 'Recorded assistant message references; view content in native Chat.',
    diagnosticsDescription: 'Recorded tool, turn, Worker, and restart diagnostic codes.',
    loading: 'Loading persisted Run facts…', unavailable: 'FinanceRun data is unavailable.', stale: 'The latest Run snapshot could not be read.',
    empty: 'No persisted FinanceRun is recorded for this Session.', noEvents: 'No events of this type are recorded.',
    submitted: 'Submitted message', agent: 'Agent', status: 'Status', created: 'Submitted at', session: 'Session',
    phase: 'Phase', attempt: 'Attempt', output: 'Assistant message', message: 'Message', event: 'Event', seq: 'Session event',
    code: 'Code', source: 'Source', started: 'Started', ended: 'Ended', openSession: 'Open Session', refresh: 'Refresh',
    pruned: 'Older Runs omitted by configured retention', partial: 'Interrupted output prefix', transcript: 'Open the native Session to read message content.',
    statusLabel: { SUBMITTED: 'Submitted', RUNNING: 'Running', COMPLETED: 'Completed', FAILED: 'Failed', BLOCKED: 'Blocked', PARTIAL: 'Partial', INTERRUPTED: 'Interrupted', ABORTED: 'Aborted', ENDED: 'Ended', NO_MESSAGE: 'No assistant message', NO_RESULT: 'No tool result recorded' },
  }
  const zh = {
    meta: { title: 'Finance Runs', description: '只读展示与原生 Session 关联的金融任务进度和诊断。' },
    progress: '进度', inputs: '输入', outputs: '输出', diagnostics: '诊断', runs: 'Runs', tool: '工具', worker: 'Worker', model: '模型', modelAttempt: '未提交助手消息的模型尝试',
    progressDescription: '真实 Session、轮次、步骤、工具和 Worker 事件；不估算完成率。',
    inputsDescription: '已提交消息身份与 Session 引用；消息内容保留在原生聊天中。',
    outputsDescription: '记录的助手消息引用；内容请在原生聊天中查看。',
    diagnosticsDescription: '记录的工具、轮次、Worker 和重启诊断代码。',
    loading: '正在读取持久化 Run 事实…', unavailable: 'FinanceRun 数据不可用。', stale: '无法读取最新 Run 快照。',
    empty: '此 Session 尚无已记录的 FinanceRun。', noEvents: '没有此类事件记录。',
    submitted: '提交的消息', agent: 'Agent', status: '状态', created: '提交时间', session: 'Session',
    phase: '阶段', attempt: '尝试', output: '助手消息', message: '消息', event: '事件', seq: 'Session 事件',
    code: '代码', source: '来源', started: '开始', ended: '结束', openSession: '打开 Session', refresh: '刷新',
    pruned: '更早的 Run 已按保留设置移除', partial: '中断前输出片段', transcript: '打开原生 Session 查看消息内容。',
    statusLabel: { SUBMITTED: '已提交', RUNNING: '运行中', COMPLETED: '已完成', FAILED: '失败', BLOCKED: '受阻', PARTIAL: '部分完成', INTERRUPTED: '中断', ABORTED: '已取消', ENDED: '已结束', NO_MESSAGE: '未生成助手消息', NO_RESULT: '未记录工具结果' },
  }
  const Status = z.enum(['SUBMITTED', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED', 'PARTIAL', 'INTERRUPTED', 'ABORTED'])
  const Run = z.strictObject({ runId: z.string(), sessionId: z.string(), agentId: z.string(), taskType: z.string().nullable(), title: z.string().nullable(),
    subject: z.string().nullable(), sourceSeq: z.number().int().nonnegative(), messageId: z.string(), createdAt: z.number().int().nonnegative(),
    status: Status, turnNumber: z.number().int().nonnegative().nullable(), phases: z.array(z.record(z.string(), z.unknown())),
    attempts: z.array(z.record(z.string(), z.unknown())), outputs: z.array(z.record(z.string(), z.unknown())),
    diagnostics: z.array(z.record(z.string(), z.unknown())), timeline: z.array(z.record(z.string(), z.unknown())) })
  const RecentRun = z.strictObject({ runId: z.string(), sessionId: z.string(), agentId: z.string(), taskType: z.string().nullable(), title: z.string().nullable(),
    subject: z.string().nullable(), sourceSeq: z.number().int().nonnegative(), messageId: z.string(), createdAt: z.number().int().nonnegative(), status: Status })
  const Snapshot = z.strictObject({ version: z.literal(1), revision: z.number().int().nonnegative(), sessionId: z.string(), runs: z.array(Run) })
  const Recent = z.strictObject({ version: z.literal(1), revision: z.number().int().nonnegative(), prunedRuns: z.number().int().nonnegative(), runs: z.array(RecentRun) })
  const CSS = `
    .finance-run { color: var(--dsw-alias-label-primary); font: inherit; min-width: 0; }
    .finance-run__card { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 16px; margin: 8px 0; min-width: 0; }
    .finance-run__meta { color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
    .finance-run__list { list-style: none; margin: 0; padding: 0; }
    .finance-run__list > li { border-top: 1px solid var(--dsw-alias-border-l1); padding: 10px 0; overflow-wrap: anywhere; }
    .finance-run__status { color: var(--dsw-alias-brand-primary); font-weight: 600; }
    .finance-run button { font: inherit; }
    @media (max-width: 700px) { .finance-run__card { padding: 12px; } }
  `
  const failureOf = error => ({ code: String(error?.code ?? 'gateway/failed'), message: String(error?.message ?? error), details: {} })
  const timeText = value => new Date(value).toLocaleString()
  const statusText = (t, status) => t(`statusLabel.${status}`)
  const decode = (remote, type) => {
    const text = type === 'snapshot' ? remote?.snapshotJson : remote?.runsJson
    const parsed = JSON.parse(text)
    return (type === 'snapshot' ? Snapshot : Recent).parse(parsed)
  }

  function rows(items, render, key, emptyText) {
    return items.length ? h('ul', { className: 'finance-run__list' }, items.map(item => h('li', { key: key(item) }, render(item))))
      : h('p', { role: 'status' }, emptyText)
  }

  function RunTab({ sessionId, useResource, runKind, runT: t }) {
    const address = `${PREFIX}${encodeURIComponent(sessionId)}`
    const resource = useResource(address)
    const state = resource.value
    const run = state?.runs?.[0]
    const fail = resource.status === 'failed' ? h('p', { role: 'alert' }, t('stale')) : null
    const loading = resource.status === 'loading' ? h('p', { role: 'status' }, t('loading')) : null
    if (!run) return h('section', { className: 'finance-run', 'aria-busy': resource.status === 'loading' }, h('style', null, CSS), loading, fail,
      resource.status === 'none' ? h('p', { role: 'status' }, t('unavailable')) : null,
      resource.status !== 'loading' && resource.status !== 'failed' ? h('p', { role: 'status' }, t('empty')) : null)
    let content
    if (runKind === 'progress') content = h(React.Fragment, null,
      h('p', null, `${t('status')}: `, h('strong', { className: 'finance-run__status' }, statusText(t, run.status))),
      h('p', { className: 'finance-run__meta' }, `${t('agent')}: ${run.agentId} · ${t('submitted')}: ${run.messageId} · ${t('seq')}: ${run.sourceSeq}`),
      h('h3', null, t('phase')),
      rows(run.phases, item => `${item.name} · ${statusText(t, item.status)} · ${timeText(item.startedAt)}${item.endedAt ? ` — ${timeText(item.endedAt)}` : ''}${item.errorCode ? ` · ${t('code')}: ${item.errorCode}` : ''}`,
        item => item.phaseId, t('noEvents')),
      h('h3', null, t('attempt')),
      rows(run.attempts, item => {
        const kind = t(item.kind)
        const name = item.kind === 'model' ? t('modelAttempt') : item.name
        return `${kind}: ${name} · ${statusText(t, item.status)}${item.targetSessionId ? ` · ${item.targetSessionId}` : ''}${item.errorCode ? ` · ${t('code')}: ${item.errorCode}` : ''}`
      }, item => item.attemptId, t('noEvents')),
      h('h3', null, t('event')),
      rows(run.timeline.slice().reverse(), item => `${timeText(item.time)} · ${item.kind} · ${t('seq')}: ${item.seq}${item.code ? ` · ${t('code')}: ${item.code}` : ''}`,
        item => `${item.sessionId}:${item.seq}:${item.kind}`, t('noEvents')))
    else if (runKind === 'inputs') content = h(React.Fragment, null,
      h('p', { className: 'finance-run__meta' }, `${t('agent')}: ${run.agentId} · ${t('created')}: ${timeText(run.createdAt)}`),
      h('p', null, `${t('message')}: ${run.messageId} · ${t('seq')}: ${run.sourceSeq}`), h('p', { className: 'finance-run__meta' }, t('transcript')))
    else if (runKind === 'outputs') content = h(React.Fragment, null,
      rows(run.outputs, item => `${t('output')}: ${item.messageId} · ${t('seq')}: ${item.seq} · ${timeText(item.time)}${item.interrupted ? ` · ${t('partial')}` : ''}`,
        item => `${item.messageId}:${item.seq}`, t('noEvents')), h('p', { className: 'finance-run__meta' }, t('transcript')))
    else content = rows(run.diagnostics, item => `${timeText(item.time)} · ${t('code')}: ${item.code} · ${t('source')}: ${item.source} · ${t('seq')}: ${item.eventSeq}`,
      item => `${item.source}:${item.eventSeq}:${item.code}`, t('noEvents'))
    return h('section', { className: 'finance-run', 'aria-busy': resource.status === 'loading' }, h('style', null, CSS),
      h('article', { className: 'finance-run__card' }, h('h2', null, t(runKind)),
        h('p', { className: 'finance-run__meta' }, `${t('status')}: ${statusText(t, run.status)} · ${t('created')}: ${timeText(run.createdAt)}`), content))
  }

  function RecentPanel({ runT: t, openSession, agentFilter, useResource }) {
    const resource = useResource(RECENT_ADDRESS)
    const recent = resource.value
    const runs = (recent?.runs ?? []).filter(run => !agentFilter || run.agentId === agentFilter)
    return h('section', { className: 'finance-run', 'aria-busy': resource.status === 'loading' }, h('style', null, CSS),
      h('header', { className: 'finance-run__card' }, h('h2', null, t('runs'))),
      resource.status === 'loading' && !recent ? h('p', { role: 'status' }, t('loading')) : null,
      resource.status === 'failed' ? h('p', { role: 'alert' }, t('stale')) : null,
      recent?.prunedRuns ? h('p', { className: 'finance-run__meta' }, `${recent.prunedRuns} ${t('pruned')}`) : null,
      runs.length === 0 && resource.status === 'live' ? h('p', { role: 'status' }, t('empty')) : null,
      h('ul', { className: 'finance-run__list' }, runs.map(run => h('li', { key: run.runId },
        h('article', { className: 'finance-run__card' }, h('strong', null, run.title ?? run.agentId),
          h('p', { className: 'finance-run__meta' }, `${statusText(t, run.status)} · ${timeText(run.createdAt)} · ${run.sessionId}`),
          h('p', null, `${t('submitted')}: ${run.messageId} · ${t('seq')}: ${run.sourceSeq}`),
          h('button', { type: 'button', onClick: () => openSession(run.sessionId) }, t('openSession'))))))
    )
  }

  function install(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'financial-services-runs: dictionaries')
    const runT = ctx.locale.bind(NS)
    const openSession = sessionId => ctx.uiWorkspace.openSession(sessionId)
    const makeStream = address => ctx.remote.$stream({
      name: 'financial-services FinanceRun',
      async *open(signal) {
        try {
          if (address === RECENT_ADDRESS) {
            for await (const value of ctx.remote.financeRuns.followRecent({ limit: 100 }, signal)) {
              if (signal.aborted) return
              yield { ok: true, value: decode(value, 'recent') }
            }
            return
          }
          const sessionId = decodeURIComponent(address.slice(PREFIX.length))
          if (!sessionId) throw Object.assign(new Error('Missing Session id'), { code: 'gateway/bad-request' })
          const initial = await ctx.remote.financeRuns.snapshot({ sessionId })
          if (signal.aborted) return
          yield { ok: true, value: decode(initial, 'snapshot') }
          for await (const value of ctx.remote.financeRuns.follow({ sessionId }, signal)) {
            if (signal.aborted) return
            yield { ok: true, value: decode(value, 'snapshot') }
          }
        } catch (error) {
          if (signal.aborted) return
          yield { ok: false, error: failureOf(error) }
          throw error
        }
      },
      ended: () => new Error('FinanceRun follow ended'),
    })
    ctx.effect(() => ctx.resources.register({
      protocol: 'finance-run',
      async *open(address, { signal }) {
        if (address !== RECENT_ADDRESS && !address.startsWith(PREFIX)) {
          yield { ok: false, error: { code: 'gateway/bad-request', message: 'Unknown FinanceRun address', details: {} } }
          return
        }
        if (address !== RECENT_ADDRESS) {
          try { decodeURIComponent(address.slice(PREFIX.length)) }
          catch (error) { yield { ok: false, error: failureOf(error) }; return }
        }
        const stream = makeStream(address)
        const close = () => { void stream.dispose() }
        signal.addEventListener('abort', close, { once: true })
        try {
          for await (const item of stream) { if (signal.aborted) return; item.accept(); yield item.value }
        } finally {
          signal.removeEventListener('abort', close)
          close()
        }
      },
    }), 'financial-services-runs: resource')
    return { runT, openSession }
  }

  function registerTabs(ctx) {
    const runT = ctx.locale.bind(NS)
    for (const entry of kinds) {
      const definition = { id: entry.id, kind: entry.kind, keepMounted: true,
        title: () => runT(entry.title), guide: [{ id: entry.panel, order: 100 + kinds.indexOf(entry),
          title: () => runT(entry.title), description: () => runT(entry.description) }] }
      const Body = props => h(RunTab, { ...props, runKind: entry.panel, runT })
      ctx.effect(() => {
        const disposeTabType = ctx.sidebarRightTabs.register(definition)
        ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: definition.id }, Body))
        return () => disposeTabType()
      }, `financial-services-runs: ${entry.kind}`)
    }
  }

  const remote = createRemoteContract(z).remote
  return { remote, install, registerTabs, RecentPanel, RunTab }
}
