/** P4 intake declarations only. No filesystem, native API, tool registration or business execution. */
export function createBusinessTaskTemplates(z) {
  const version = '1.0.0'
  const clone = value => JSON.parse(JSON.stringify(value))
  const text = max => z.string().min(1).max(max).refine(value =>
    !/[\u0000-\u001f\u007f]/.test(value) && !/(?:Bearer\s+\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|password|access[_-]?token)\s*[:=]\s*\S+|[a-z]+:\/\/)/i.test(value),
  'Use bounded credential-free text; no endpoints or control characters')
  const Id = text(64).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  const refs = (min = 1, max = 20) => z.array(Id).min(min).max(max).refine(v => new Set(v).size === v.length, 'Duplicate references')
  const DateOnly = z.string().max(10).regex(/^[1-9]\d{3}-\d{2}-\d{2}$/).refine(value => {
    const n = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value
  }, 'Expected an exact ISO calendar date')
  const classification = z.enum(['TEST_ONLY', 'USER_PROVIDED', 'UNSOURCED'])
  const path = text(512).refine(value => {
    if (value.includes('\\') || value.includes(':') || value.startsWith('/') || value.includes('%')) return false
    return value.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part) &&
      !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))
  }, 'Use a canonical workspace-relative forward-slash file path; no traversal, devices or encoded paths')
  const Entity = z.strictObject({ ref: Id, scheme: z.literal('ticker'), identifier: text(128).regex(/^\d{6}\.(?:SH|SZ|BJ)$/) })
  const Period = z.strictObject({ ref: Id, kind: z.enum(['instant', 'fiscal_year', 'fiscal_quarter', 'month', 'range']),
    start: DateOnly, end: DateOnly, measurement: z.enum(['actual', 'estimate', 'record']) })
    .refine(p => p.start <= p.end && (p.kind !== 'instant' || p.start === p.end), 'Invalid period boundaries')
  const Source = z.strictObject({ ref: Id, label: text(160), locator: text(240), classification,
    sourceAsOf: DateOnly, availableAt: DateOnly })
  const File = z.strictObject({ ref: Id, path, sha256: z.string().regex(/^[a-f0-9]{64}$/),
    fileType: z.enum(['json', 'txt', 'csv', 'xlsx', 'docx', 'pptx', 'pdf']),
    entityRefs: refs(1, 30), periodRefs: refs(1, 10), sourceRef: Id })
  const envelope = { templateVersion: z.literal(version), classification, asOf: DateOnly,
    entities: z.array(Entity).min(1).max(30), periods: z.array(Period).min(1).max(20),
    sourceIndex: z.array(Source).min(1).max(40), inputFileRefs: z.array(File).min(1).max(40),
    unit: z.strictObject({ currency: z.literal('CNY'), scale: z.enum(['ones', 'thousands', 'millions', 'billions']),
      accountingBasis: text(64), consolidation: text(64) }) }
  const definitions = [
    { slug: 'market-researcher', title: 'Sector or thematic primer', purpose: 'Overview, landscape, consistent peers and three-to-five ideas; optional slides.',
      workers: ['sector-reader', 'comps-spreader', 'note-writer'], mcp: [], writer: 'note-writer', range: [11, 33],
      shape: { sector: text(120), angle: text(240), universeBoundary: text(240), researchPeriodRef: Id, peerEntityRefs: refs(8, 15),
        factsFileRef: Id, peerMetricsFileRef: Id, screeningCriteriaFileRef: Id, shortlistSize: z.number().int().min(3).max(5), slidesRequested: z.boolean() },
      checks: ['Sourced dated TAM and comparable definitions', 'Approved competitive scope/outline', 'Screen criteria and thesis hooks'],
      outputs: ['primer-<sector>.docx', 'primer-<sector>.pptx only if requested'], reviews: ['comps-spread:Analyst', 'note-drafted:Analyst'],
      method: ['sector-overview', 'competitive-analysis', 'comps-analysis', 'idea-generation', 'pptx-author'], gaps: ['MISSING_SOURCE_ASSET:comps_example.xlsx'] },
    { slug: 'earnings-reviewer', title: 'Covered-name post-earnings update', purpose: 'Actual/consensus/prior variance, existing model update and draft note.',
      workers: ['transcript-reader', 'model-updater', 'note-writer'], mcp: [], writer: 'note-writer', range: [11, 30],
      shape: { companyEntityRef: Id, reportingPeriodRef: Id, releaseDate: DateOnly, consensusAsOf: DateOnly, mode: z.enum(['current_event', 'historical_replay']),
        existingModelFileRef: Id, actualsFileRef: Id, consensusFileRef: Id, priorEstimatesFileRef: Id, transcriptFileRef: Id, releaseFileRef: Id,
        guidanceFileRef: Id.nullable(), format: z.enum(['morning_note_wrapper', 'full_earnings_analysis']) },
      checks: ['Revenue/GM/EBITDA/EPS actual-consensus-prior', 'Old-new estimates, guidance, share count and GAAP-adjusted bridge', 'Transcript/release date and full coverage', 'Formula/link audit'],
      outputs: ['model-<ticker>.xlsx', 'note-<ticker>.docx; full analysis requires 8-12 pages and 8-12 charts'], reviews: ['draft-handoff:Senior Analyst'],
      method: ['earnings-analysis', 'model-update', 'audit-xls', 'morning-note'], gaps: ['Source reader schema omits full call/Q&A provenance'] },
    { slug: 'model-builder', title: 'Direct DCF method intake', purpose: 'Bounded five-year direct dcf-model subset, not the comps-first /dcf command.',
      workers: ['data-puller', 'builder', 'auditor'], mcp: [], writer: 'builder', range: [11, 30],
      shape: { companyEntityRef: Id, method: z.literal('dcf-model'), historicalPeriodRefs: refs(3, 5), forecastPeriodRefs: refs(5, 5),
        financialsFileRef: Id, assumptionsFileRef: Id, assumptions: z.strictObject({ terminalGrowth: z.number().min(0).max(0.1),
          baseWacc: z.number().gt(0).max(1), dilutedShares: z.number().gt(0).max(1e12) }) },
      checks: ['DCF/WACC, Bear/Base/Bull selector, source comments and formula-only derived cells', 'Three 5x5 full-recalculation sensitivities with center=base', 'Independent audit and actual recalc/cache verification'],
      outputs: ['model.xlsx or explicitly agreed [Ticker]_DCF_Model_[Date].xlsx; naming must be resolved'], reviews: ['model-built:User', 'model-audited-before-sensitivities:User'],
      method: ['dcf-model', 'audit-xls', 'xlsx-author'], gaps: ['Not full /dcf: that command first requires 4-6 comps', 'Numeric profile alone is single-case and NUMERIC_RESULT_NOT_OFFICE', 'Auditor needs supported read-only binary projection'] },
  ]
  const source = (path, start, end) => ({ path: `assets/${path}`, lineStart: start, lineEnd: end })
  const persona = d => source(`prompts/finance-${d.slug}.md`, ...d.range)
  const special = (_slug, method, start, end) => source(`runtime-skills/${method}/SKILL.md`, start, end)
  const templates = new Map(definitions.map(d => {
    const presetId = `finance-${d.slug}`
    const schema = z.strictObject({ ...envelope, business: z.strictObject(d.shape) })
    return [presetId, { ...d, presetId, schema }]
  }))
  const get = id => {
    if (typeof id !== 'string' || !templates.has(id)) throw Object.assign(new Error('Unknown main business preset'), { code: 'BUSINESS_PRESET_UNKNOWN' })
    return templates.get(id)
  }
  const verification = () => ({ fileRead: 'NOT_DONE', sha256: 'NOT_DONE', authorization: 'NOT_DONE', source: 'NOT_DONE', office: 'NOT_RUN', nativeWorkers: 'NOT_RUN' })
  const constraints = ['INTAKE_DECLARATION_ONLY: no permission, source authenticity, approval or execution is established',
    'P3_MANAGER_GAP: local declarations do not create an MCP connection or authorize vendor access',
    'P4_ADAPTATION: entity/period/unit/provenance envelopes are versioned additions, not upstream Worker output schemas',
    'MAIN_OR_HOST_ASKS_HUMANS; WORKERS_RELAY; no schema field reports approval completed']
  function describe(presetId) {
    const d = get(presetId)
    const conditional = []
    const methodStops = { 'dcf-model': [['inputs-before-projection', 51], ['revenue-before-margins', 52], ['fcf-before-wacc', 53], ['wacc-before-discounting', 54], ['bridge-before-sensitivities', 55]],
      '3-statement-model': [['template-map', 26], ['historicals', 27], ['income-statement', 28], ['balance-sheet', 29], ['cash-flow', 30]],
      'lbo-model': [['sources-uses', 263], ['operating-projections', 264], ['debt', 265], ['returns', 266], ['sensitivities', 267]],
      'comps-analysis': [['structure', 100], ['raw-inputs', 101], ['operating-metrics', 102], ['valuation-multiples', 103]] }
    for (const method of d.method) for (const [id, line] of methodStops[method] ?? []) conditional.push({ id: `${method}.${id}`, owner: 'User', requestedBy: 'Main or Host', workers: 'Relay only', source: special(d.slug, method, line, line) })
    if (d.slug === 'market-researcher') conditional.push({ id: 'competitive-outline-before-slides', owner: 'User', requestedBy: 'Main or Host', workers: 'Relay only', source: special('market-researcher', 'competitive-analysis', 19, 36) })
    return clone({ templateVersion: version, presetId, title: d.title, purpose: d.purpose, constraints,
      inputSchema: z.toJSONSchema(d.schema, { io: 'input' }),
      crossFieldRules: ['Unique entity/period/source/file references; all business and file references resolve', 'File extension, entity/period/source indexes and classification must agree',
        'Source availability <= intake asOf; actual periods cannot end after asOf', 'Business-specific date, period, entity and file-type checks also run in validate; refinements are not fully represented in JSON Schema'],
      workers: d.workers.map(stem => ({ presetId: `${presetId}-${stem}`, writer: stem === d.writer,
        sourcePath: `assets/prompts/${presetId}-${stem}.md` })),
      allowedMcpServers: d.mcp, methodScope: d.method, sourceChecks: d.checks, sourceOutputs: d.outputs,
      sourceRefs: [persona(d)],
      sourceCheckpoints: [...d.reviews.map(value => { const [id, owner] = value.split(':'); return { id, owner, requestedBy: 'Main or Host', workers: 'Relay only', source: persona(d) } }), ...conditional],
      gaps: d.gaps, technicalStatus: { ...verification(), p3: 'PARTIAL_HOST_INTERFACE_GAP', artifacts: 'DRAFT_REVIEW_REQUIRED' },
      pathPolicy: 'Declarations only: no path resolution, file opening, SHA verification or binary extraction occurs' })
  }
  // Reject non-JSON values and excessive structure before JSON serialization or Zod recursion.
  function measure(input) {
    const seen = new Set(); let nodes = 0
    function walk(v, depth) {
      if (++nodes > 12000 || depth > 10) throw new Error('STRUCTURE_LIMIT')
      if (v === null || typeof v === 'boolean') return
      if (typeof v === 'number' && Number.isFinite(v)) return
      if (typeof v === 'string' && v.length <= 65536) return
      if (!v || typeof v !== 'object' || seen.has(v)) throw new Error('JSON_REQUIRED')
      const proto = Object.getPrototypeOf(v)
      // Admit plain JSON across realms, not fabricated prototypes or Array subclasses.
      // Inspect descriptors only: inherited toJSON/accessors must never run during stringify.
      const nativePrototype = (candidate, name) => {
        if (!candidate || Object.hasOwn(candidate, 'toJSON')) return false
        const ctor = Object.getOwnPropertyDescriptor(candidate, 'constructor')?.value
        return typeof ctor === 'function' && Object.getOwnPropertyDescriptor(ctor, 'prototype')?.value === candidate &&
          Function.prototype.toString.call(ctor) === `function ${name}() { [native code] }`
      }
      const plainPrototype = candidate => candidate === null ||
        (Object.getPrototypeOf(candidate) === null && nativePrototype(candidate, 'Object'))
      if (Array.isArray(v) ? !(nativePrototype(proto, 'Array') && plainPrototype(Object.getPrototypeOf(proto))) : !plainPrototype(proto)) throw new Error('JSON_REQUIRED')
      seen.add(v)
      const keys = Reflect.ownKeys(v)
      if (keys.length > 128 || (Array.isArray(v) && (v.length > 128 || keys.length !== v.length + 1))) throw new Error('STRUCTURE_LIMIT')
      for (const key of keys) {
        if (Array.isArray(v) && key === 'length') continue
        if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype', 'toJSON'].includes(key)) throw new Error('JSON_REQUIRED')
        const prop = Object.getOwnPropertyDescriptor(v, key)
        if (!prop.enumerable || prop.get || prop.set) throw new Error('JSON_REQUIRED')
        walk(prop.value, depth + 1)
      }
      seen.delete(v)
    }
    walk(input, 0)
    if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 65536) throw new Error('BYTE_LIMIT')
  }
  function validate(presetId, input) {
    const d = get(presetId)
    const invalid = issues => ({ status: 'INVALID_INPUT', issues: issues.slice(0, 12), verification: verification() })
    try { measure(input) } catch (e) { return invalid([{ path: '', code: e.message === 'BYTE_LIMIT' ? 'BYTE_LIMIT' : 'JSON_OR_STRUCTURE_LIMIT' }]) }
    const parsed = d.schema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error.issues.map(issue => ({ path: issue.path.join('.').slice(0, 160), code: issue.code })))
    const v = parsed.data, b = v.business, errors = []
    const fail = (path, code) => errors.push({ path, code })
    const indexed = (items, name) => { const map = new Map(items.map(item => [item.ref, item])); if (map.size !== items.length) fail(name, 'DUPLICATE_REF'); return map }
    const entities = indexed(v.entities, 'entities'), periods = indexed(v.periods, 'periods'), sources = indexed(v.sourceIndex, 'sourceIndex'), files = indexed(v.inputFileRefs, 'inputFileRefs')
    const requireRefs = (values, map, location) => { for (const ref of values) if (!map.has(ref)) fail(location, 'UNRESOLVED_REF') }
    for (const s of v.sourceIndex) if (s.classification !== v.classification || s.sourceAsOf > s.availableAt || s.availableAt > v.asOf) fail('sourceIndex', 'SOURCE_SCOPE_OR_DATE')
    for (const p of v.periods) if (p.measurement !== 'estimate' && p.end > v.asOf) fail('periods', 'ACTUAL_AFTER_ASOF')
    const paths = new Set()
    for (const f of v.inputFileRefs) {
      requireRefs(f.entityRefs, entities, 'inputFileRefs.entityRefs'); requireRefs(f.periodRefs, periods, 'inputFileRefs.periodRefs'); requireRefs([f.sourceRef], sources, 'inputFileRefs.sourceRef')
      if (f.path.split('.').at(-1).toLowerCase() !== f.fileType || paths.has(f.path.toLowerCase())) fail('inputFileRefs.path', 'EXTENSION_OR_DUPLICATE_PATH')
      paths.add(f.path.toLowerCase())
    }
    for (const [key, value] of Object.entries(b)) {
      const values = value === null ? [] : Array.isArray(value) ? value : [value]
      if (/FileRefs?$/.test(key)) requireRefs(values, files, `business.${key}`)
      if (/EntityRefs?$/.test(key)) requireRefs(values, entities, `business.${key}`)
      if (/PeriodRefs?$/.test(key)) requireRefs(values, periods, `business.${key}`)
    }
    const businessRefs = suffix => Object.entries(b).filter(([key]) => suffix.test(key)).flatMap(([, value]) => value === null ? [] : Array.isArray(value) ? value : [value])
    const scopedEntities = businessRefs(/EntityRefs?$/), scopedPeriods = businessRefs(/PeriodRefs?$/)
    for (const ref of businessRefs(/FileRefs?$/)) { const f = files.get(ref); if (f && (!f.entityRefs.some(id => scopedEntities.includes(id)) || !f.periodRefs.some(id => scopedPeriods.includes(id)))) fail('inputFileRefs', 'BUSINESS_FILE_SCOPE_MISMATCH') }
    const entity = (key, scheme) => { if (entities.get(b[key])?.scheme !== scheme) fail(`business.${key}`, 'ENTITY_SCHEME') }
    const period = (key, kind) => { if (periods.get(b[key])?.kind !== kind) fail(`business.${key}`, 'PERIOD_KIND') }
    const fileType = (key, type) => { if (files.get(b[key])?.fileType !== type) fail(`business.${key}`, 'FILE_TYPE') }
    if (d.slug === 'earnings-reviewer') {
      entity('companyEntityRef', 'ticker'); period('reportingPeriodRef', 'fiscal_quarter'); fileType('existingModelFileRef', 'xlsx')
      if (b.consensusAsOf > b.releaseDate || b.releaseDate > v.asOf || periods.get(b.reportingPeriodRef)?.end > b.releaseDate) fail('business', 'EARNINGS_CHRONOLOGY')
      if (b.mode === 'current_event' && Date.parse(v.asOf) - Date.parse(b.releaseDate) > 90 * 86400000) fail('business.releaseDate', 'STALE_EVENT_DECLARE_REPLAY')
    }
    if (d.slug === 'model-builder') {
      entity('companyEntityRef', 'ticker')
      if (b.assumptions.terminalGrowth >= b.assumptions.baseWacc) fail('business.assumptions', 'TERMINAL_GROWTH_NOT_BELOW_WACC')
      for (const ref of b.historicalPeriodRefs) if (periods.get(ref)?.kind !== 'fiscal_year' || periods.get(ref)?.measurement !== 'actual') fail('business.historicalPeriodRefs', 'HISTORICAL_FISCAL_YEAR_REQUIRED')
      for (const ref of b.forecastPeriodRefs) if (periods.get(ref)?.kind !== 'fiscal_year' || periods.get(ref)?.measurement !== 'estimate' || periods.get(ref)?.start <= v.asOf) fail('business.forecastPeriodRefs', 'FUTURE_FISCAL_YEAR_REQUIRED')
      const sequence = [...b.historicalPeriodRefs, ...b.forecastPeriodRefs].map(ref => periods.get(ref))
      if (b.forecastPeriodRefs.some(ref => b.historicalPeriodRefs.includes(ref)) || sequence.some((p, i) => i && p && sequence[i - 1] && p.start <= sequence[i - 1].end)) fail('business', 'OVERLAPPING_OR_UNORDERED_PERIODS')
    }
    if (errors.length) return invalid(errors)
    return { status: 'VALID_INTAKE_DECLARATION', templateVersion: version, declaration: clone(v), verification: verification() }
  }
  return Object.freeze({ list: () => clone({ templateVersion: version, constraints, templates: definitions.map(d => ({
    presetId: `finance-${d.slug}`, title: d.title, purpose: d.purpose, details: { method: 'describe', presetId: `finance-${d.slug}` },
  })) }), describe, validate })
}
