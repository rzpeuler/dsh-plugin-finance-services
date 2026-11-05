// Two-phase native probe: side-effect surface (NOSIDE) and disable/enable durability (PERSIST).
import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

export const name = 'finance-p5-persist-test-only'
export const inject = ['financeReview', 'tools', 'storageDomain']

const RUN = 'run-p5-persist-fixed'
const SESSION = 'session-p5-persist-fixed'
const HASH = '1'.repeat(64)
const SENTINEL = 'sentinel.json'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

// Import specifiers that would imply network or process side effects if a finance module reached them.
const FORBIDDEN = ['node:net', 'node:http', 'node:https', 'node:dns', 'node:tls', 'node:child_process',
  'undici', 'axios', 'node-fetch', 'http', 'https']

export async function apply(ctx, config) {
  const checks = []
  const check = async (id, operation) => {
    try { const detail = await operation(); checks.push({ id, status: 'PASS', ...(detail ? { detail } : {}) }) }
    catch (error) { checks.push({ id, status: 'FAIL', error: error?.code ?? error?.name ?? 'ASSERTION' }) }
  }

  const policy = ctx.financeReview.policy()
  const sentinelPath = join(config.workspace, SENTINEL)
  const expectedSentinel = JSON.stringify({ purpose: 'P5_PERSISTENCE_SENTINEL', policyDigest: policy.digest })
  const expectedSha = sha(Buffer.from(expectedSentinel, 'utf8'))
  const domain = ctx.storageDomain.get('financial_review')
  const document = domain?.table('state').get('root') ?? null
  const settled = (document?.reviews ?? []).some(review => review.runId === RUN)
  const phase = settled ? 'B' : 'A'

  await check('policy-keeps-external-side-effects-disabled', async () => {
    if (policy.externalSideEffects !== 'DISABLED') throw new Error('external side effects enabled')
    if (policy.lockedBoundaries.length !== 8) throw new Error('locked boundary count changed')
    return { externalSideEffects: policy.externalSideEffects, lockedBoundaries: policy.lockedBoundaries.length }
  })

  await check('review-service-exposes-no-side-effecting-method', async () => {
    const allowed = new Set(['constructor', 'policy', 'settle', 'recordStage', 'evaluate', 'classify', 'queue',
      'requirementOf', 'requestReview', 'inspect', 'requireStore', 'serialize'])
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(ctx.financeReview))
    const unexpected = methods.filter(name => !allowed.has(name))
    if (unexpected.length) throw new Error(`unexpected methods: ${unexpected.join(',')}`)
    for (const forbidden of ['publish', 'post', 'trade', 'transfer', 'send', 'email', 'distribute']) {
      if (methods.includes(forbidden)) throw new Error(`side effect method ${forbidden}`)
    }
    return { methods }
  })

  await check('no-side-effecting-tool-is-registered', async () => {
    const names = ctx.tools.schemas().map(tool => tool.name)
    const offending = names.filter(name => /(^|_)(publish|send|trade|post|transfer|email|distribute)(_|$)/i.test(name))
    if (offending.length) throw new Error(`side effect tools: ${offending.join(',')}`)
    return { tools: names.length, offending: offending.length }
  })

  await check('finance-modules-import-no-network-or-process-client', async () => {
    const manifest = JSON.parse(await readFile(join(config.bundleRoot, 'package.json'), 'utf8'))
    const files = ['lib/review.js', 'lib/host.js', 'lib/data-runtime-2.js', 'lib/role-data-1.js']
      .filter(file => manifest.files.includes(file))
    const hits = []
    for (const file of files) {
      const text = await readFile(join(config.bundleRoot, file), 'utf8')
      const specifiers = [...text.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)].map(match => match[1])
      for (const specifier of specifiers) {
        if (FORBIDDEN.includes(specifier)) hits.push({ file, specifier })
      }
    }
    if (hits.length) throw new Error(`forbidden imports: ${JSON.stringify(hits)}`)
    return { files: files.length, forbiddenImports: 0 }
  })

  if (phase === 'A') {
    await check('settle-a-review-and-write-a-user-sentinel', async () => {
      const settledReview = await ctx.financeReview.settle({ reviewId: 'review-persist-1', sessionId: SESSION, runId: RUN,
        agentId: 'finance-pitch-agent', checkpointId: 'valuation_complete', policyVersion: policy.version,
        artifactRef: { hash: HASH }, status: 'APPROVED', actor: 'p5-persist-probe', decidedAt: new Date().toISOString() })
      if (settledReview.status !== 'SETTLED') throw new Error(`settle failed: ${settledReview.status}`)
      await ctx.financeReview.recordStage({ runId: RUN, agentId: 'finance-pitch-agent',
        checkpointId: 'valuation_complete', status: 'COMPLETED', artifact: { hash: HASH } })
      const { writeFile } = await import('node:fs/promises')
      await writeFile(sentinelPath, expectedSentinel, 'utf8')
      const info = await stat(sentinelPath)
      return { settled: settledReview.status, revision: settledReview.revision, sentinelBytes: info.size, sentinelSha: expectedSha }
    })
  } else {
    await check('user-sentinel-survives-a-disable-enable-cycle', async () => {
      const info = await stat(sentinelPath)
      const bytes = await readFile(sentinelPath)
      if (sha(bytes) !== expectedSha) throw new Error('sentinel content changed')
      return { bytes: info.size, sha: expectedSha }
    })

    await check('persisted-approval-survives-a-disable-enable-cycle', async () => {
      const decision = ctx.financeReview.evaluate({ sessionId: SESSION, runId: RUN, agentId: 'finance-pitch-agent',
        checkpointId: 'valuation_complete', artifact: { hash: HASH } })
      if (decision.decision !== 'ALLOW') throw new Error(`decision ${decision.decision}: ${decision.reason}`)
      const outcome = ctx.financeReview.classify({ runId: RUN })
      const mine = (ctx.storageDomain.get('financial_review').table('state').get('root')?.reviews ?? [])
        .filter(review => review.runId === RUN)
      return { decision: decision.reason, classification: outcome.status, reviews: mine.length }
    })

    await check('policy-identity-is-unchanged-after-the-cycle', async () => {
      const stored = ctx.storageDomain.get('financial_review').table('state').get('root')?.reviews
        ?.find(review => review.runId === RUN)
      if (!stored || stored.policyVersion !== policy.version || stored.snapshotDigest !== policy.digest) {
        throw new Error('policy identity drifted across the cycle')
      }
      return { policyVersion: stored.policyVersion, snapshotDigest: stored.snapshotDigest }
    })
  }

  const report = {
    evidence: 'REAL_NATIVE_SIDE_EFFECT_SURFACE_AND_DISABLE_ENABLE_DURABILITY_NOT_COMMERCIAL',
    phase,
    status: checks.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    policy: { id: policy.policyId, version: policy.version, digest: policy.digest },
    checks,
    modelCalls: 0,
    externalSideEffects: policy.externalSideEffects,
  }
  const { writeFile } = await import('node:fs/promises')
  await writeFile(config.reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'w' })
}
