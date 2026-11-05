import test from 'node:test'
import assert from 'node:assert/strict'
import { crc32 } from 'node:zlib'
import { buildXlsx } from '../src/office/xlsx.js'

// Minimal reader for the stored ZIP we produce: local headers only, no compression.
function readStoredZip(buffer) {
  const entries = new Map()
  let offset = 0
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const flags = buffer.readUInt16LE(offset + 6)
    const method = buffer.readUInt16LE(offset + 8)
    const crc = buffer.readUInt32LE(offset + 14)
    const size = buffer.readUInt32LE(offset + 18)
    const nameLength = buffer.readUInt16LE(offset + 26)
    const extraLength = buffer.readUInt16LE(offset + 28)
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLength)
    const dataStart = offset + 30 + nameLength + extraLength
    const data = buffer.subarray(dataStart, dataStart + size)
    assert.equal(flags & 0x8, 0, 'no data descriptor')
    assert.equal(method, 0, 'stored entries only')
    entries.set(name, { crc, data })
    offset = dataStart + size
  }
  return entries
}

const workbook = buildXlsx({
  sheets: [
    { name: 'Inputs', rows: [['Line', 'Value'], [{ s: 'Revenue' }, 1000], [{ s: 'Growth' }, 0.06],
      [{ s: 'Total' }, { f: 'B2*(1+B3)', cached: 1060 }]] },
    { name: 'Checks', rows: [['Check', 'Result'], [{ s: 'Formula present' }, { b: true }]] },
  ],
})

test('the writer produces a readable stored ZIP with every required part', () => {
  const entries = readStoredZip(workbook)
  for (const name of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
    assert.ok(entries.has(name), `missing part ${name}`)
  }
})

test('every entry carries a matching CRC32 and the sheet XML holds the cells', () => {
  const entries = readStoredZip(workbook)
  for (const [name, entry] of entries) {
    assert.equal(entry.crc >>> 0, crc32(entry.data) >>> 0, `crc mismatch for ${name}`)
  }
  const sheet = entries.get('xl/worksheets/sheet1.xml').data.toString('utf8')
  assert.match(sheet, /<t xml:space="preserve">Revenue<\/t>/)
  assert.match(sheet, /<v>1000<\/v>/)
  assert.match(sheet, /<f>B2\*\(1\+B3\)<\/f><v>1060<\/v>/)
  assert.match(sheet, /<c r="B2">/)
  const checks = entries.get('xl/worksheets/sheet2.xml').data.toString('utf8')
  assert.match(checks, /t="b"><v>1<\/v>/)
})

test('sheet names and workbook relations are consistent', () => {
  const entries = readStoredZip(workbook)
  const book = entries.get('xl/workbook.xml').data.toString('utf8')
  assert.match(book, /<sheet name="Inputs" sheetId="1" r:id="rId1"\/>/)
  assert.match(book, /<sheet name="Checks" sheetId="2" r:id="rId2"\/>/)
  const rels = entries.get('xl/_rels/workbook.xml.rels').data.toString('utf8')
  assert.match(rels, /Target="worksheets\/sheet1\.xml"/)
  assert.match(rels, /Target="worksheets\/sheet2\.xml"/)
  assert.match(rels, /Target="styles\.xml"/)
})

test('the writer refuses unsafe sheet structures', () => {
  assert.throws(() => buildXlsx({ sheets: [] }), /XLSX_SHEETS_INVALID/)
  assert.throws(() => buildXlsx({ sheets: [{ name: 'bad/name', rows: [] }] }), /XLSX_SHEET_NAME_INVALID/)
  assert.throws(() => buildXlsx({ sheets: [{ name: 'a', rows: [] }, { name: 'a', rows: [] }] }), /XLSX_SHEET_NAME_INVALID/)
  assert.throws(() => buildXlsx({ sheets: [{ name: 'a'.repeat(32), rows: [] }] }), /XLSX_SHEET_NAME_INVALID/)
  assert.throws(() => buildXlsx({ sheets: [{ name: 'a', rows: new Array(5001).fill([]) }] }), /XLSX_ROWS_INVALID/)
  assert.throws(() => buildXlsx({ sheets: [{ name: 'a', rows: [new Array(201).fill(0)] }] }), /XLSX_ROW_INVALID/)
})

test('text is escaped so a value cannot break the sheet XML', () => {
  const escaped = buildXlsx({ sheets: [{ name: 'S', rows: [[{ s: '<tag> & "quote"' }]] }] })
  const sheet = readStoredZip(escaped).get('xl/worksheets/sheet1.xml').data.toString('utf8')
  assert.match(sheet, /&lt;tag&gt; &amp; &quot;quote&quot;/)
  assert.ok(!sheet.includes('<tag>'))
})
