/** Actual native role Tools dispatcher and public FinanceData; no role/core replacement. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MODELER, WRITER, TOOL, hash, success, denial } from './probe.js';
import { runInflight } from './inflight.js';
const MCP = 'test-mcp-statements', REST = 'test-rest-statements';
export const sourceQuery = () => ({ capability: 'financial.statements', entity: { scheme: 'ticker', id: 'TOY' }, market: 'US',
  requiredFields: ['revenue', 'ebitda'], period: { kind: 'fiscal_year', start: '2024-01-01', end: '2024-12-31', label: 'FY2024' },
  asOf: '2025-03-01T00:00:00Z', purpose: 'research', maxAgeSeconds: 3000000,
  targetUnit: { dimension: 'currency', currency: 'USD', scale: 'ones' }, accountingBasis: 'US_GAAP', consolidation: 'consolidated', measurementType: 'actual' });
export const argsFor = query => ({ action: 'query', capability: query.capability, query_json: JSON.stringify(query) });
export function parseEnvelope(result, action = 'query', capability = 'financial.statements') {
  const value = success(result); assert.equal(value.action, action); assert.equal(value.capability, capability);
  assert.equal(value.trust, 'UNTRUSTED_DATA'); assert.equal(typeof value.result_json, 'string');
  assert.ok(Buffer.byteLength(value.result_json, 'utf8') <= 100000);
  const parsed = JSON.parse(value.result_json); if (action === 'query') assert.equal(parsed.status, value.status);
  return parsed;
}
const subsetKeys = new Set(['type', 'oneOf', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'description', 'title', 'default', 'examples']);
export function validateNativeSubset(schema) {
  assert.ok(schema && typeof schema === 'object' && !Array.isArray(schema));
  for (const key of Object.keys(schema)) assert.ok(subsetKeys.has(key), `Unsupported native ToolPresenter key: ${key}`);
  if (schema.type !== undefined) assert.ok(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'].includes(schema.type));
  if (schema.additionalProperties !== undefined) assert.equal(typeof schema.additionalProperties, 'boolean');
  if (schema.required !== undefined) assert.ok(Array.isArray(schema.required) && schema.required.every(k => typeof k === 'string'));
  if (schema.properties) for (const node of Object.values(schema.properties)) validateNativeSubset(node);
  if (schema.items) validateNativeSubset(schema.items);
  if (schema.oneOf) schema.oneOf.forEach(validateNativeSubset);
}
// Independent basic JSON Schema example checker; runtime refinements remain tested by native execution.
export function validateExample(schema, value) {
  if (schema.anyOf) { assert.ok(schema.anyOf.some(s => { try { validateExample(s, value); return true; } catch { return false; } })); return; }
  if (schema.enum) assert.ok(schema.enum.includes(value));
  if ('const' in schema) assert.deepEqual(value, schema.const);
  if (schema.type) {
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    assert.equal(schema.type === 'integer' && Number.isInteger(value) ? 'integer' : type, schema.type);
  }
  if (schema.type === 'object') {
    for (const key of schema.required ?? []) assert.ok(Object.hasOwn(value, key));
    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) validateExample(schema.properties[key], item);
      else assert.notEqual(schema.additionalProperties, false);
    }
  }
  if (schema.type === 'array') { if (schema.minItems) assert.ok(value.length >= schema.minItems); if (schema.maxItems) assert.ok(value.length <= schema.maxItems); value.forEach(item => validateExample(schema.items, item)); }
  if (typeof value === 'string') { if (schema.minLength) assert.ok(value.length >= schema.minLength); if (schema.maxLength) assert.ok(value.length <= schema.maxLength); if (schema.pattern) assert.match(value, new RegExp(schema.pattern)); }
  if (typeof value === 'number') { if ('minimum' in schema) assert.ok(value >= schema.minimum); if ('maximum' in schema) assert.ok(value <= schema.maximum); }
}
export async function runAfter(env) {
  const { ctx, root, runId, report, check, live, handles, held, cleanup, dispatch, cancel } = env;
  const [modeler, other, writer] = live; assert.ok(modeler && other && writer);
  let data, operations, mcp, rest;
  const ready = await check('required-native-finance-services-and-independent-controls', async () => {
    const keys = ['financeData', 'financeOperations', 'financeTestMcpAdapter', 'financeTestRestAdapter'];
    const missing = keys.filter(key => !ctx.get(key)); report.prerequisites = { required: keys, missing, replacementInjected: false };
    if (missing.length) throw Object.assign(new Error(), { probeStatus: 'NOT_RUN' });
    [data, operations, mcp, rest] = keys.map(key => ctx.get(key)); return { required: keys, missing };
  });
  if (!ready) return;
  const baseline = await operations.snapshot({});
  report.userState.baseline = baseline;
  cleanup.push({ id: 'actual-native-workspace-binding-baseline-unchanged', run: async () => {
    const after = await operations.snapshot({});
    assert.deepEqual(after.binding, baseline.binding); assert.equal(after.revision, baseline.revision);
    return { baseline, after, defaultBindingTouched: false, nativeSnapshotAwaited: true };
  } });
  const catalog = () => JSON.parse(data.catalog({}).catalogJson);
  const save = (revision, bindings) => data.setBindings({ expectedRevision: revision, bindingsJson: JSON.stringify(bindings) });
  const ownAdapters = new Set([MCP, REST]), ownScopes = new Set([modeler.id, other.id]);
  const marker = `TEST_ONLY_P3_ROLE_NATIVE:${runId}`;
  // Scope IDs are unguessable owned Session UUIDs; remove them only from known own adapter rows.
  cleanup.push({ id: 'cleanup-owned-scope-subtraction-current-revision-cas', run: async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const before = catalog(), kept = before.bindings.flatMap(binding => {
        if (!ownAdapters.has(binding.adapterId)) return [binding];
        const scopeIds = binding.scopeIds.filter(id => !ownScopes.has(id));
        return scopeIds.length === binding.scopeIds.length ? [binding] : scopeIds.length ? [{ ...binding, scopeIds }] : [];
      });
      if (JSON.stringify(kept) === JSON.stringify(before.bindings)) return { marker, alreadyRemoved: true, revision: before.revision };
      const result = await save(before.revision, kept); if (result.status === 'CONFLICT') continue;
      assert.equal(result.status, 'APPLIED'); const after = catalog();
      assert.ok(!after.bindings.some(b => ownAdapters.has(b.adapterId) && b.scopeIds.some(id => ownScopes.has(id))));
      const domain = ctx.get('storageDomain')?.get('financial_data'); assert.ok(domain);
      assert.deepEqual(domain.table('policy').get('root'), { revision: after.revision, bindings: after.bindings });
      return { marker, revision: after.revision, preservedOthersAtCAS: true, staleRestore: false, durabilityVerified: true };
    } throw new Error('Owned scope cleanup CAS conflicts persisted');
  } });
  const originals = new Map();
  for (const control of [mcp, rest]) { assert.equal(control.diagnostics().failureArmed, false); originals.set(control, control.getSnapshot()); }
  cleanup.push({ id: 'restore-only-test-only-control-states', run: async () => {
    for (const [control, original] of originals) { control.setState(original.state, original.code); assert.equal(control.getSnapshot().state, original.state); assert.equal(control.diagnostics().failureArmed, false); }
    return { restored: 2, verifiedAtMayRefresh: true };
  } });
  const role = await operations.roleDefinition(MODELER);
  const expected = { sourceSha256: role.source.sha256, adaptedPromptSha256: role.prompt.adaptedSha256 };
  await check('actual-role-source-sha-allowlist-and-exact-agent-grant', async () => {
    const manifest = JSON.parse(await readFile(join(root, 'assets/agent-manifest.json'), 'utf8'));
    const original = manifest.roles.find(r => r.id === MODELER); assert.ok(original);
    assert.deepEqual(role.source, original.source); assert.deepEqual(role.allowedMcpServers, original.allowedMcpServers);
    assert.deepEqual(role.allowedMcpServers, ['capiq', 'daloopa']);
    assert.equal(hash(await readFile(join(root, 'assets', role.prompt.adaptedPath))), expected.adaptedPromptSha256);
    assert.equal(operations.isRoleRuntimeActive(modeler, MODELER, expected), true);
    assert.equal(operations.isRoleRuntimeActive({ ...modeler }, MODELER, expected), false);
    assert.equal(operations.isRoleRuntimeActive(modeler, MODELER, { ...expected, sourceSha256: '0'.repeat(64) }), false);
    return { roleId: role.id, source: role.source, expected, allowlist: role.allowedMcpServers, sourceBackedManifestFidelity: true };
  });
  const query = async (agent, request = sourceQuery(), signal) => parseEnvelope(await dispatch(agent, TOOL, argsFor(request), signal));
  await check('installation-not-entitlement-through-actual-native-dispatcher', async () => {
    const result = await query(modeler); assert.equal(result.status, 'NOT_AUTHORIZED'); assert.equal(result.data, null); return result;
  });
  const definition = ctx.tools.get(TOOL, modeler); assert.ok(definition); held.push({ definition, agent: modeler });
  await check('native-presenter-json-subset-and-fourteen-describe-contracts', async () => {
    const schema = ctx.tools.schemas(modeler).find(t => t.name === TOOL); assert.ok(schema);
    validateNativeSubset(schema.parameters); validateNativeSubset(definition.output.schema);
    assert.deepEqual(Object.keys(schema.parameters.properties).sort(), ['action', 'capability', 'query_json']);
    assert.deepEqual(schema.parameters.required, ['action', 'capability']);
    assert.equal(schema.parameters.additionalProperties, false);
    const capabilities = schema.parameters.properties.capability.enum; assert.equal(capabilities.length, 14);
    const descriptors = [];
    for (const capability of capabilities) {
      const descriptor = parseEnvelope(await dispatch(modeler, TOOL, { action: 'describe', capability }), 'describe', capability);
      assert.equal(descriptor.capability, capability); assert.equal(descriptor.schema.type, 'object');
      assert.equal(descriptor.schema.additionalProperties, false); validateExample(descriptor.schema, descriptor.example);
      assert.equal(descriptor.exampleClassification, 'TEST_ONLY_NOT_PROVIDER_COVERAGE');
      assert.equal(descriptor.availability, 'SCHEMA_IS_NOT_CONFIGURATION_OR_AUTHORIZATION');
      descriptors.push(descriptor);
    }
    return { schema, outputSchema: definition.output.schema, descriptors, providerAvailabilityClaim: false };
  });
  await check('held-executor-fake-and-other-exact-agent-denied', async () => {
    const args = { action: 'describe', capability: 'financial.statements' };
    for (const agent of [{ ...modeler }, writer]) await assert.rejects(() => definition.execute(args, { agent, signal: cancel.signal }));
    const otherResult = await definition.execute(argsFor(sourceQuery()), { agent: other, signal: cancel.signal });
    assert.equal(JSON.parse(otherResult.result_json).status, 'NOT_AUTHORIZED');
    return { fakeIdentityRejected: true, samePresetOtherSessionQueryDenied: true, writerRejected: true };
  });
  await check('writer-tool-absent-and-actual-dispatch-denied', async () => {
    assert.ok(!ctx.tools.schemas(writer).some(t => t.name === TOOL)); denial(await dispatch(writer, TOOL, argsFor(sourceQuery())));
    return { absent: true, dispatcherDenied: true };
  });
  const bindings = [[MCP, 'capiq', 20], [REST, 'daloopa', 10]].map(([adapterId, sourceAllowlistKey, priority]) => ({
    adapterId, sourceAllowlistKey, scopeIds: [modeler.id], roleIds: [MODELER], capabilities: ['financial.statements'], markets: ['US'],
    purposes: ['research'], priority, minQuality: 0, enabled: true, allowTestOnly: true }));
  const applied = await check('append-only-owned-scope-policy-durably-saved', async () => {
    const before = catalog(), result = await save(before.revision, [...before.bindings, ...bindings]); assert.equal(result.status, 'APPLIED');
    const after = catalog(); assert.deepEqual(after.bindings, [...before.bindings, ...bindings]);
    const domain = ctx.get('storageDomain')?.get('financial_data'); assert.ok(domain);
    assert.deepEqual(domain.table('policy').get('root'), { revision: after.revision, bindings: after.bindings });
    return { marker, scopes: [modeler.id], beforeRevision: before.revision, afterRevision: after.revision, durabilityVerified: true };
  });
  if (!applied) return;
  const selected = (result, adapter, revenue) => {
    assert.equal(result.status, 'OK'); const observation = result.data.observations.find(o => o.field === 'revenue');
    assert.equal(observation.value, revenue); assert.equal(observation.provenance.adapterId, adapter);
    for (const o of result.data.observations) { assert.equal(o.licenseClass, 'TEST_ONLY'); assert.equal(o.provenance.testOnly, true); assert.equal(o.measurementType, 'actual'); assert.match(o.observationId, /^sha256:[a-f0-9]{64}$/); }
    return result;
  };
  await check('native-tool-mcp-two-million-original-unit-provenance', async () => {
    mcp.setState('READY'); rest.setState('READY'); const result = selected(await query(modeler), MCP, 2000000);
    const o = result.data.observations.find(o => o.field === 'revenue'); assert.equal(o.provenance.originalValue, 2); assert.equal(o.provenance.originalUnit.scale, 'millions');
    assert.equal(o.provenance.sourceId, 'test-only-mcp'); return result;
  });
  await check('native-tool-rest-fallback-two-point-one-million-not-average', async () => {
    mcp.setState('NOT_AUTHORIZED', 'FIXTURE_NOT_AUTHORIZED'); const result = selected(await query(modeler), REST, 2100000);
    assert.ok(result.trace.some(t => t.adapterId === MCP && t.code === 'NOT_AUTHORIZED')); return result;
  });
  await check('same-preset-other-session-and-source-filter-cannot-grant', async () => {
    for (const request of [sourceQuery(), { ...sourceQuery(), sourceIds: ['test-only-mcp', 'test-only-rest'] }]) {
      const result = await query(other, request); assert.equal(result.status, 'NOT_AUTHORIZED'); assert.equal(result.data, null);
    } return { samePresetScopeSeparated: true, sourceIdsCannotExpandPolicy: true };
  });
  await check('policy-original-allowlist-unknown-role-endpoint-and-identity-rejected', async () => {
    for (const extra of [{ sourceAllowlistKey: 'not-in-original-role' }, { roleIds: ['finance-unknown-role'] }, { roleIds: [WRITER] },
      { endpoint: 'https://invalid.example' }, { agentId: modeler.id }, { scopeId: modeler.id }]) {
      const before = catalog(), result = await save(before.revision, [...before.bindings, { ...bindings[0], ...extra }]);
      assert.equal(result.status, 'REJECTED'); assert.deepEqual(catalog(), before);
    } return { rejected: 6, originalAllowlistNotExpandable: true };
  });
  await check('native-strict-query-identity-endpoint-role-and-utf8-negative-matrix', async () => {
    const variants = [
      ...['roleId', 'sessionId', 'scopeId', 'agentId', 'endpoint', 'url', 'headers'].map(key => argsFor({ ...sourceQuery(), [key]: 'TEST_ONLY' })),
      { action: 'query', capability: 'financial.statements' }, { action: 'query', capability: 'financial.statements', query_json: '{' },
      { action: 'describe', capability: 'financial.statements', query_json: '{}' },
      { ...argsFor(sourceQuery()), roleId: MODELER }, { ...argsFor(sourceQuery()), endpoint: 'https://invalid.example' },
      { action: 'query', capability: 'filings', query_json: JSON.stringify(sourceQuery()) },
      { action: 'describe', capability: 'not-a-capability' },
      { action: 'query', capability: 'financial.statements', query_json: '界'.repeat(17000) },
      argsFor({ ...sourceQuery(), entity: { scheme: 'ticker', id: 'TOY', roleId: MODELER } }),
    ];
    for (const args of variants) denial(await dispatch(modeler, TOOL, args)); return { rejected: variants.length, utf8Bytes: 51000, utf8Characters: 17000 };
  });
  await check('controlled-numeric-modeler-lbo-smoke-remains-native', async () => {
    const described = success(await dispatch(modeler, 'finance_model_calculate', { action: 'describe', model: 'lbo' }));
    const descriptor = JSON.parse(described.result_json); assert.ok(descriptor.example);
    const result = success(await dispatch(modeler, 'finance_model_calculate', { action: 'calculate', model: 'lbo', input_json: JSON.stringify(descriptor.example) }));
    const computed = JSON.parse(result.result_json); assert.ok(Object.values(computed.checks).every(v => v === true));
    return { model: 'lbo', numericSmokeOnly: true, checks: computed.checks, goldensRerun: false };
  });
  await runInflight({ ...env, data, operations, catalog, save, bindings, ownAdapters, query, definition, expected });
}
