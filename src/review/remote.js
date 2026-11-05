/** Strict, browser-serializable review descriptors; decisions stay Host-only. */
export function createReviewRemoteContract(z) {
  const owner = '@local/dsh-financial-services/review-api-v1'
  const JsonText = z.string().max(2000000)
    .refine(text => new TextEncoder().encode(text).byteLength <= 2000000, 'JSON exceeds UTF-8 limit')
    .refine(text => { try { JSON.parse(text); return true } catch { return false } }, 'Expected JSON')
  const schemas = {
    Empty: z.strictObject({}),
    Summary: z.strictObject({ summaryJson: JsonText }),
    Policy: z.strictObject({ policyJson: JsonText }),
    Runs: z.strictObject({ runsJson: JsonText }),
    Deliverables: z.strictObject({ deliverablesJson: JsonText }),
    Workbook: z.strictObject({
      filename: z.string().min(1).max(128).regex(/^[A-Za-z0-9._-]+\.xlsx$/),
      bytes: z.number().int().min(1).max(8 * 1024 * 1024),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      base64: z.string().min(1).max(11 * 1024 * 1024),
    }),
  }
  const method = (name, input, output, description) => ({
    id: `${owner}#financeReview/${name}`, service: 'financeReview', namespace: 'financeReview', method: name,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: `${owner}#${input}`, create: () => schemas[input] } }],
    result: { mode: 'strict', typeSymbol: `${owner}#${output}`, create: () => schemas[output] }, description,
  })
  const descriptors = [
    method('reviewSummary', 'Empty', 'Summary', 'Read the review queue projection: per-session groups, decisions and pending counts derived from the persisted review document. Read-only.'),
    method('reviewPolicy', 'Empty', 'Policy', 'Read the pinned review policy identity: policy id, version, digest, locked boundaries and its requirement matrix. Read-only.'),
    method('reviewRuns', 'Empty', 'Runs', 'Read the run projection derived from persisted stage and review facts: per-run agent, sessions, checkpoint states, classification and deliverable count. Read-only.'),
    method('reviewWorkbook', 'Empty', 'Workbook', 'Build a technical XLSX from the current review facts and return its bytes as base64. Read-only in process: no subprocess, no workspace write.'),
    method('reviewDeliverables', 'Empty', 'Deliverables', 'Read the deliverable index: recorded artifacts with session, run, content hash, classification and linked review. Read-only.'),
  ]
  return { schemas, remote: { package: owner, descriptors } }
}
