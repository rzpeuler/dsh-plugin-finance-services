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
    },
    zh: {
      title: '金融工作台', loading: '正在读取工作区状态…', refresh: '刷新',
      workspace: '工作区', binding: '绑定', unbound: '未绑定', bound: '已绑定', revision: '修订',
      roles: '角色', agents: '主 Agent', workers: 'Worker', dataSources: '数据源',
      adapters: '已注册适配器', policy: '来源策略', reviews: '审核队列',
      sessions: '会话', items: '检查点', pending: '待审', decided: '已决',
      unavailable: '不可用', degraded: '部分卡片读取失败。', readOnly: '只读概览；操作在各分区内完成。',
      source: '来源', notConfigured: '未配置', fingerprint: '摘要',
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
    const degraded = cards && [cards.workspace, cards.roles, cards.dataSources, cards.reviews].some(value => !isOk(value))
      ? h('p', { className: 'finance-p2__error' }, t('degraded')) : null
    const workspace = cardValue(cards?.workspace)
    const roles = cardValue(cards?.roles)
    const data = cardValue(cards?.dataSources)
    const reviews = cardValue(cards?.reviews)
    const list = cards ? h('ul', { className: 'finance-p2__list' }, [
      card(t, t('workspace'), workspace ? h('p', null,
        `${t('binding')}: ${workspace.binding ? t('bound') : t('unbound')} · ${workspace.workspaceStatus} · ${t('revision')}: ${workspace.revision}`)
        : null, cards.workspace),
      card(t, t('roles'), roles ? h('p', null, `${t('agents')}: ${roles.agents} · ${t('workers')}: ${roles.workers}`) : null, cards.roles),
      card(t, t('dataSources'), data ? h('p', null,
        `${t('adapters')}: ${data.adapters} · ${t('policy')}: ${data.bindings} · ${t('revision')}: ${data.revision}`)
        : null, cards.dataSources),
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
      return { workspace, roles: catalogue, dataSources: data, reviews }
    }
    return { workbenchT, loadOverview }
  }

  return { Panel, install, decodeWorkspace, decodeCatalogue, decodeDataSources, decodeReviews }
}
