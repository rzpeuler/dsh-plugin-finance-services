/** Browser-serialized workbench overview: read-only aggregation with per-card degradation. */
export function createWorkbenchClient(React, z, createFinanceContract) {
  const h = React.createElement
  const NS = 'financial-workbench-ui'
  const messages = {
    en: {
      title: 'Financial workbench', loading: 'Reading workspace state…', refresh: 'Refresh',
      workspace: 'Workspace', binding: 'Binding', unbound: 'Unbound', bound: 'Bound', revision: 'Revision',
      roles: 'Roles', agents: 'Main agents', workers: 'Workers', dataSources: 'Data sources',
      adapters: 'Registered adapters', policy: 'Source policy', reviews: 'Review queue',
      sessions: 'Sessions', items: 'Checkpoints', pending: 'Pending', decided: 'Decided',
      unavailable: 'Unavailable', degraded: 'Some cards could not be read.', readOnly: 'Read-only overview; actions live in their own sections.',
      source: 'Source', notConfigured: 'Not configured', fingerprint: 'digest',
      runsTitle: 'Runs', deliverablesTitle: 'Deliverables', classification: 'Classification', bytes: 'Bytes',
      sha: 'Content hash', noRuns: 'No run has recorded a stage yet.', noDeliverables: 'No deliverable has been indexed yet.',
      checkpoints: 'Checkpoints', items: 'items',
    },
    zh: {
      title: '金融工作台', loading: '正在读取工作区状态…', refresh: '刷新',
      workspace: '工作区', binding: '绑定', unbound: '未绑定', bound: '已绑定', revision: '修订',
      roles: '角色', agents: '主 Agent', workers: 'Worker', dataSources: '数据源',
      adapters: '已注册适配器', policy: '来源策略', reviews: '审核队列',
      sessions: '会话', items: '检查点', pending: '待审', decided: '已决',
      unavailable: '不可用', degraded: '部分卡片读取失败。', readOnly: '只读概览；操作在各分区内完成。',
      source: '来源', notConfigured: '未配置', fingerprint: '摘要',
      runsTitle: '运行', deliverablesTitle: '成果', classification: '分类', bytes: '字节',
      sha: '内容哈希', noRuns: '尚无运行记录阶段。', noDeliverables: '尚无成果被索引。',
      checkpoints: '检查点', items: '项',
    },
  }

  const ok = (value, source) => ({ ok: true, value, source })
  const fail = (code, source) => ({ ok: false, code, source })

  function decodeWorkspace(payload) {
    if (!payload || payload.ok !== true) return fail(payload?.error?.code ?? 'gateway/unavailable', 'financeOperations.snapshot')
    const snapshot = payload.value
    if (!snapshot || typeof snapshot !== 'object' || !Number.isInteger(snapshot.revision)) return fail('gateway/bad-snapshot', 'financeOperations.snapshot')
    return ok({ binding: snapshot.binding === null ? null : (typeof snapshot.binding === 'object' ? snapshot.binding : null),
      workspaceStatus: typeof snapshot.workspaceStatus === 'string' ? snapshot.workspaceStatus : 'UNKNOWN',
      revision: snapshot.revision }, 'financeOperations.snapshot')
  }

  function decodeCatalogue(payload) {
    if (!payload || payload.ok !== true) return fail(payload?.error?.code ?? 'gateway/unavailable', 'financeOperations.catalog')
    const catalogue = payload.value
    if (!catalogue || !Array.isArray(catalogue.agents) || !Array.isArray(catalogue.workers)) return fail('gateway/bad-catalogue', 'financeOperations.catalog')
    return ok({ agents: catalogue.agents.length, workers: catalogue.workers.length }, 'financeOperations.catalog')
  }

  function decodeDataSources(payload) {
    if (!payload || payload.ok !== true) return fail(payload?.error?.code ?? 'gateway/unavailable', 'financeData.catalog')
    let catalog
    try { catalog = JSON.parse(payload.value.catalogJson) } catch { return fail('gateway/bad-json', 'financeData.catalog') }
    if (!catalog || !Array.isArray(catalog.adapters) || !Array.isArray(catalog.bindings)) return fail('gateway/bad-catalog', 'financeData.catalog')
    return ok({ adapters: catalog.adapters.length, bindings: catalog.bindings.length,
      revision: Number.isInteger(catalog.revision) ? catalog.revision : 0 }, 'financeData.catalog')
  }

  function decodeReviews(payload) {
    if (!payload || payload.ok !== true) return fail(payload?.error?.code ?? 'gateway/unavailable', 'financeReview.reviewSummary')
    let summary
    try { summary = JSON.parse(payload.value.summaryJson) } catch { return fail('gateway/bad-json', 'financeReview.reviewSummary') }
    const totals = summary?.totals
    if (!totals || !Number.isInteger(totals.sessions) || !Number.isInteger(totals.items)) return fail('gateway/bad-totals', 'financeReview.reviewSummary')
    return ok({ sessions: totals.sessions, items: totals.items,
      pending: Number.isInteger(totals.pending) ? totals.pending : 0,
      decided: Number.isInteger(totals.decided) ? totals.decided : 0,
      revision: Number.isInteger(summary.revision) ? summary.revision : 0 }, 'financeReview.reviewSummary')
  }

  function decodeRuns(payload) {
    if (!payload || payload.ok !== true) return fail(payload?.error?.code ?? 'gateway/unavailable', 'financeReview.reviewRuns')
    let parsed
    try { parsed = JSON.parse(payload.value.runsJson) } catch { return fail('gateway/bad-json', 'financeReview.reviewRuns') }
    if (!parsed || !Array.isArray(parsed.runs) || parsed.runs.length > 200) return fail('gateway/bad-runs', 'financeReview.reviewRuns')
    const runs = []
    for (const run of parsed.runs) {
      if (!run || typeof run.runId !== 'string' || !run.checkpoints || typeof run.checkpoints !== 'object') return fail('gateway/bad-run', 'financeReview.reviewRuns')
      if (!Array.isArray(run.agents) || !Array.isArray(run.sessions)) return fail('gateway/bad-run', 'financeReview.reviewRuns')
      runs.push({ runId: run.runId, agents: run.agents.slice(0, 8), sessions: run.sessions.slice(0, 8),
        checkpoints: Object.fromEntries(Object.entries(run.checkpoints).slice(0, 12)),
        classification: typeof run.classification === 'string' ? run.classification : 'UNKNOWN',
        deliverableCount: Number.isInteger(run.deliverableCount) ? run.deliverableCount : 0 })
    }
    return ok({ runs, revision: Number.isInteger(parsed.deliverableRevision) ? parsed.deliverableRevision : 0 }, 'financeReview.reviewRuns')
  }

  function decodeDeliverables(payload) {
    if (!payload || payload.ok !== true) return fail(payload?.error?.code ?? 'gateway/unavailable', 'financeReview.reviewDeliverables')
    let parsed
    try { parsed = JSON.parse(payload.value.deliverablesJson) } catch { return fail('gateway/bad-json', 'financeReview.reviewDeliverables') }
    if (!parsed || !Array.isArray(parsed.deliverables) || parsed.deliverables.length > 200) return fail('gateway/bad-deliverables', 'financeReview.reviewDeliverables')
    const items = []
    for (const item of parsed.deliverables) {
      if (!item || typeof item.path !== 'string' || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) return fail('gateway/bad-deliverable', 'financeReview.reviewDeliverables')
      if (!Number.isInteger(item.bytes) || typeof item.classification !== 'string') return fail('gateway/bad-deliverable', 'financeReview.reviewDeliverables')
      items.push({ path: item.path.slice(0, 512), sha256: item.sha256, bytes: item.bytes,
        classification: item.classification, sessionId: typeof item.sessionId === 'string' ? item.sessionId : null,
        runId: typeof item.runId === 'string' ? item.runId : null, reviewId: typeof item.reviewId === 'string' ? item.reviewId : null })
    }
    return ok({ items, revision: Number.isInteger(parsed.revision) ? parsed.revision : 0 }, 'financeReview.reviewDeliverables')
  }

  const shortId = value => (value ? String(value).slice(0, 18) : '—')
  const isOk = card => card?.ok === true
  const cardValue = card => (isOk(card) ? card.value : null)

  function card(t, title, body, state) {
    return h('li', { key: title, className: 'finance-p2__card' },
      h('strong', null, title),
      state.ok ? body : h('p', { className: 'finance-p2__error' }, `${t('unavailable')} (${state.code ?? 'unknown'})`),
      h('p', { className: 'finance-p2__meta' }, `${t('source')}: ${state.source}`))
  }

  function Panel({ workbenchT: t, loadOverview }) {
    const [state, setState] = React.useState({ status: 'loading', cards: null, error: null })
    const refresh = () => {
      setState(previous => ({ ...previous, status: 'loading' }))
      Promise.resolve().then(() => loadOverview())
        .then(cards => setState({ status: 'ready', cards, error: null }))
        .catch(error => setState({ status: 'error', cards: null, error: error?.code ?? 'gateway/failed' }))
    }
    React.useEffect(refresh, [])
    const cards = state.cards
    const loading = state.status === 'loading' && !cards ? h('p', null, t('loading')) : null
    const degraded = cards && [cards.workspace, cards.roles, cards.dataSources, cards.reviews, cards.runs, cards.deliverables].some(value => !isOk(value))
      ? h('p', { className: 'finance-p2__error' }, t('degraded')) : null
    const workspace = cardValue(cards?.workspace)
    const roles = cardValue(cards?.roles)
    const data = cardValue(cards?.dataSources)
    const reviews = cardValue(cards?.reviews)
    const runs = cardValue(cards?.runs)
    const deliverables = cardValue(cards?.deliverables)
    const list = cards ? h('ul', { className: 'finance-p2__list' }, [
      card(t, t('workspace'), workspace ? h('p', null,
        `${t('binding')}: ${workspace.binding ? t('bound') : t('unbound')} · ${workspace.workspaceStatus} · ${t('revision')}: ${workspace.revision}`)
        : null, cards.workspace),
      card(t, t('roles'), roles ? h('p', null, `${t('agents')}: ${roles.agents} · ${t('workers')}: ${roles.workers}`) : null, cards.roles),
      card(t, t('dataSources'), data ? h('p', null,
        `${t('adapters')}: ${data.adapters} · ${t('policy')}: ${data.bindings} · ${t('revision')}: ${data.revision}`)
        : null, cards.dataSources),
      card(t, t('runsTitle'), runs ? (runs.runs.length === 0 ? h('p', null, t('noRuns'))
        : h('ul', { className: 'finance-p2__list' }, runs.runs.slice(0, 10).map(run => h('li', { key: run.runId },
          `${shortId(run.runId)} · ${run.classification} · ${t('checkpoints')}: ${Object.entries(run.checkpoints).map(([id, state]) => `${id}=${state}`).join(', ')} · ${t('deliverablesTitle')}: ${run.deliverableCount}`)))) : null, cards.runs),
      card(t, t('deliverablesTitle'), deliverables ? (deliverables.items.length === 0 ? h('p', null, t('noDeliverables'))
        : h('ul', { className: 'finance-p2__list' }, deliverables.items.slice(0, 10).map(item => h('li', { key: `${item.runId}:${item.sha256}` },
          `${item.path} · ${t('bytes')}: ${item.bytes} · ${t('classification')}: ${item.classification} · ${t('sha')}: ${item.sha256.slice(0, 12)}…`)))) : null, cards.deliverables),
      card(t, t('reviews'), reviews ? h('p', null,
        `${t('sessions')}: ${reviews.sessions} · ${t('items')}: ${reviews.items} · ${t('pending')}: ${reviews.pending} · ${t('decided')}: ${reviews.decided}`)
        : null, cards.reviews),
    ]) : null
    return h('section', { className: 'finance-p2__card', 'aria-live': 'polite' },
      h('header', { className: 'finance-p2__head' },
        h('h3', null, t('title')),
        h('button', { type: 'button', onClick: refresh, disabled: state.status === 'loading' }, t('refresh'))),
      loading, degraded, list,
      state.status === 'error' ? h('p', { className: 'finance-p2__error' }, `${t('unavailable')} (${state.error})`) : null,
      h('p', { className: 'finance-p2__meta' }, t('readOnly')))
  }

  function install(ctx) {
    ctx.effect(() => ctx.locale.register(NS, messages), 'financial-workbench: dictionaries')
    const workbenchT = ctx.locale.bind(NS)
    const loadOverview = async () => {
      const [workspace, catalogue, data, reviews] = await Promise.all([
        ctx.remote.financeOperations.snapshot({}).then(payload => decodeWorkspace(payload)).catch(error => fail(error?.code ?? 'gateway/failed', 'financeOperations.snapshot')),
        ctx.remote.financeOperations.catalog({}).then(payload => decodeCatalogue(payload)).catch(error => fail(error?.code ?? 'gateway/failed', 'financeOperations.catalog')),
        ctx.remote.financeData
          ? ctx.remote.financeData.catalog({}).then(payload => decodeDataSources(payload)).catch(error => fail(error?.code ?? 'gateway/failed', 'financeData.catalog'))
          : Promise.resolve(fail('NOT_CONFIGURED', 'financeData.catalog')),
        ctx.remote.financeReview
          ? ctx.remote.financeReview.reviewSummary({}).then(payload => decodeReviews(payload)).catch(error => fail(error?.code ?? 'gateway/failed', 'financeReview.reviewSummary'))
          : Promise.resolve(fail('NOT_CONFIGURED', 'financeReview.reviewSummary')),
      ])
      const runs = ctx.remote.financeReview
        ? await ctx.remote.financeReview.reviewRuns({}).then(payload => decodeRuns(payload)).catch(error => fail(error?.code ?? 'gateway/failed', 'financeReview.reviewRuns'))
        : fail('NOT_CONFIGURED', 'financeReview.reviewRuns')
      const deliverables = ctx.remote.financeReview
        ? await ctx.remote.financeReview.reviewDeliverables({}).then(payload => decodeDeliverables(payload)).catch(error => fail(error?.code ?? 'gateway/failed', 'financeReview.reviewDeliverables'))
        : fail('NOT_CONFIGURED', 'financeReview.reviewDeliverables')
      return { workspace, roles: catalogue, dataSources: data, reviews, runs, deliverables }
    }
    return { workbenchT, loadOverview }
  }

  return { Panel, install, decodeWorkspace, decodeCatalogue, decodeDataSources, decodeReviews, decodeRuns, decodeDeliverables }
}
