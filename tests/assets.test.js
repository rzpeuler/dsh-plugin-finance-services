import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Static asset integrity only. Native Skill Loader/discovery is deliberately not mocked here.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'assets')
const read = p => fs.readFileSync(p)
const text = p => read(p).toString('utf8')
const json = p => JSON.parse(text(p))
const digest = data => createHash('sha256').update(data).digest('hex')
const manifestPath = path.join(assets, 'agent-manifest.json')
const manifest = json(manifestPath)
const mapping = json(path.join(root, 'audit/agents/agent-mapping.json'))
const inventory = json(path.join(root, 'audit/upstream/upstream-inventory.json'))
const variants = json(path.join(root, 'audit/upstream/skill-variants.json')).groups.filter(g => g.variants.some(v => ['agent-plugins', 'vertical-plugins', 'partner-built'].includes(v.family)))
const sourceRoot = manifest.sourceRoot
const archiveRoot = path.join(assets, 'source-archive')
const roles = manifest.roles
const mains = roles.filter(r => r.kind === 'main')
const workers = roles.filter(r => r.kind === 'worker')
const skills = new Map(manifest.skills.map(s => [s.name, s]))
const sourceRead = p => read(path.join(sourceRoot, ...p.split('/')))
const archiveRead = p => read(path.join(archiveRoot, ...p.split('/')))
const assetRead = p => read(path.join(assets, ...p.split('/')))
const sorted = values => [...values].sort()
const adaptedSource = source => source.replace(/\.\/out\/?/g, '<runtime-assigned-artifact-directory>/')
const stripFrontmatter = source => {
  const result = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(source)
  assert.ok(result, 'first-line YAML frontmatter required')
  return { header: result[0], body: source.slice(result[0].length) }
}
function walk(directory, relative = '') {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const next = path.join(directory, entry.name)
    const rel = relative ? `${relative}/${entry.name}` : entry.name
    const status = fs.lstatSync(next)
    assert.equal(status.isSymbolicLink(), false, `symlink/junction forbidden: ${rel}`)
    if (status.isDirectory()) files.push(...walk(next, rel))
    else {
      assert.ok(status.isFile(), `regular file required: ${rel}`)
      files.push(rel)
    }
  }
  return files.sort()
}
function treeHash(directory) {
  return digest(walk(directory).map(p => `${p}\0${digest(read(path.join(directory, ...p.split('/'))))}\n`).join(''))
}
function sourceObject(role) {
  const main = mapping.agents.find(a => `finance-${a.slug}` === (role.parentId || role.id))
  assert.ok(main, role.id)
  return role.kind === 'main' ? main : main.workers.find(w => `${role.parentId}-${w.file_slug}` === role.id)
}
let passed = 0
let declared = 0
function assetTest(name, body) {
  declared++
  test(name, () => { body(); passed++ })
}

assetTest('P0 complete upstream tree remains unchanged, exact 363 files and tree SHA', () => {
  assert.equal(inventory.summary.fileCount, 363)
  assert.equal(manifest.sourceTreeSha256, inventory.summary.sourceTreeSha256)
  assert.equal(treeHash(sourceRoot), manifest.sourceTreeSha256)
  assert.deepEqual(walk(sourceRoot), sorted(inventory.files.map(f => f.path)))
  for (const source of inventory.files) assert.equal(digest(sourceRead(source.path)), source.sha256, source.path)
})

assetTest('schema v1 contains exact stable main and worker IDs with source names', () => {
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(roles.length, 40)
  assert.equal(mains.length, 10)
  assert.equal(workers.length, 30)
  assert.equal(new Set(roles.map(r => r.id)).size, 40)
  for (const main of mapping.agents) {
    const role = mains.find(r => r.id === `finance-${main.slug}`)
    assert.ok(role)
    assert.equal(role.parentId, null)
    assert.equal(role.name, main.plugin_prompt.frontmatter.name)
    assert.deepEqual(role.workerPresetIds, main.workers.map(w => `${role.id}-${w.file_slug}`))
    for (const worker of main.workers) {
      const child = workers.find(w => w.id === `${role.id}-${worker.file_slug}`)
      assert.equal(child.name, worker.name)
      assert.equal(child.parentId, role.id)
      assert.deepEqual(child.workerPresetIds, [])
    }
  }
})

