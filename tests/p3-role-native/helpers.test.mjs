/** Local helper/source checks only. These are NOT a substitute for native installation. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { validateExample, validateNativeSubset, parseEnvelope, sourceQuery, argsFor } from './after.js';
import { describeDataQuery, dataQueryParameters, dataQueryOutput } from '../../src/role/data-query.js';
import { CAPABILITIES } from '../../src/data/contracts.js';

test('all fourteen actual describe schemas accept their examples in independent basic validator', () => {
  assert.equal(CAPABILITIES.length, 14);
  for (const capability of CAPABILITIES) {
    const descriptor = describeDataQuery(capability);
    validateExample(descriptor.schema, descriptor.example);
    assert.equal(descriptor.availability, 'SCHEMA_IS_NOT_CONFIGURATION_OR_AUTHORIZATION');
    assert.equal(descriptor.exampleClassification, 'TEST_ONLY_NOT_PROVIDER_COVERAGE');
  }
});
test('actual model-facing parameter and output schemas use only native presenter JSON subset', () => {
  validateNativeSubset(dataQueryParameters); validateNativeSubset(dataQueryOutput);
  assert.throws(() => validateNativeSubset({ type: 'string', maxLength: 20 }));
  assert.throws(() => validateNativeSubset({ type: ['string', 'null'] }));
});
test('basic example checker rejects type, required and additional-property violations', () => {
  const schema = { type: 'object', properties: { x: { type: 'integer', minimum: 1 } }, required: ['x'], additionalProperties: false };
  validateExample(schema, { x: 1 });
  for (const value of [{}, { x: '1' }, { x: 0 }, { x: 1, extra: true }]) assert.throws(() => validateExample(schema, value));
});
test('native result helper uses isError discriminant and value, never guesses content JSON', () => {
  const raw = { status: 'NOT_AUTHORIZED', data: null, trace: [] };
  const result = { isError: false, value: { action: 'query', capability: 'financial.statements', status: raw.status, trust: 'UNTRUSTED_DATA', result_json: JSON.stringify(raw) }, content: [] };
  assert.deepEqual(parseEnvelope(result), raw);
  assert.throws(() => parseEnvelope({ ...result, isError: true }));
  assert.throws(() => parseEnvelope({ ...result, value: { ...result.value, trust: 'TRUSTED' } }));
  assert.deepEqual(argsFor(sourceQuery()), { action: 'query', capability: 'financial.statements', query_json: JSON.stringify(sourceQuery()) });
});
test('probe sources have no install, shell, network, model invocation or native replacement registration', async () => {
  for (const file of ['probe.js', 'after.js', 'inflight.js']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /child_process|execFile|spawn\(|\bfetch\(|https\.request|saveSelection\(|\.provide\(|tools\.register\(|setFactory\(/);
    assert.doesNotMatch(source, /workspaceRegistry\.(?:create|delete)|bindWorkspace\(|unbindWorkspace\(|\.send\(|\.startTurn\(/);
  }
});
