/** Creator-side proof that the in-process XLSX writer produces a workbook openpyxl can read. */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildXlsx } from '../src/office/xlsx.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = join(root, 'samples/p4/inprocess-xlsx')
await mkdir(outDir, { recursive: true })

const workbook = buildXlsx({
  sheets: [
    { name: 'Model', rows: [
      [{ s: 'Line item' }, { s: 'In-process XLSX' }],
      [{ s: 'Revenue' }, 1000],
      [{ s: 'Growth' }, 0.06],
      [{ s: 'FY2025E' }, { f: 'B2*(1+B3)', cached: 1060 }],
      [{ s: 'Check' }, { f: 'B4-B2*(1+B3)', cached: 0 }],
    ] },
    { name: 'Notes', rows: [
      [{ s: 'Generated' }, { s: 'No subprocess, no binary workspace write' }],
      [{ s: 'Trust' }, { s: 'TECHNICAL_TEST_ONLY' }],
    ] },
  ],
})

const path = join(outDir, 'inprocess-xlsx-technology-only.xlsx')
await writeFile(path, workbook)
console.log(JSON.stringify({ path, bytes: workbook.length }))