assetTest('40 source config/prompt hashes, original bodies and distinct adapted personas are preserved', () => {
  const personaHashes = new Set()
  for (const role of roles) {
    const original = sourceObject(role)
    assert.equal(digest(sourceRead(role.source.path)), role.source.sha256)
    assert.equal(digest(archiveRead(role.source.path)), role.source.sha256)
    assert.equal(digest(sourceRead(role.prompt.originalPath)), role.prompt.originalSha256)
    assert.equal(digest(archiveRead(role.prompt.originalPath)), role.prompt.originalSha256)
    const promptBytes = assetRead(role.prompt.adaptedPath)
    assert.equal(digest(promptBytes), role.prompt.adaptedSha256)
    const prompt = promptBytes.toString('utf8')
    const sourceText = role.kind === 'main' ? sourceRead(role.prompt.originalPath).toString('utf8') : original.system_prompt.text
    assert.equal(digest(Buffer.from(sourceText)), role.prompt.originalTextSha256)
    const originalBody = role.kind === 'main' ? stripFrontmatter(sourceText).body : sourceText
    assert.ok(prompt.endsWith(adaptedSource(originalBody)), role.id)
    assert.ok(prompt.startsWith('# DSH FINANCIAL SERVICES ADAPTATION'))
    assert.ok(prompt.includes(`Role \`${role.id}\``))
    assert.ok(prompt.includes('finance_data_query'))
    assert.ok(prompt.includes('P3 NOT_CONFIGURED'))
    assert.ok(prompt.includes('NOT a P5 deterministic enforced Gate'))
    assert.ok(prompt.includes('runtime-assigned financial artifact directory'))
    assert.equal(/\{\{[\s\S]*?\}\}/.test(prompt), false, 'nativePersona strict variable safety')
    if (role.kind === 'main') {
      assert.equal(prompt.includes(stripFrontmatter(sourceText).header), false)
      for (const worker of original.workers) assert.ok(prompt.includes(`\`${worker.name}\` → preset ID \`${role.id}-${worker.file_slug}\``))
    } else assert.ok(prompt.includes('This Worker cannot delegate'))
    personaHashes.add(digest(promptBytes))
  }
  assert.equal(personaHashes.size, 40)
})

assetTest('Managed YAML tool baseline: ten leaf writers, two source shell exceptions, exact server scope', () => {
  assert.equal(roles.filter(r => r.writer).length, 10)
  assert.equal(roles.filter(r => r.shellRestricted).length, 2)
  for (const role of roles) {
    const original = sourceObject(role)
    assert.deepEqual(role.builtinTools, original.tools.builtin_allowlist)
    assert.deepEqual(role.allowedMcpServers, original.tools.mcp_server_allowlist)
    assert.equal(role.writer, role.builtinTools.includes('write'))
    assert.equal(role.shellRestricted, role.builtinTools.includes('bash'))
    assert.ok(role.builtinTools.every(t => t === t.toLowerCase()))
    assert.deepEqual(role.exposedFileTools, role.builtinTools.filter(t => ['read', 'grep', 'glob', 'write', 'edit'].includes(t)))
    assert.ok(!role.exposedFileTools.includes('bash'))
    if (role.kind === 'main') assert.ok(!role.builtinTools.includes('write') && !role.builtinTools.includes('edit') && !role.builtinTools.includes('bash'))
    if (role.writer) assert.deepEqual(role.allowedMcpServers, [])
  }
})

