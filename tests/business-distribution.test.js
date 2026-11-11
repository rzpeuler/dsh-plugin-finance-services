import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createBusinessTaskTemplates } from '@local/dsh-financial-services/business-task-templates/v1'

test('the public intake SDK exposes only the three selected Agent templates', () => {
  const templates = createBusinessTaskTemplates(z)
  assert.deepEqual(templates.list().templates.map(item => item.presetId), [
    'finance-market-researcher', 'finance-earnings-reviewer', 'finance-model-builder',
  ])
})
