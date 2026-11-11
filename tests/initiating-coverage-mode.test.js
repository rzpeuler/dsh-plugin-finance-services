import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const base = new URL('../assets/runtime-skills/initiating-coverage/', import.meta.url)
const read = path => readFile(new URL(path, base), 'utf8')

test('initiating-coverage keeps single-task default and supports explicit unattended sequencing', async () => {
  const skill = await read('SKILL.md')
  assert.match(skill, /Default: Single Task/)
  assert.match(skill, /Explicit Unattended Full Run/)
  assert.match(skill, /Task 1 → Task 2 → Task 3 → Task 4 → Task 5/)
  assert.match(skill, /return `BLOCKED`/)
  assert.match(skill, /does \*\*not\*\* grant a data source, license, credential/)
  assert.doesNotMatch(skill, /THIS SKILL OPERATES IN SINGLE-TASK MODE ONLY/)
  assert.doesNotMatch(skill, /No End-to-End Execution/)
})

test('initiating-coverage stage references preserve source and Office blockers without inter-stage questions', async () => {
  const [task2, task3, task5, quality] = await Promise.all([
    read('references/task2-financial-modeling.md'),
    read('references/task3-valuation.md'),
    read('references/task5-report-assembly.md'),
    read('assets/quality-checklist.md'),
  ])
  assert.match(task2, /explicit unattended full-run mode, return `BLOCKED` without asking/)
  assert.match(task3, /explicit unattended full-run mode, return `BLOCKED` without asking/)
  assert.match(task5, /authorized DOCX\/XLSX read\/export workflow/)
  assert.match(task5, /no page, word, chart, or table minimum applies/)
  assert.match(quality, /No `TEST_ONLY` adapter, POC sample/)
  assert.match(quality, /internal research draft/)
})
