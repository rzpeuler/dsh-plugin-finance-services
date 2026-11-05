import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProtocol, createFrameParser, CHALLENGE, VERSION, MAX_FRAME_BYTES } from './protocol.js';
import { createObservedConnectionState } from './connection-state.js';
const fixture = JSON.parse(await readFile(new URL('./toy-fixture.json', import.meta.url), 'utf8'));
const request = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });
function started() {
  const server = createProtocol(fixture, 'SELFTEST_NO_PROCESS');
  const initialized = server.receive(request(1, 'initialize', { protocolVersion: '2026-07-28', capabilities: {}, clientInfo: { name: 'self-test', version: '1' } }));
  assert.equal(initialized.result.protocolVersion, VERSION);
  assert.equal('instructions' in initialized.result, false);
  assert.equal(server.receive({ jsonrpc: '2.0', method: 'notifications/initialized' }), undefined);
  return server;
}
test('initialization downgrade, notification and tools/list are actual MCP JSON-RPC', () => {
  const server = started(), tools = server.receive(request(2, 'tools/list')).result.tools;
  assert.deepEqual(tools.map(t => t.name), ['ping', 'financial_statements']);
  assert.ok(tools.every(t => t.inputSchema.additionalProperties === false && t.annotations.readOnlyHint));
  assert.deepEqual(server.receive(request(3, 'ping')).result, {});
});
test('tools/call returns bounded canonical MCP text and structured synthetic data', () => {
  const server = started();
  const ping = server.receive(request(3, 'tools/call', { name: 'ping', arguments: { challenge: CHALLENGE } })).result;
  assert.equal(ping.structuredContent.initialized, true); assert.equal(ping.structuredContent.instanceId, 'SELFTEST_NO_PROCESS');
  const read = server.receive(request(4, 'tools/call', { name: 'financial_statements', arguments: { symbol: 'TOY', fiscalYear: 2024 } })).result;
  assert.equal(read.structuredContent.revenue * 1000000, 2200000);
  assert.equal(read.structuredContent.license, 'TEST_ONLY');
  assert.deepEqual(JSON.parse(read.content[0].text), read.structuredContent);
  assert.ok(Buffer.byteLength(JSON.stringify(read)) < 4096);
});
test('uninitialized, unknown method, endpoint/path injection and unsupported symbol fail closed', () => {
  assert.equal(createProtocol(fixture).receive(request(1, 'tools/list')).error.code, -32002);
  const server = started();
  for (const args of [{ symbol: 'OTHER', fiscalYear: 2024 }, { symbol: 'TOY', fiscalYear: 2024, url: 'no-network' }, { symbol: 'TOY', fiscalYear: 2024, path: 'no-file' }])
    assert.equal(server.receive(request(5, 'tools/call', { name: 'financial_statements', arguments: args })).result.isError, true);
  assert.equal(server.receive(request(6, 'unknown')).error.code, -32601);
  assert.equal(server.receive(request(7, 'tools/call', { name: 'shell', arguments: {} })).error.code, -32602);
  assert.equal(server.receive({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 4, reason: 'TEST_ONLY' } }), undefined);
});
test('parser handles split UTF-8, CRLF and multiple newline-delimited JSON frames', () => {
  const values = [], errors = []; const parser = createFrameParser(x => values.push(x), () => errors.push(true));
  const bytes = Buffer.from(JSON.stringify({ text: '测试' }) + '\r\n' + JSON.stringify(request(2, 'ping')) + '\n');
  for (const byte of bytes) parser.push(Buffer.from([byte])); parser.end();
  assert.deepEqual(values, [{ text: '测试' }, request(2, 'ping')]); assert.equal(errors.length, 0);
});
test('parser rejects malformed, oversized, invalid UTF-8 and trailing incomplete frames once', () => {
  for (const bytes of [Buffer.from('{\n'), Buffer.alloc(MAX_FRAME_BYTES + 1, 120), Buffer.from([255, 10]), Buffer.from('{'), Buffer.from('[]\n'.repeat(22000))]) {
    let errors = 0; const parser = createFrameParser(() => {}, () => errors++);
    parser.push(bytes); parser.end(); parser.push(Buffer.from('x\n')); assert.equal(errors, 1);
  }
});
test('connection evidence requires observed ping AND read; any observed failure marks UNAVAILABLE', () => {
  const status = createObservedConnectionState(); assert.equal(status.getSnapshot().state, 'NOT_CONFIGURED');
  assert.equal(status.observe('ping', { isError: false }).state, 'NOT_CONFIGURED');
  assert.equal(status.observe('read', { isError: false }).state, 'READY');
  const failed = status.observe('read', { isError: true }); assert.equal(failed.state, 'UNAVAILABLE'); assert.ok(Date.parse(failed.verifiedAt));
  assert.equal(status.observe('read', { isError: false }).state, 'NOT_CONFIGURED');
  assert.equal(status.observe('ping', { isError: false }).state, 'READY');
});