assetTest('Worker skills exactly equal source YAML, main-only explicit domain expansion covers all 63', () => {
  const union = new Set(mains.flatMap(r => r.skillNames))
  assert.deepEqual(sorted(union), sorted(skills.keys()))
  for (const role of roles) {
    const original = sourceObject(role)
    assert.equal(new Set(role.skillNames).size, role.skillNames.length)
    for (const name of role.skillNames) assert.ok(skills.has(name))
    if (role.kind === 'worker') {
      assert.deepEqual(role.skillNames, original.skills.map(s => s.name))
      assert.deepEqual(role.addedSkillScope, [])
    } else {
      assert.deepEqual(role.originalSkillNames, original.main_skills.map(s => s.name))
      assert.deepEqual(sorted(role.skillNames), sorted(new Set([...role.originalSkillNames, ...role.addedSkillScope.map(s => s.name)])))
      for (const addition of role.addedSkillScope) {
        assert.ok(addition.sourceDomains.length)
        assert.match(addition.reason, /does not add MCP, file write, shell or delegation rights/)
      }
    }
  }
})

assetTest('63 skills preserve valid first-line frontmatter, exact source body and complete resource files', () => {
  assert.equal(manifest.skills.length, 63)
  assert.equal(skills.size, 63)
  for (const skill of manifest.skills) {
    assert.equal(skill.directory, `skills/${skill.name}`)
    const sourceGroup = variants.find(v => v.name === skill.name)
    assert.ok(sourceGroup)
    const variant = sourceGroup.variants[0]
    const targetFiles = walk(path.join(assets, skill.directory))
    assert.deepEqual(targetFiles, sorted(variant.files.map(f => f.path)))
    assert.deepEqual(targetFiles, sorted(skill.files.map(f => f.path)))
    const adapted = assetRead(`${skill.directory}/SKILL.md`).toString('utf8')
    const original = sourceRead(variant.path).toString('utf8')
    const adaptedParts = stripFrontmatter(adapted)
    const originalParts = stripFrontmatter(original)
    assert.equal(adaptedParts.header, originalParts.header)
    assert.match(adaptedParts.header, new RegExp(`^name: ${skill.name}\\s*$`, 'm'))
    assert.match(adaptedParts.header, /^description:\s*\S/m)
    assert.match(adaptedParts.body, /^\n> \*\*DSH FINANCIAL SERVICES ADAPTATION/)
    assert.ok(adapted.endsWith(adaptedSource(originalParts.body)), skill.name)
    for (const file of skill.files) {
      const target = assetRead(`${skill.directory}/${file.path}`)
      assert.equal(digest(target), file.sha256)
      const originalFile = variant.files.find(f => f.path === file.path)
      assert.equal(file.originalSha256, originalFile.sha256)
      if (file.path !== 'SKILL.md') assert.equal(digest(target), originalFile.sha256)
    }
  }
})

assetTest('all 111 source skill origins and their complete deduplication tree proofs are traceable', () => {
  assert.equal(manifest.skills.reduce((total, s) => total + s.origins.length, 0), 111)
  for (const skill of manifest.skills) {
    const group = variants.find(v => v.name === skill.name)
    assert.equal(group.fullDirectoryVariantCount, 1)
    assert.deepEqual(sorted(skill.origins.map(o => o.path)), sorted(group.variants.map(v => v.path)))
    for (const origin of skill.origins) {
      assert.equal(digest(sourceRead(origin.path)), origin.sha256)
      assert.equal(digest(archiveRead(origin.path)), origin.sha256)
      assert.equal(origin.treeSha256, group.variants[0].treeSha256)
      const originalDirectory = path.posix.dirname(origin.path)
      for (const file of origin.files) {
        assert.equal(digest(sourceRead(`${originalDirectory}/${file.path}`)), file.sha256)
        assert.equal(digest(archiveRead(`${originalDirectory}/${file.path}`)), file.sha256)
      }
      // The upstream inventory skill-tree contract is the same NUL-delimited path/hash contract as its source tree.
      const treeEntries = origin.files.slice().sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
      assert.equal(digest(treeEntries.map(f => `${f.path}\0${f.sha256}\n`).join('')), origin.treeSha256)
    }
  }
})

