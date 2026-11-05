// Run the shipped GL reconciliation kernel over the TEST_ONLY extracts.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reconcileGl } from '../../../src/business/gl-reconciliation.js'

const here = dirname(fileURLToPath(import.meta.url))
const input = await readFile(join(here, 'inputs.json'), 'utf8')
const result = reconcileGl(input)
await writeFile(join(here, 'kernel-result.json'), JSON.stringify(result, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({
  status: result.status, counts: result.summary.counts, joinedRows: result.summary.joinedRows,
  breaks: result.breaks.length, posting: result.posting, journalEntries: result.journalEntries.status,
  arithmetic: result.checks.arithmetic,
}, null, 2))
