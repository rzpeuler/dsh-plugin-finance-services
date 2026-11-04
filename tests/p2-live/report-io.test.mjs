/** TEST_ONLY real-filesystem recorder tests. No native Service or model is stubbed or invoked. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createProbeRecorder } from './report-io.js';
const base = join(dirname(fileURLToPath(import.meta.url)), 'io-test-results');
async function setup(label) {
  const root = join(base, `${label}-${randomUUID()}`);
  await mkdir(root, { recursive: true });
  const report = { runId: randomUUID(), status: 'RUNNING', checks: [] };
  return { root, report };
}

test('journal is primary and latest is published only at terminal', async () => {
  const { root, report } = await setup('success');
  const latest = join(root, 'latest.json');
  const recorder = await createProbeRecorder({ runRoot: root, latestPath: latest, report });
  for (let i = 0; i < 55; i++) {
    const item = { id: `TEST_ONLY-${i}`, status: 'PASS', timing: { elapsedMs: 0 } };
    report.checks.push(item); await recorder.record(item);
    await assert.rejects(() => access(latest), error => error.code === 'ENOENT');
  }
  const checkpoint = JSON.parse(await readFile(join(root, 'report.json'), 'utf8'));
  assert.equal(checkpoint.checks.length, 50);
  report.status = 'PASS'; report.checksPassed = 55; report.checksFailed = 0; report.checksNotRun = 0; report.finishedAt = new Date().toISOString();
  await recorder.finish();
  const saved = JSON.parse(await readFile(latest, 'utf8'));
  assert.equal(saved.status, 'PASS'); assert.equal(saved.checks.length, 55); assert.equal(saved.io.latestPublished, true);
  assert.equal(saved.io.failures.length, 0);
  const journal = (await readFile(join(root, 'nativeFixture.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(journal.length, 56); assert.equal(journal.at(-1).id, 'probe-terminal');
  assert.equal(JSON.parse(await readFile(join(root, 'result.json'), 'utf8')).status, 'PASS');
});

test('real checkpoint and publication failures cannot interrupt subsequent cleanup records', async () => {
  const { root, report } = await setup('contained-errors');
  const latest = join(root, 'latest-is-directory');
  await mkdir(latest);
  await mkdir(join(root, 'report.json'));
  const recorder = await createProbeRecorder({ runRoot: root, latestPath: latest, report });
  for (let i = 0; i < 50; i++) {
    const item = { id: `TEST_ONLY-${i}`, status: 'PASS' };
    report.checks.push(item); await recorder.record(item);
  }
  assert.equal(report.io.failures.length, 1); assert.equal(report.status, 'FAIL');
  let cleanupOperations = 0;
  for (const name of ['owned-handle', 'owned-workspace', 'peer']) {
    cleanupOperations++;
    const item = { id: `TEST_ONLY-cleanup-${name}`, status: 'PASS' };
    report.checks.push(item); await recorder.record(item);
  }
  report.checksPassed = report.checks.length; report.checksFailed = 0; report.checksNotRun = 0; report.finishedAt = new Date().toISOString();
  await recorder.finish();
  assert.equal(cleanupOperations, 3);
  assert.equal(report.io.failures.length, 2, 'No blind retry should add repeated errors for the same target');
  assert.deepEqual(report.io.failures.map(item => item.operation), ['owned-run-checkpoint', 'publish-terminal-latest']);
  const final = JSON.parse(await readFile(join(root, 'result.json'), 'utf8'));
  assert.equal(final.status, 'FAIL'); assert.equal(final.io.latestPublished, false);
  assert.ok(final.io.failures.every(item => item.error.code && item.error.syscall && item.error.stack));
  assert.equal(final.checks.filter(item => item.id.startsWith('TEST_ONLY-cleanup-')).length, 3);
});