assetTest('every role root exists with direct child skill folders and full regular-file resources, no links', () => {
  for (const role of roles) {
    assert.equal(role.skillRoot, `role-skills/${role.id}`)
    const scopeRoot = path.join(assets, role.skillRoot)
    assert.ok(fs.lstatSync(scopeRoot).isDirectory())
    const marker = json(path.join(scopeRoot, '.scope.json'))
    assert.equal(marker.roleId, role.id)
    assert.equal(marker.grantsTools, false)
    assert.deepEqual(marker.skillNames, role.skillNames)
    const directChildren = fs.readdirSync(scopeRoot, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
    assert.deepEqual(sorted(directChildren), sorted(role.skillNames))
    for (const name of role.skillNames) {
      const directory = path.join(scopeRoot, name)
      assert.ok(fs.lstatSync(path.join(directory, 'SKILL.md')).isFile())
      const skill = skills.get(name)
      assert.deepEqual(walk(directory), sorted(skill.files.map(f => f.path)))
      for (const file of skill.files) assert.equal(digest(read(path.join(directory, ...file.path.split('/')))), file.sha256)
    }
    walk(scopeRoot)
  }
})

assetTest('13 original review nodes and 20 groups / 44 conditional steps preserve exact quotes and source hashes', () => {
  assert.equal(mains.reduce((sum, r) => sum + r.reviewCheckpoints.length, 0), 13)
  assert.equal(mains.reduce((sum, r) => sum + r.conditionalSkillReviews.length, 0), 20)
  assert.equal(mains.reduce((sum, r) => sum + r.conditionalSkillReviews.reduce((s, g) => s + g.steps.length, 0), 0), 44)
  function verifySource(value) {
    if (!value || typeof value !== 'object') return
    if (value.source?.path && value.source_quote) {
      const bytes = sourceRead(value.source.path)
      assert.equal(value.source.sha256, digest(bytes))
      const lines = bytes.toString('utf8').split(/\r?\n/)
      const quote = lines.slice(value.source.line_start - 1, value.source.line_end).join('\n')
      assert.equal(quote, value.source_quote)
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(verifySource)
      else if (child && typeof child === 'object') verifySource(child)
    }
  }
  for (const role of mains) {
    const source = sourceObject(role)
    assert.deepEqual(role.reviewCheckpoints.map(r => r.id), source.review_checkpoints.map(r => r.id))
    assert.deepEqual(role.conditionalSkillReviews.map(r => r.source_quote), source.conditional_skill_reviews.map(r => r.source_quote))
    role.reviewCheckpoints.forEach(verifySource)
    role.conditionalSkillReviews.forEach(verifySource)
  }
  assert.equal(manifest.reviewGateStatus, 'PROMPT_CHECKPOINTS_PRESERVED_P5_NOT_IMPLEMENTED')
})

assetTest('missing LBO, comps and Nike templates explicitly BLOCKED without invented files', () => {
  assert.deepEqual(sorted(manifest.skills.filter(s => s.assetStatus === 'BLOCKED').map(s => s.name)), ['comps-analysis', 'fsi-strip-profile', 'lbo-model'])
  for (const [name, pattern] of [['lbo-model', /LBO_Model\.xlsx/], ['comps-analysis', /comps_example\.xlsx/], ['fsi-strip-profile', /Nike.*\.pptx/]]) {
    const skill = skills.get(name)
    const issues = skill.issues.filter(i => pattern.test(i.rawReference))
    assert.ok(issues.length, name)
    assert.ok(issues.some(i => i.status === 'MISSING_LOCAL_REFERENCE' && i.adaptationStatus === 'BLOCKED'))
    for (const issue of issues) {
      assert.ok(issue.sourcePath && issue.sourceSha256 && issue.line)
      assert.equal(digest(sourceRead(issue.sourcePath)), issue.sourceSha256)
    }
    const prompt = assetRead(`${skill.directory}/SKILL.md`).toString('utf8')
    assert.match(prompt, /Asset status: \*\*BLOCKED\*\*/)
    assert.match(prompt, /never fabricate/)
    assert.ok(!skill.files.some(f => pattern.test(f.path)))
  }
})

assetTest('external runtime paths and recalc scripts retain coordinates and require P4 adaptation', () => {
  let external = 0
  for (const skill of manifest.skills) {
    const issues = skill.issues.filter(i => ['EXTERNAL_RUNTIME_PATH_NOT_BUNDLED', 'EXTERNAL_RUNTIME_SCRIPT_NOT_BUNDLED'].includes(i.status))
    if (!issues.length) continue
    assert.ok(['BLOCKED', 'EXTERNAL_RUNTIME_ADAPTATION_REQUIRED'].includes(skill.assetStatus))
    for (const issue of issues) {
      external++
      assert.equal(issue.adaptationStatus, 'EXTERNAL_RUNTIME_ADAPTATION_REQUIRED')
      assert.equal(digest(sourceRead(issue.sourcePath)), issue.sourceSha256)
      assert.ok(issue.line > 0)
    }
    assert.match(assetRead(`${skill.directory}/SKILL.md`).toString('utf8'), /require P4 adaptation/)
  }
  assert.ok(external > 0)
  assert.equal(manifest.officeExecutionStatus, 'EXTERNAL_RUNTIME_ADAPTATION_REQUIRED_P4')
})

assetTest('41 complete financial command bodies retain hashes, parameters and safe explicit draft routing', () => {
  assert.equal(manifest.commands.length, 41)
  assert.equal(new Set(manifest.commands.map(c => c.id)).size, 41)
  const originals = inventory.files.filter(f => f.classification === 'business-command')
  assert.deepEqual(sorted(manifest.commands.map(c => c.source.path)), sorted(originals.map(c => c.path)))
  const mainIds = new Set(mains.map(r => r.id))
  for (const command of manifest.commands) {
    assert.ok(command.id.startsWith(`finance-${command.mappingEvidence.sourceGroup}-`))
    assert.equal(digest(sourceRead(command.source.path)), command.source.sha256)
    assert.equal(digest(assetRead(command.promptPath)), command.source.sha256)
    assert.deepEqual(assetRead(command.promptPath), sourceRead(command.source.path))
    assert.equal(command.promptSha256, command.source.sha256)
    assert.ok(command.targetPresetChoices.length)
    assert.deepEqual(command.targetPresetIds, command.targetPresetChoices)
    assert.ok(command.targetPresetChoices.every(id => mainIds.has(id)))
    assert.equal(command.selectionRequired, command.targetPresetChoices.length !== 1)
    assert.equal(command.targetPresetId, command.selectionRequired ? null : command.targetPresetChoices[0])
    assert.equal(command.launchMode, 'draft-only')
    assert.equal(command.autoSubmit, false)
    assert.match(command.mappingEvidence.decision, /never auto-run/)
    assert.ok(!command.promptPath.startsWith('assets/'))
  }
})

assetTest('29 steering samples retain original events, titles and source coordinates without auto submission', () => {
  assert.equal(manifest.steering.length, 29)
  assert.equal(new Set(manifest.steering.map(s => s.id)).size, 29)
  for (const main of mapping.agents) {
    const entries = manifest.steering.filter(s => s.targetPresetId === `finance-${main.slug}`)
    assert.equal(entries.length, main.steering.events.length)
    entries.forEach((entry, i) => {
      assert.equal(entry.prompt, main.steering.events[i].event)
      assert.equal(entry.title, main.steering.events[i].description)
      assert.equal(entry.source.path, main.steering.source.path)
      assert.equal(digest(sourceRead(entry.source.path)), entry.source.sha256)
      assert.equal(entry.launchMode, 'draft-only')
      assert.equal(entry.autoSubmit, false)
      assert.equal(entry.sampleOnly, true)
    })
  }
})

assetTest('all 363 source files including all six licenses and Kensho notices are archived byte-for-byte', () => {
  assert.equal(manifest.sourceArchive.fileCount, 363)
  assert.equal(manifest.sourceArchive.readOnly, true)
  assert.equal(manifest.sourceArchive.executionPolicy, 'PROVENANCE_ONLY_NEVER_EXECUTE_OR_INSTALL')
  assert.deepEqual(walk(archiveRoot), sorted(inventory.files.map(f => f.path)))
  assert.equal(treeHash(archiveRoot), manifest.sourceTreeSha256)
  assert.ok(walk(archiveRoot).every(p => !p.split('/').includes('.git')))
  assert.equal(manifest.licenses.length, 6)
  for (const license of manifest.licenses) {
    assert.equal(digest(archiveRead(license.path)), license.sha256)
    assert.equal(license.archivePath, `source-archive/${license.path}`)
  }
  assert.match(text(path.join(assets, 'NOTICE.md')), /Copyright 2026-present Kensho Technologies, LLC/)
  for (const skill of manifest.skills.filter(s => ['tear-sheet', 'funding-digest', 'earnings-preview-single'].includes(s.name))) {
    assert.match(assetRead(`${skill.directory}/LICENSE`).toString('utf8'), /Kensho Technologies, LLC/)
  }
})

assetTest('all static reference evidence retains source and resolved-file SHA provenance', () => {
  const references = json(path.join(assets, 'asset-references.json'))
  const original = json(path.join(root, 'audit/upstream/asset-references.json'))
  assert.deepEqual(references.references, original.references)
  assert.equal(references.sourceTreeSha256, manifest.sourceTreeSha256)
  for (const ref of references.references) {
    assert.equal(digest(sourceRead(ref.sourcePath)), ref.sourceSha256)
    if (ref.resolvedSha256) assert.equal(digest(sourceRead(ref.resolvedPath)), ref.resolvedSha256)
  }
})

assetTest('generator ownership ledger matches assets, excludes runtime edits, and contains no deletion operation', () => {
  const ledger = json(path.join(assets, '.migration-owned.json'))
  for (const [relative, hash] of Object.entries(ledger.files)) {
    assert.ok(relative.startsWith('assets/') || relative === 'acceptance/P2-assets.json')
    assert.equal(digest(read(path.join(root, ...relative.split('/')))), hash, relative)
  }
  const generator = text(path.join(root, 'scripts/migrate_assets.py'))
  assert.match(generator, /Refusing to overwrite unowned or user-modified output/)
  assert.equal(/\.(?:unlink|rmdir|rmtree|remove)\(/.test(generator), false)
  assert.equal(/(?:subprocess|exec\(|eval\()/.test(generator), false, 'no upstream script execution')
  const acceptance = json(path.join(root, 'acceptance/P2-assets.json'))
  assert.equal(acceptance.manifestSha256, digest(read(manifestPath)))
  assert.equal(acceptance.realLoaderVerification, 'PARENT_TASK_REQUIRED_NOT_SIMULATED')
  assert.equal(acceptance.businessE2E, 'NOT_RUN')
})

// Opt-in actual-run evidence; only this owned acceptance record and its ledger hash change.
after(() => {
  if (process.env.DSH_RECORD_ASSET_ACCEPTANCE !== '1' || passed !== declared) return
  const acceptancePath = path.join(root, 'acceptance/P2-assets.json')
  const acceptance = json(acceptancePath)
  acceptance.status = 'STATIC_ASSET_TESTS_PASSED'
  acceptance.testEvidence = {
    command: `$env:DSH_RECORD_ASSET_ACCEPTANCE='1'; & '${process.execPath}' --test tests/assets.test.js`,
    testsPassed: passed,
    testsFailed: 0,
    testFileSha256: digest(read(fileURLToPath(import.meta.url))),
    executedAt: new Date().toISOString(),
    nativeSkillDiscovery: 'NOT_MOCKED_PARENT_TASK_VERIFIES_REAL_LOADER',
  }
  const data = Buffer.from(`${JSON.stringify(acceptance, null, 2)}\n`)
  fs.writeFileSync(acceptancePath, data)
  const ledgerPath = path.join(assets, '.migration-owned.json')
  const ledger = json(ledgerPath)
  ledger.files['acceptance/P2-assets.json'] = digest(data)
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`)
})
