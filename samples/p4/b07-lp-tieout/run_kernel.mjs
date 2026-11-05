/** Run the shipped LP tie-out kernel on the fixture and keep its exact output. */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tieout } from '../../../src/business/lp-tieout.js'

const here = dirname(fileURLToPath(import.meta.url))
const input = readFileSync(join(here, 'inputs.json'), 'utf8')
const result = tieout(input)
writeFileSync(join(here, 'kernel-result.json'), JSON.stringify(result, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({
  recommendation: result.recommendation,
  fund: result.fund?.status,
  lps: result.statements?.length,
  flags: result.flags.length,
}))
