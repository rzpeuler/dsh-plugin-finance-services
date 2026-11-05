import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createBusinessTaskTemplates } from '@local/dsh-financial-services/business-task-templates/v1'
import { reconcileGl, glReconciliationInputSchema } from '@local/dsh-financial-services/business-checks/gl-v1'
import { describe, tieout } from '@local/dsh-financial-services/business-checks/lp-v1'

test('public package exports resolve the three local P4 components without private imports', () => {
  const templates = createBusinessTaskTemplates(z)
  assert.equal(templates.list().templates.length, 10)
  assert.equal(typeof reconcileGl, 'function')
  assert.equal(typeof glReconciliationInputSchema.parse, 'function')
  assert.equal(typeof tieout, 'function')
  assert.equal(describe().kind, 'PURE_LIBRARY_NOT_NATIVE_TOOL')
  assert.equal(tieout('{"approval":true}').recommendation, 'HOLD')
})
