/** TEST_ONLY executable stdio endpoint. Only this package's fixed fixture is read. */
import { readFile } from 'node:fs/promises';
import { createFrameParser, createProtocol } from './protocol.js';
const fixture = JSON.parse(await readFile(new URL('./toy-fixture.json', import.meta.url), 'utf8'));
const protocol = createProtocol(fixture);
let count = 0, closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true; process.exitCode = code; process.stdin.pause(); process.stdin.destroy();
  process.stdout.end(); clearTimeout(deadline);
}
function send(message) {
  const text = JSON.stringify(message) + '\n';
  if (Buffer.byteLength(text) > 16384) return close(1);
  if (!process.stdout.write(text)) process.stdin.pause();
}
const parser = createFrameParser(message => {
  if (closing) return;
  if (++count > 256) return close(1);
  const response = protocol.receive(message);
  if (response !== undefined) send(response);
}, () => {
  send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid or oversized TEST_ONLY JSON frame.' } });
  close(1);
});
// Bound abandoned disposable test processes. Native client alone owns shutdown/reconnect.
const deadline = setTimeout(() => close(), 600000);
process.stdout.on('drain', () => { if (!closing) process.stdin.resume(); });
process.stdout.on('error', () => close(1));
process.stdin.on('data', chunk => parser.push(chunk));
process.stdin.on('end', () => { parser.end(); close(); });
process.stdin.on('error', () => close(1));
process.on('SIGTERM', () => close());
process.on('SIGINT', () => close());
