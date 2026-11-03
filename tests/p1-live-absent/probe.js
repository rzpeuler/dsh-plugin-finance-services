/** Disposable native rejection probe; uses no financial service injection or browser impersonation. */
import assert from 'node:assert/strict';
import { writeFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
export const inject = ['tools', 'storageDomain', 'typertGateway', 'connection'];
export async function apply(ctx, config) {
  const root = await realpath(config.bundleRoot);
  const result = { evidence: 'REAL_NATIVE_LOADER_HOST', phase: 'absent', status: 'RUNNING', checks: [], businessE2E: false };
  const peer = ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'none' });
  try {
    for (const [id, operation] of [
      ['service-removed', () => assert.equal(ctx.get('financeOperations'), undefined)],
      ['tool-removed', () => assert.equal(ctx.tools.get('finance_workspace'), undefined)],
      ['domain-handle-closed', () => assert.equal(ctx.storageDomain.get('financial_services'), undefined)],
      ['native-gateway-refuses-unloaded-method', async () => {
        await assert.rejects(ctx.typertGateway.invoke({ namespace: 'financeOperations', method: 'snapshot',
          args: { request: {} }, peer, signal: AbortSignal.timeout(3000) }), error => {
          result.rejectionCode = error?.code;
          return typeof error?.code === 'string' && error.code.startsWith('gateway/');
        });
      }],
    ]) {
      try { await operation(); result.checks.push({ id, status: 'PASS' }); }
      catch (error) { result.checks.push({ id, status: 'FAIL', error: String(error?.stack ?? error) }); throw error; }
    }
    result.status = 'PASS';
  } catch (error) {
    result.status = 'FAIL';
    result.error = String(error?.stack ?? error);
  } finally {
    await peer.dispose();
    result.checkedAt = new Date().toISOString();
    result.checksPassed = result.checks.filter(check => check.status === 'PASS').length;
    await writeFile(join(root, 'acceptance/P1-live-absent.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  }
}
