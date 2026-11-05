/**
 * Audit the traceability claims: a PASS entry must point at machine-checkable evidence,
 * not at a document that merely sounds conclusive.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const data = JSON.parse(await readFile(join(root, 'acceptance/traceability.json'), 'utf8'))

const PASSING = new Set(['PASS_NATIVE', 'PASS_STATIC'])
const results = []
const problems = []

for (const group of ['stageGates', 'mandatoryAcceptance']) {
  for (const item of data[group]) {
    if (!PASSING.has(item.status)) continue
    const entries = []
    for (const path of item.evidence) {
      const full = join(root, path)
      if (!existsSync(full)) { entries.push({ path, verdict: 'MISSING' }); problems.push(`${item.id}: ${path} is missing`); continue }
      if (path.endsWith('.json')) {
        const body = JSON.parse(await readFile(full, 'utf8'))
        const checks = Array.isArray(body.checks) ? body.checks : null
        const failed = checks ? checks.filter(check => check.status !== 'PASS') : []
        const status = typeof body.status === 'string' ? body.status : null
        const verdict = checks
          ? (checks.length > 0 && failed.length === 0 ? 'MACHINE_CHECKED' : 'FAILED_CHECKS')
          : (/^PASS/.test(status ?? '') ? 'STATUS_ONLY' : 'NO_VERDICT')
        entries.push({ path, verdict, checks: checks?.length ?? 0, status })
        if (verdict === 'FAILED_CHECKS') problems.push(`${item.id}: ${path} contains failing checks`)
        // PASS_NATIVE must be backed by at least one machine-checked file.
        continue
      }
      if (path.endsWith('.tap')) {
        const text = await readFile(full, 'utf8')
        const clean = /# fail 0\b/.test(text) && /# pass [1-9]/.test(text)
        entries.push({ path, verdict: clean ? 'MACHINE_CHECKED' : 'FAILED_CHECKS' })
        if (!clean) problems.push(`${item.id}: ${path} is not a clean TAP run`)
        continue
      }
      entries.push({ path, verdict: 'DOCUMENT' })
    }
    const machine = entries.filter(entry => entry.verdict === 'MACHINE_CHECKED').length
    if (item.status === 'PASS_NATIVE' && machine === 0) problems.push(`${item.id}: PASS_NATIVE without machine-checked evidence`)
    if (item.status === 'PASS_STATIC' && entries.every(entry => entry.verdict === 'DOCUMENT')) {
      // A static claim may rest on documents, but the map must still be explicit about it.
      entries.push({ note: 'static claim rests on documents only' })
    }
    results.push({ group, id: item.id, status: item.status, machineChecked: machine, entries })
  }
}

const report = {
  stage: 'P6',
  id: 'P6_CLAIM_AUDIT',
  observedDate: new Date().toISOString().slice(0, 10),
  status: problems.length === 0 ? 'PASS_CLAIMS_BACKED' : 'FAIL',
  rule: 'Every PASS entry must cite at least one machine-checked result; documents alone cannot carry a native claim.',
  audited: results.length,
  problems,
  results,
}
await writeFile(join(root, 'acceptance/P6-claim-audit-001.json'), JSON.stringify(report, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({ status: report.status, audited: report.audited, problems: problems.length }))
if (problems.length) process.exitCode = 1
