/** TEST_ONLY post-unload audit. Parent removes the native config bundle before installing this package. */
import assert from 'node:assert/strict';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { join, relative, isAbsolute, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
export const name = 'finance-p3-native-mcp-test-only-unload-audit';
export const inject = ['tools'];
export async function apply(ctx) {
  const config = JSON.parse(await readFile(new URL('./test-config.json', import.meta.url), 'utf8'));
  const root = await realpath(config.testRoot), evidence = await realpath(config.evidenceRoot), rel = relative(root, evidence);
  assert.ok(rel && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel));
  const report = { classification: 'TEST_ONLY_NOT_REAL_COMMERCIAL', identity: config.identity, status: 'RUNNING',
    checks: [], startedAt: new Date().toISOString(), manager: 'NOT_AVAILABLE', installedOrRemovedByProbe: false };
  async function check(id, operation) {
    try { report.checks.push({ id, status: 'PASS', detail: await operation() }); }
    catch { report.checks.push({ id, status: 'FAIL', error: 'TEST_ONLY audit assertion failed; payload withheld.' }); }
  }
  const before = JSON.parse(await readFile(join(evidence, 'connection-result.json'), 'utf8'));
  await check('prior-actual-native-dispatch-proof', async () => {
    assert.equal(before.identity, config.identity); assert.equal(before.status, 'PASS');
    assert.ok(before.checks.some(item => item.id === 'actual-stdio-native-ping-and-read-correlation' && item.status === 'PASS'));
    assert.equal(before.adapterRegistered, false);
    return { priorResult: 'PASS', serverName: config.serverName };
  });
  await check('native-owned-tools-unregistered-after-parent-removal', async () => {
    const names = ['ping', 'financial_statements'].map(tool => `mcp__${config.serverName}__${tool}`);
    assert.equal(ctx.tools.schemas().filter(tool => tool.name.startsWith(`mcp__${config.serverName}__`)).length, 0);
    for (const name of names) {
      assert.equal(ctx.tools.get(name), undefined);
      const result = await ctx.tools.execute({ name, arguments: {}, callId: `p3-native-unload-${randomUUID()}`, signal: AbortSignal.timeout(5000) });
      assert.equal(result.isError, true); assert.equal(result.error.info?.code, 'UNKNOWN_TOOL');
    }
    return { names, absentSchemas: true, actualPublicDispatchUnknown: true, nativeDisposalOwnsUnregistration: true };
  });
  report.finishedAt = new Date().toISOString(); report.status = report.checks.some(item => item.status === 'FAIL') ? 'FAIL' : 'PASS';
  await writeFile(join(evidence, 'post-unload-result.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.info('[TEST_ONLY P3 native MCP unload]', JSON.stringify({ status: report.status, result: join(evidence, 'post-unload-result.json') }));
}
