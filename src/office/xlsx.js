import { crc32 } from 'node:zlib'

/**
 * Minimal in-process XLSX writer: stored (uncompressed) ZIP entries and SpreadsheetML parts.
 * It exists because the host offers no binary workspace write and no usable confined subprocess;
 * producing the bytes in-process is the only step that does not depend on either.
 */
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'

const escapeXml = value => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&apos;')

const columnName = index => {
  let name = ''
  let value = index + 1
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

function cellXml(cell, rowIndex, columnIndex) {
  const ref = `${columnName(columnIndex)}${rowIndex + 1}`
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'object' && 'f' in cell) {
    const cached = cell.cached === undefined ? '' : `<v>${Number(cell.cached)}</v>`
    return `<c r="${ref}"><f>${escapeXml(cell.f)}</f>${cached}</c>`
  }
  if (typeof cell === 'object' && 's' in cell) {
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.s)}</t></is></c>`
  }
  if (typeof cell === 'object' && 'b' in cell) return `<c r="${ref}" t="b"><v>${cell.b ? 1 : 0}</v></c>`
  const value = typeof cell === 'object' && 'v' in cell ? cell.v : cell
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value ?? '')}</t></is></c>`
}

function sheetXml(sheet) {
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => cellXml(cell, rowIndex, columnIndex)).join('')
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')
  return `${XML_HEADER}<worksheet xmlns="${NS_MAIN}"><sheetData>${rows}</sheetData></worksheet>`
}

const STYLES = `${XML_HEADER}<styleSheet xmlns="${NS_MAIN}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>`
  + '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
  + '<borders count="1"><border/></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'

function workbookXml(sheets) {
  const entries = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')
  return `${XML_HEADER}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>${entries}</sheets></workbook>`
}

function workbookRels(sheets) {
  const sheetRels = sheets.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')
  const stylesId = `rId${sheets.length + 1}`
  return `${XML_HEADER}<Relationships xmlns="${NS_PKG_REL}">${sheetRels}`
    + `<Relationship Id="${stylesId}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`
}

function packageRels() {
  return `${XML_HEADER}<Relationships xmlns="${NS_PKG_REL}">`
    + `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
}

function contentTypes(sheets) {
  const overrides = sheets.map((_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  return `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + `${overrides}`
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>'
}

/** One stored ZIP entry: local header, payload, then a central-directory record later. */
function localHeader(name, bytes) {
  const nameBytes = Buffer.from(name, 'utf8')
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt16LE(0, 12)
  header.writeUInt32LE(crc32(bytes) >>> 0, 14)
  header.writeUInt32LE(bytes.length, 18)
  header.writeUInt32LE(bytes.length, 22)
  header.writeUInt16LE(nameBytes.length, 26)
  header.writeUInt16LE(0, 28)
  return { header, nameBytes }
}

function centralHeader(name, bytes, offset) {
  const nameBytes = Buffer.from(name, 'utf8')
  const record = Buffer.alloc(46)
  record.writeUInt32LE(0x02014b50, 0)
  record.writeUInt16LE(20, 4)
  record.writeUInt16LE(20, 6)
  record.writeUInt16LE(0, 8)
  record.writeUInt16LE(0, 10)
  record.writeUInt16LE(0, 12)
  record.writeUInt16LE(0, 14)
  record.writeUInt32LE(crc32(bytes) >>> 0, 16)
  record.writeUInt32LE(bytes.length, 20)
  record.writeUInt32LE(bytes.length, 24)
  record.writeUInt16LE(nameBytes.length, 28)
  record.writeUInt16LE(0, 30)
  record.writeUInt16LE(0, 32)
  record.writeUInt16LE(0, 34)
  record.writeUInt16LE(0, 36)
  record.writeUInt32LE(0, 38)
  record.writeUInt32LE(offset, 42)
  return { record, nameBytes }
}

function zip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, text] of entries) {
    const bytes = Buffer.from(text, 'utf8')
    const { header, nameBytes } = localHeader(name, bytes)
    locals.push(header, nameBytes, bytes)
    const central = centralHeader(name, bytes, offset)
    centrals.push(central.record, central.nameBytes)
    offset += header.length + nameBytes.length + bytes.length
  }
  const centralOffset = offset
  const centralBytes = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(centralOffset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, centralBytes, end])
}

/**
 * Build an XLSX byte array. `sheets` is `[{ name, rows }]` where a cell is a plain value,
 * `{ s }` for an inline string, `{ v }` for a number, `{ b }` for a boolean,
 * or `{ f, cached }` for a live formula with an optional cached result.
 */
export function buildXlsx({ sheets }) {
  if (!Array.isArray(sheets) || sheets.length === 0 || sheets.length > 32) throw new Error('XLSX_SHEETS_INVALID')
  const seen = new Set()
  for (const sheet of sheets) {
    if (!sheet || typeof sheet.name !== 'string' || !sheet.name || sheet.name.length > 31) throw new Error('XLSX_SHEET_NAME_INVALID')
    if (/[\\/?*[\]:]/.test(sheet.name) || seen.has(sheet.name)) throw new Error('XLSX_SHEET_NAME_INVALID')
    seen.add(sheet.name)
    if (!Array.isArray(sheet.rows) || sheet.rows.length > 5000) throw new Error('XLSX_ROWS_INVALID')
    for (const row of sheet.rows) {
      if (!Array.isArray(row) || row.length > 200) throw new Error('XLSX_ROW_INVALID')
    }
  }
  const entries = [
    ['[Content_Types].xml', contentTypes(sheets)],
    ['_rels/.rels', packageRels()],
    ['xl/workbook.xml', workbookXml(sheets)],
    ['xl/_rels/workbook.xml.rels', workbookRels(sheets)],
    ['xl/styles.xml', STYLES],
    ...sheets.map((sheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet)]),
  ]
  return zip(entries)
}
