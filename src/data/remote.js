/** Strict, browser-serializable control-plane descriptors; no model query or approval endpoint. */
export function createDataRemoteContract(z) {
  const owner = '@local/dsh-financial-services/data-api-v1'
  const JsonText = z.string().max(2000000).refine(text => new TextEncoder().encode(text).byteLength <= 2000000, 'JSON exceeds UTF-8 limit').refine(text => { try { JSON.parse(text); return true } catch { return false } }, 'Expected JSON')
  const schemas = {
    Empty: z.strictObject({}),
    Catalog: z.strictObject({ catalogJson: JsonText }),
    PolicyRequest: z.strictObject({ expectedRevision: z.number().int().min(0), bindingsJson: JsonText }),
    PolicyResult: z.strictObject({ status: z.enum(['APPLIED', 'CONFLICT', 'REJECTED', 'DISPOSED']), revision: z.number().int().min(0), error: z.strictObject({ code: z.string().max(64), message: z.string().max(256) }).nullable() }),
  }
  const method = (name, input, output, description) => ({ id: `${owner}#financeData/${name}`, service: 'financeData', namespace: 'financeData', method: name,
    invocation: { kind: 'direct' }, parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: `${owner}#${input}`, create: () => schemas[input] } }],
    result: { mode: 'strict', typeSymbol: `${owner}#${output}`, create: () => schemas[output] }, description })
  const descriptors = [
    method('catalog', 'Empty', 'Catalog', 'Read actual financial Adapter coverage, status and explicit scoped source policy. No credentials or business observations.'),
    method('setBindings', 'PolicyRequest', 'PolicyResult', 'Persist an explicit source policy successor with revision CAS. Does not register an Adapter or authorize a source merely because it is configured.'),
    { ...method('follow', 'Empty', 'Catalog', 'Stream the initial catalogue and coalesced registry/status/policy changes until cancellation.'), mode: 'stream', cancellation: { parameter: 'signal' } },
  ]
  return { schemas, remote: { package: owner, descriptors } }
}
