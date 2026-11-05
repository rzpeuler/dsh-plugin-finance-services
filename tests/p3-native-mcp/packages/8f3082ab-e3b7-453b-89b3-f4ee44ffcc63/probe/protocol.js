/** TEST_ONLY tiny legacy MCP server protocol. No Harness Tool definitions or SDK internals. */
import { randomUUID } from 'node:crypto';
export const VERSION = '2025-06-18';
export const CHALLENGE = 'TEST_ONLY_NATIVE_P3';
export const MAX_FRAME_BYTES = 16384;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const empty = value => value === undefined || exact(value, []);
const error = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const reply = (id, result) => ({ jsonrpc: '2.0', id, result });
const toolResult = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
const toolError = () => ({ content: [{ type: 'text', text: 'TEST_ONLY request is outside the fixed TOY FY2024 fixture.' }], isError: true });
export const TOOL_SCHEMAS = Object.freeze([
  { name: 'ping', description: 'TEST_ONLY local synthetic MCP connection check.',
    inputSchema: { type: 'object', properties: { challenge: { type: 'string', const: CHALLENGE } }, required: ['challenge'], additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'financial_statements', description: 'Read TEST_ONLY synthetic TOY FY2024 USD statements; not commercial data.',
    inputSchema: { type: 'object', properties: { symbol: { type: 'string', const: 'TOY' }, fiscalYear: { type: 'integer', const: 2024 } },
      required: ['symbol', 'fiscalYear'], additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
]);
export function validateFixture(fixture) {
  if (!exact(fixture, ['classification', 'symbol', 'fiscalYear', 'currency', 'scale', 'revenue', 'ebitda', 'license', 'revision'])
    || fixture.classification !== 'TEST_ONLY_NOT_REAL_COMMERCIAL' || fixture.symbol !== 'TOY' || fixture.fiscalYear !== 2024
    || fixture.currency !== 'USD' || fixture.scale !== 'millions' || fixture.revenue !== 2.2 || fixture.ebitda !== 0.44
    || fixture.license !== 'TEST_ONLY' || fixture.revision !== 'toy-native-r1') throw new Error('TEST_ONLY_FIXTURE_INVALID');
  return structuredClone(fixture);
}
export function createProtocol(fixtureValue, instanceId = randomUUID()) {
  const fixture = validateFixture(fixtureValue);
  let initialized = false, negotiated = false, calls = 0;
  return {
    receive(message) {
      const id = object(message) && Object.hasOwn(message, 'id') ? message.id : null;
      if (!object(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string'
        || (Object.hasOwn(message, 'id') && !(typeof id === 'string' || (typeof id === 'number' && Number.isSafeInteger(id)))))
        return error(null, -32600, 'Invalid JSON-RPC request.');
      if (!Object.hasOwn(message, 'id')) {
        if (message.method === 'notifications/initialized' && negotiated) initialized = true;
        // Cancellation/progress notifications need no response: operations are synchronous, bounded reads.
        return undefined;
      }
      if (message.method === 'ping') return empty(message.params) ? reply(id, {}) : error(id, -32602, 'Invalid ping parameters.');
      if (message.method === 'initialize') {
        if (negotiated) return error(id, -32600, 'Already initialized.');
        if (!object(message.params) || typeof message.params.protocolVersion !== 'string' || !object(message.params.capabilities)
          || !object(message.params.clientInfo)) return error(id, -32602, 'Invalid initialization.');
        negotiated = true;
        return reply(id, { protocolVersion: VERSION, capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'TEST_ONLY_finance_p3_toy', version: '1.0.0' } });
      }
      if (!initialized) return error(id, -32002, 'Initialization is required.');
      if (message.method === 'tools/list') {
        if (!empty(message.params) && !(exact(message.params, ['cursor']) && message.params.cursor === undefined))
          return error(id, -32602, 'Pagination is not supported by this bounded fixture.');
        return reply(id, { tools: structuredClone(TOOL_SCHEMAS) });
      }
      if (message.method === 'tools/call') {
        const params = message.params;
        if (!object(params) || typeof params.name !== 'string' || !object(params.arguments)
          || Object.keys(params).some(key => !['name', 'arguments', '_meta'].includes(key))) return error(id, -32602, 'Invalid tool call.');
        calls++;
        if (params.name === 'ping') {
          if (!exact(params.arguments, ['challenge']) || params.arguments.challenge !== CHALLENGE) return reply(id, toolError());
          return reply(id, toolResult({ classification: fixture.classification, challenge: CHALLENGE, protocolVersion: VERSION,
            initialized, instanceId, calls, fixtureRevision: fixture.revision }));
        }
        if (params.name === 'financial_statements') {
          if (!exact(params.arguments, ['symbol', 'fiscalYear']) || params.arguments.symbol !== 'TOY' || params.arguments.fiscalYear !== 2024)
            return reply(id, toolError());
          return reply(id, toolResult({ ...structuredClone(fixture), instanceId, calls }));
        }
        return error(id, -32602, 'Unknown TEST_ONLY tool.');
      }
      return error(id, -32601, 'Method not found.');
    },
  };
}
/** MCP stdio uses newline-delimited JSON, not Content-Length HTTP/LSP framing. */
export function createFrameParser(onMessage, onError, maxBytes = MAX_FRAME_BYTES) {
  let pending = Buffer.alloc(0), failed = false;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const fail = () => { if (!failed) { failed = true; pending = Buffer.alloc(0); onError(); } };
  return {
    push(chunk) {
      if (failed) return;
      // Node's stdin chunk size is bounded; reject pathological injected chunks in the self-test as well.
      if (!Buffer.isBuffer(chunk) || chunk.length > 65536) return fail();
      pending = Buffer.concat([pending, chunk]);
      let index;
      while ((index = pending.indexOf(10)) !== -1) {
        const line = pending.subarray(0, index); pending = pending.subarray(index + 1);
        if (line.length > maxBytes || !line.length) return fail();
        let message;
        try { message = JSON.parse(decoder.decode(line)); } catch { return fail(); }
        onMessage(message);
        if (failed) return;
      }
      if (pending.length > maxBytes) fail();
    },
    end() { if (pending.length) fail(); },
  };
}
