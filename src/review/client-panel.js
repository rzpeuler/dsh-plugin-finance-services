/** Browser-serialized factory: read-only review queue panel. It records no decisions. */
export function createReviewClient(React, z, createReviewContract) {
  const h = React.createElement
  const NS = 'financial-review-ui'
  const MAX_GROUPS = 200
  const MAX_ITEMS = 20
  const messages = {
    en: {
      title: 'Review queue', loading: 'Reading the review queue…', unavailable: 'Review service unavailable.',
      stale: 'The last read failed. Displayed rows are stale.', empty: 'No run has reached a review checkpoint yet.',
      refresh: 'Refresh', policy: 'Policy', version: 'Version', locked: 'Locked boundaries',
      sideEffects: 'External side effects', sessions: 'Sessions', items: 'Checkpoints', pending: 'Pending', decided: 'Decided',
      live: 'Live session', notLive: 'Session not live', unscoped: 'Unscoped run', preset: 'Preset', run: 'Session',
      checkpoint: 'Checkpoint', stage: 'Stage',
      readOnly: 'Read-only view. Approvals are recorded by the Host, never by this page.',
      more: 'more',
    },
    zh: {
      title: '审核队列', loading: '正在读取审核队列…', unavailable: '审核服务不可用。',
      stale: '上次读取失败，当前显示的是旧数据。', empty: '尚无运行到达审核检查点。',
      refresh: '刷新', policy: '策略', version: '版本', locked: '锁定边界',
      sideEffects: '外部副作用', sessions: '会话', items: '检查点', pending: '待审', decided: '已决',
      live: '会话在线', notLive: '会话已结束', unscoped: '未归入会话', preset: '预设', run: '会话',
      checkpoint: '检查点', stage: '阶段',
      readOnly: '只读视图：批准由 Host 记录，本页面从不写审批。',
      more: '更多',
    },
  }

  const fail = code => ({ ok: false, code })
  const isText = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max

  /** Structural validation only; it does not authenticate the Host or imply approval. */
  function decodeSummary(payload) {
    if (!payload || payload.ok !== true) return fail(payload?.error?.code ?? 'gateway/unavailable')
    let summary
    try { summary = JSON.parse(payload.value.summaryJson) } catch { return fail('gateway/bad-json') }
    if (!summary || typeof summary !== 'object') return fail('gateway/bad-summary')
    if (summary.source !== 'financial_review.domain/state') return fail('gateway/bad-source')
    if (!Number.isInteger(summary.revision) || summary.revision < 0) return fail('gateway/bad-revision')
    if (!Array.isArray(summary.groups) || summary.groups.length > MAX_GROUPS) return fail('gateway/bad-groups')
    const totals = summary.totals
    if (!totals || !Number.isInteger(totals.sessions) || !Number.isInteger(totals.items)
      || !Number.isInteger(totals.pending) || !Number.isInteger(totals.decided)) return fail('gateway/bad-totals')
    const groups = []
    for (const group of summary.groups) {
      if (!group || typeof group !== 'object' || typeof group.live !== 'boolean') return fail('gateway/bad-group')
      if (!['LIVE_SESSION', 'SESSION_NOT_LIVE', 'UNSCOPED_RUN'].includes(group.status)) return fail('gateway/bad-group')
      if (!Array.isArray(group.items) || group.items.length > 500) return fail('gateway/bad-items')
      const items = []
      for (const item of group.items) {
        if (!item || !isText(item.agentId, 128) || !isText(item.checkpointId, 96) || !isText(item.runId, 128)) return fail('gateway/bad-item')
        if (!['ALLOW', 'HOLD'].includes(item.decision) || !isText(item.reason, 96)) return fail('gateway/bad-item')
        items.push({ agentId: item.agentId, checkpointId: item.checkpointId, runId: item.runId,
          decision: item.decision, reason: item.reason,
          stageStatus: isText(item.stageStatus, 64) ? item.stageStatus : null })
      }
      groups.push({ sessionId: isText(group.sessionId, 128) ? group.sessionId : null, live: group.live,
        status: group.status, preset: isText(group.preset, 128) ? group.preset : null,
        pending: Number.isInteger(group.pending) ? group.pending : 0,
        decided: Number.isInteger(group.decided) ? group.decided : 0, items })
    }
    return { ok: true, summary: { revision: summary.revision,
      totals: { sessions: totals.sessions, items: totals.items, pending: totals.pending, decided: totals.decided }, groups } }
  }

  function decodePolicy(payload) {
    if (!payload || payload.ok !== true) return fail(payload?.error?.code ?? 'gateway/unavailable')
    let policy
    try { policy = JSON.parse(payload.value.policyJson) } catch { return fail('gateway/bad-json') }
    if (!policy || !isText(policy.policyId, 32) || !isText(policy.version, 64)) return fail('gateway/bad-policy')
    if (!/^[a-f0-9]{64}$/.test(String(policy.digest))) return fail('gateway/bad-digest')
    if (!Array.isArray(policy.lockedBoundaries)) return fail('gateway/bad-boundaries')
    return { ok: true, policy: { policyId: policy.policyId, version: policy.version, digest: policy.digest,
      locked: policy.lockedBoundaries.length, externalSideEffects: policy.externalSideEffects } }
  }

  const shortId = value => (value ? String(value).slice(0, 18) : '—')
  const groupState = (t, group) => group.status === 'LIVE_SESSION' ? t('live')
    : group.status === 'SESSION_NOT_LIVE' ? t('notLive') : t('unscoped')

  function itemText(t, item) {
    const verdict = item.decision === 'ALLOW' ? 'APPROVED' : item.reason
    return `${t('checkpoint')}: ${item.checkpointId} · ${verdict}${item.stageStatus ? ` · ${t('stage')}: ${item.stageStatus}` : ''}`
  }

  function groupCard(t, group) {
    const items = group.items.slice(0, MAX_ITEMS).map(item =>
      h('li', { key: `${item.runId}:${item.checkpointId}` }, itemText(t, item)))
    const extra = group.items.length > MAX_ITEMS
      ? h('p', null, `+${group.items.length - MAX_ITEMS} ${t('more')}`) : null
    return h('li', { key: group.sessionId ?? `unscoped-${group.runId ?? ''}`, className: 'finance-p2__card' },
      h('strong', null, `${t('run')}: ${shortId(group.sessionId)}`),
      h('p', null, `${groupState(t, group)}${group.preset ? ` · ${t('preset')}: ${group.preset}` : ''}`),
      h('p', null, `${t('pending')}: ${group.pending} · ${t('decided')}: ${group.decided}`),
      h('ul', { className: 'finance-p2__list' }, items),
      extra)
  }

  function Panel({ reviewT: t, loadReview }) {
    const [state, setState] = React.useState({ status: 'loading', summary: null, policy: null, error: null })
    const refresh = () => {
      setState(previous => ({ ...previous, status: 'loading', error: null }))
      Promise.resolve()
        .then(() => loadReview())
        .then(result => {
          const summary = result?.summary
          const policy = result?.policy
          if (!summary?.ok) { setState({ status: 'error', summary: null, policy: null, error: summary?.code ?? 'gateway/unavailable' }); return }
          if (!policy?.ok) { setState({ status: 'error', summary: null, policy: null, error: policy?.code ?? 'gateway/unavailable' }); return }
          setState({ status: 'ready', summary: summary.summary, policy: policy.policy, error: null })
        })
        .catch(error => setState({ status: 'error', summary: null, policy: null, error: error?.code ?? 'gateway/failed' }))
    }
    React.useEffect(refresh, [])
    const { summary, policy } = state
    const refreshing = state.status === 'loading'
    const loading = refreshing && !summary ? h('p', null, t('loading')) : null
    const failure = state.status === 'error'
      ? h('p', { className: 'finance-p2__error' }, `${t('stale')} (${state.error ?? 'unknown'})`) : null
    const policyLine = policy
      ? h('p', { className: 'finance-p2__meta' },
        `${t('policy')}: ${policy.policyId} · ${t('version')}: ${policy.version} · ${t('locked')}: ${policy.locked} · ${t('sideEffects')}: ${policy.externalSideEffects}`)
      : null
    const totalsLine = summary
      ? h('p', { className: 'finance-p2__meta' },
        `${t('sessions')}: ${summary.totals.sessions} · ${t('items')}: ${summary.totals.items} · ${t('pending')}: ${summary.totals.pending} · ${t('decided')}: ${summary.totals.decided} · rev ${summary.revision}`)
      : null
    const empty = summary && summary.groups.length === 0 ? h('p', null, t('empty')) : null
    const list = summary && summary.groups.length > 0
      ? h('ul', { className: 'finance-p2__list' }, summary.groups.map(group => groupCard(t, group))) : null
    return h('section', { className: 'finance-p2__card', 'aria-live': 'polite' },
      h('header', { className: 'finance-p2__head' },
        h('h3', null, t('title')),
        h('button', { type: 'button', onClick: refresh, disabled: refreshing }, t('refresh'))),
      loading, failure, policyLine, totalsLine, empty, list,
      h('p', { className: 'finance-p2__meta' }, t('readOnly')))
  }

  function install(ctx) {
    ctx.effect(() => ctx.locale.register(NS, messages), 'financial-review: dictionaries')
    const reviewT = ctx.locale.bind(NS)
    const loadReview = async () => {
      const [summary, policy] = await Promise.all([
        ctx.remote.financeReview.reviewSummary({}),
        ctx.remote.financeReview.reviewPolicy({}),
      ])
      return { summary: decodeSummary(summary), policy: decodePolicy(policy) }
    }
    return { reviewT, loadReview }
  }

  return { remote: createReviewContract(z).remote, Panel, install, decodeSummary, decodePolicy }
}
