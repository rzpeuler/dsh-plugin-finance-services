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
  ]
  return { schemas, remote: { package: owner, descriptors } }
}
