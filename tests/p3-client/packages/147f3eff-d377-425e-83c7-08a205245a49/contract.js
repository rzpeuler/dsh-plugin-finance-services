/** TEST_ONLY native strict Remote descriptors; function is serialized without feature imports. */
export function createP3ClientContract(z, packageName) {
  const Json = z.string().max(300000).refine(s => new TextEncoder().encode(s).byteLength <= 300000)
    .refine(s => { try { JSON.parse(s); return true } catch { return false } })
  const Run = z.strictObject({ runId: z.string().uuid() })
  const schemas = {
    Empty: z.strictObject({}),
    Run,
    Toggle: Run.extend({ state: z.enum(['READY', 'NOT_AUTHORIZED']) }),
    Checkpoint: z.strictObject({ stage: z.string().min(1).max(128).regex(/^[A-Z0-9_:.-]+$/) }),
    Finish: Run.extend({ clientReportJson: Json }),
    JsonResult: z.strictObject({ json: Json }),
  }
  const method = (name, input) => ({ id: `${packageName}#financeP3ClientTestOnly/${name}`,
    service: 'financeP3ClientTestOnly', namespace: 'financeP3ClientTestOnly', method: name,
    invocation: { kind: 'direct' }, parameters: [{ name: 'request', wire: 'request', source: 'json',
      codec: { mode: 'strict', typeSymbol: `${packageName}#${input}`, create: () => schemas[input] } }],
    result: { mode: 'strict', typeSymbol: `${packageName}#JsonResult`, create: () => schemas.JsonResult },
    description: `TEST_ONLY disposable owned-scope P3 fixture ${name}; no user Session, credentials, models or navigation.` })
  return { schemas, remote: { package: packageName, descriptors: [method('checkpoint', 'Checkpoint'),
    method('setup', 'Empty'), method('queryOwned', 'Run'), method('toggleToyState', 'Toggle'),
    method('report', 'Empty'), method('finalize', 'Finish')] } }
}
