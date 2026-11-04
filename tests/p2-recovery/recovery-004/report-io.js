/** TEST_ONLY evidence recorder. File failures are test failures, never cleanup control flow. */
import { open, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Capture the original filesystem failure without reducing UNKNOWN to a guessed OS cause. */
export const ioErrorInfo = error => ({ name: error?.name ?? 'Error', code: error?.code ?? null,
  errno: error?.errno ?? null, syscall: error?.syscall ?? null, path: error?.path ?? null,
  dest: error?.dest ?? null, message: String(error?.message ?? error), stack: String(error?.stack ?? error) });

/** Keep one append handle; checkpoint the owned run sparingly and publish latest only after cleanup. */
export async function createProbeRecorder({ runRoot, latestPath, report, checkpointEvery = 50 }) {
  const journalPath = join(runRoot, 'nativeFixture.jsonl');
  report.io = { policy: 'append-only-journal; owned-checkpoint-every-50; terminal-only-atomic-latest',
    journalPath, failures: [], latestPublished: false, terminalReceipt: join(runRoot, 'result.json') };
  let journal;
  let journalBroken = false;
  let checkpointsBroken = false;
  let records = 0;
  async function failed(operation, error) {
    const item = { id: `report-io:${report.io.failures.length + 1}`, status: 'FAIL', operation,
      recordedAt: new Date().toISOString(), error: ioErrorInfo(error) };
    report.io.failures.push(item);
    report.status = 'FAIL';
    if ('recoveryStatus' in report) report.recoveryStatus = 'FAIL';
    // One independent unique receipt, not a retry of the failed target. If this also fails, preserve both errors in memory/stderr.
    try { await writeFile(join(runRoot, `io-failure-${report.io.failures.length}-${randomUUID()}.json`), JSON.stringify(item, null, 2) + '\n', { flag: 'wx' }); }
    catch (receiptError) {
      report.io.failures.push({ id: `report-io:${report.io.failures.length + 1}`, status: 'FAIL', operation: 'write-io-failure-receipt',
        recordedAt: new Date().toISOString(), error: ioErrorInfo(receiptError) });
    }
    console.error('[P2 TEST_ONLY evidence I/O failure]', JSON.stringify(item));
  }
  async function atomic(path, text, tag) {
    const temporary = join(runRoot, `${tag}-${randomUUID()}.tmp`);
    await writeFile(temporary, text, { flag: 'wx' });
    // Both are on the same acceptance volume. Never delete the old target or retry a failed rename blindly.
    await rename(temporary, path);
  }
  try { journal = await open(journalPath, 'ax'); }
  catch (error) { journalBroken = true; await failed('open-append-journal', error); }
  async function append(item) {
    if (journalBroken || !journal) return;
    try { await journal.appendFile(JSON.stringify(item) + '\n', 'utf8'); }
    catch (error) { journalBroken = true; await failed('append-journal', error); }
  }
  async function checkpoint() {
    if (checkpointsBroken) return;
    try {
      if (journal && !journalBroken) await journal.sync();
      await atomic(join(runRoot, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'checkpoint');
    } catch (error) { checkpointsBroken = true; await failed('owned-run-checkpoint', error); }
  }
  async function record(item) {
    await append(item);
    records++;
    if (records % checkpointEvery === 0) await checkpoint();
  }
  async function finish() {
    await append({ id: 'probe-terminal', status: report.status, finishedAt: report.finishedAt,
      checksPassed: report.checksPassed, checksFailed: report.checksFailed, checksNotRun: report.checksNotRun });
    if (journal) {
      try { if (!journalBroken) await journal.sync(); }
      catch (error) { await failed('sync-terminal-journal', error); }
      try { await journal.close(); }
      catch (error) { await failed('close-journal', error); }
      journal = undefined;
    }
    // A failed periodic checkpoint is not retried. The terminal receipt below has a new, never-opened path.
    await checkpoint();
    if (report.io.failures.length) report.status = 'FAIL';
    try {
      // Unique owned temporary file avoids repeatedly opening/truncating the shared latest pathname.
      report.io.latestPublished = true;
      await atomic(latestPath, JSON.stringify(report, null, 2) + '\n', 'latest-terminal');
    } catch (error) {
      report.io.latestPublished = false;
      await failed('publish-terminal-latest', error);
    }
    if (report.io.failures.length) report.status = 'FAIL';
    try { await writeFile(report.io.terminalReceipt, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); }
    catch (error) { await failed('write-terminal-receipt', error); }
    console.info('[P2 TEST_ONLY terminal]', JSON.stringify({ runId: report.runId, status: report.status,
      checksPassed: report.checksPassed, checksFailed: report.checksFailed, checksNotRun: report.checksNotRun,
      ioFailures: report.io.failures.length, latestPublished: report.io.latestPublished, runRoot }));
    return report;
  }
  return { record, checkpoint, finish };
}
