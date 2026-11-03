/**
 * Materialize the browser half without runtime feature imports.
 * @param {object} React Shell-owned React identity.
 * @param {object} z Shell-owned Zod namespace.
 * @param {Function} createFinanceContract Bundle-owned, self-contained contract factory.
 * @returns {object} Cordis function-plugin exports for the Client module loader.
 */
export function createFinanceClient(React, z, createFinanceContract) {
  const h = React.createElement
  const PACKAGE = '@local/dsh-financial-services'
  const PANEL = 'financial-services'
  const NS = 'financial-services'
  const ADDRESS = 'dsh-resource://finance-workspace/current'
  const ONBOARDING_VERSION = 1
  const en = {
    title: 'Financial Services',
    stage: 'P1 · Workspace setup',
    introduction: 'Connect a real local directory to this financial workspace. Host configuration is the source of truth.',
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
    limits: 'P1 scope and limitations',
    scope: 'This phase provides bundle entry points and persistent workspace binding only. Agents, Workers, Skills, task execution, Runs, deliverables, reviews and data adapters are not yet available.',
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
    cancelled: 'Financial Services was unloaded. The result of any pending save must be checked after re-enabling the bundle.',
  }
  const zh = {
    title: 'Financial Services',
    stage: 'P1 · 工作目录设置',
    introduction: '绑定一个真实存在的本地目录作为金融工作区。所有保存状态以 Host 配置为准。',
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
    limits: 'P1 范围与限制',
    scope: '本阶段仅提供 Bundle 入口和持久工作区绑定。Agent、Worker、Skill、任务执行、Runs、成果、审核及数据适配器尚未开放。',
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
    cancelled: 'Financial Services 已卸载；如有在途保存，请重新启用后核对其最终状态。',
  }
  const CSS = `
.finance-p1 { box-sizing: border-box; color: var(--dsw-alias-label-primary); font: inherit; line-height: 1.55; min-width: 0; }
.finance-p1--page { height: 100%; overflow: auto; padding: clamp(16px, 4vw, 40px); background: var(--dsw-alias-bg-base); }
.finance-p1__body { max-width: 880px; margin: 0 auto; display: grid; gap: 20px; }
.finance-p1 h1 { font-size: 24px; margin: 0; font-weight: 600; }
.finance-p1 h2 { font-size: 17px; margin: 0 0 12px; font-weight: 600; }
.finance-p1 p { margin: 8px 0; }
.finance-p1__eyebrow, .finance-p1__hint { color: var(--dsw-alias-label-secondary); font-size: 13px; }
.finance-p1__card { border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; padding: clamp(14px, 3vw, 24px); background: var(--dsw-alias-bg-layer-1); min-width: 0; }
.finance-p1__facts { display: grid; grid-template-columns: minmax(110px, 1fr) minmax(0, 3fr); gap: 8px 16px; margin: 16px 0; }
.finance-p1 dt { color: var(--dsw-alias-label-secondary); }
.finance-p1 dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.finance-p1__form { display: grid; gap: 10px; margin-top: 20px; }
.finance-p1 input { box-sizing: border-box; width: 100%; min-width: 0; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l3); border-radius: 8px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font: inherit; }
.finance-p1 input::placeholder { color: var(--dsw-alias-label-tertiary); }
.finance-p1__actions { display: flex; flex-wrap: wrap; gap: 10px; }
.finance-p1 button { min-height: 38px; max-width: 100%; border: 1px solid var(--dsw-alias-border-l3); border-radius: 8px; padding: 8px 14px; font: inherit; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-button-elevated-fill); cursor: pointer; }
.finance-p1 button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.finance-p1 button.finance-p1__primary { background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-inverted); }
.finance-p1 button:disabled, .finance-p1 input:disabled { opacity: .55; cursor: not-allowed; }
.finance-p1 :focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 3px; }
.finance-p1__error { color: var(--dsw-alias-state-error-primary); overflow-wrap: anywhere; }
.finance-p1__badge { display: inline-block; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; padding: 2px 8px; font-size: 13px; }
.finance-p1 ul { margin: 8px 0; padding-inline-start: 22px; }
.finance-p1 li { overflow-wrap: anywhere; }
@media (max-width: 520px) { .finance-p1__facts { grid-template-columns: minmax(0, 1fr); gap: 3px; } .finance-p1 dd { margin-bottom: 9px; } .finance-p1__actions button { flex: 1 1 180px; } }
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
    return h('p', { role: 'alert', id, className: 'finance-p1__error' },
      error.code ? `${error.code}: ` : '', error.message || t('unknownError'))
  }

  function FinanceIcon({ size }) {
    return h('svg', { width: size, height: size, viewBox: '0 0 32 32', fill: 'none', 'aria-hidden': true, focusable: false },
      h('path', { d: 'M5 6h14l8 8v12H5V6Z', stroke: 'currentColor', strokeWidth: 1.8, strokeLinejoin: 'round' }),
      h('path', { d: 'M19 6v8h8M10 22v-4m6 4v-8m6 8v-4', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }))
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
    return h('section', { className: props.view === 'page' ? 'finance-p1' : 'finance-p1 finance-p1--page', 'aria-busy': busy || resource.status === 'loading' },
      h('style', null, CSS),
      h('div', { className: 'finance-p1__body' },
        h('header', null,
          h('p', { className: 'finance-p1__eyebrow' }, t('stage')),
          h('h1', null, t('title')),
          h('p', { className: 'finance-p1__hint' }, t('introduction'))),
        h('section', { className: 'finance-p1__card' },
          h('h2', null, t('workspace')),
          resource.status === 'loading' ? h('p', { role: 'status' }, t('loading')) : null,
          resource.status === 'none' ? h('p', { role: 'status' }, t('unavailable')) : null,
          resource.status === 'failed' ? h('p', { role: 'alert', className: 'finance-p1__error' }, t('stale')) : null,
          h(ErrorNotice, { error: resource.failure, t }),
          snapshot ? h(React.Fragment, null,
            h('span', { className: 'finance-p1__badge' }, t(snapshot.binding ? 'saved' : 'unbound')),
            h('dl', { className: 'finance-p1__facts' }, facts.map(([key, value]) =>
              h(React.Fragment, { key }, h('dt', null, t(key)), h('dd', null, value)))),
            h(ErrorNotice, { error: snapshot.error, t })) : null,
          h('form', { className: 'finance-p1__form', onSubmit: submit, 'aria-busy': busy },
            h('label', { htmlFor: fieldId }, t('path')),
            h('input', { id: fieldId, type: 'text', value: draft, placeholder: t('pathPlaceholder'),
              disabled: busy, autoComplete: 'off', spellCheck: false,
              'aria-describedby': `${hintId}${actionError ? ` ${errorId}` : ''}`,
              'aria-invalid': Boolean(actionError), onChange: event => setDraft(event.target.value) }),
            h('p', { id: hintId, className: 'finance-p1__hint' }, t('pathHint')),
            h('div', { className: 'finance-p1__actions' },
              h('button', { type: 'button', onClick: choose, disabled: busy }, t(activity === 'pick' ? 'picking' : 'pick')),
              h('button', { type: 'submit', disabled: !canBind || draft.trim() === '', className: 'finance-p1__primary' }, t(activity === 'bind' ? 'saving' : 'save'))),
            h(ErrorNotice, { error: actionError, t, id: errorId })),
          h('p', { className: 'finance-p1__hint' }, t('switching'))),
        h('section', { className: 'finance-p1__card' },
          h('h2', null, t('limits')),
          h('p', null, t('scope')),
          h('p', { className: 'finance-p1__hint' }, t('boundaries')),
          snapshot && snapshot.limitations.length > 0 ? h(React.Fragment, null,
            h('p', { className: 'finance-p1__hint' }, t('hostLimits')),
            h('ul', null, snapshot.limitations.map(limit => h('li', { key: limit }, limit)))) : null)))
  }

  function ActivationGuide(props) {
    const { t } = props
    const resource = props.useResource(ADDRESS)
    const snapshot = resource.value
    if (snapshot && (snapshot.binding !== null || snapshot.onboardingVersion >= ONBOARDING_VERSION)) return null
    return h('section', { className: 'finance-p1 finance-p1__card' },
      h('style', null, CSS),
      h('h2', null, t('guidanceTitle')),
      h('p', null, t('guidance')),
      resource.status === 'loading' ? h('p', { role: 'status' }, t('loading')) : null,
      resource.status === 'none' ? h('p', { role: 'status' }, t('unavailable')) : null,
      resource.status === 'failed' ? h('p', { role: 'alert', className: 'finance-p1__error' }, t('stale')) : null,
      h(ErrorNotice, { error: resource.failure, t }),
      h('div', { className: 'finance-p1__actions' },
        h('button', { type: 'button', onClick: () => { props.openWorkbench(); props.onDismiss() } }, t('open')),
        h('button', { type: 'button', onClick: props.onOpenDetails }, t('details')),
        h('button', { type: 'button', onClick: props.onDismiss }, t('dismiss'))))
  }

  return {
    inject: ['slots', 'remote', 'resources', 'uiWorkspace', 'layout', 'locale'],
    async apply(ctx) {
      await ctx.remote.$mount(createFinanceContract(z).remote)
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
                for await (const frame of ctx.remote.financeOperations.follow({}, generationSignal)) yield frame
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
      const inject = () => ({ bindWorkspace, pickDirectory, openWorkbench })
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL, locale: NS, inject }, WorkspacePage))
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: PANEL, order: 30, label: () => t('title'), locale: NS,
      }, FinanceIcon))
      ctx.slots.inject('plugins.bundle.activation', () => ctx.slots.register({
        name: 'plugins.bundle.activation', key: PACKAGE, locale: NS, inject,
      }, ActivationGuide))
      ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config', key: PACKAGE, locale: NS, inject,
      }, WorkspacePage))
    },
  }
}
