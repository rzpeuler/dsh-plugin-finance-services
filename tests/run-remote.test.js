import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createFinanceRunsRemoteContract } from '../src/run/remote.js'

test('declares strict session-scoped and recent Run read methods', () => {
  const { schemas, remote } = createFinanceRunsRemoteContract(z)
  assert.deepEqual(remote.descriptors.map(item => item.method), ['snapshot', 'listRecent', 'follow', 'followRecent'])
  assert.equal(remote.descriptors.find(item => item.method === 'follow').mode, 'stream')
  assert.equal(remote.descriptors.find(item => item.method === 'followRecent').mode, 'stream')
  assert.deepEqual(schemas.SnapshotRequest.parse({ sessionId: 'session-1' }), { sessionId: 'session-1' })
  assert.equal(schemas.RecentRequest.parse({}).limit, 100)
  assert.throws(() => schemas.SnapshotRequest.parse({ sessionId: 'session-1', prompt: 'private' }))
  assert.throws(() => schemas.RecentRequest.parse({ limit: 0 }))
  assert.throws(() => schemas.Snapshot.parse({ snapshotJson: 'not json' }))
  assert.throws(() => schemas.Recent.parse({ runsJson: '{}', extra: true }))
})
