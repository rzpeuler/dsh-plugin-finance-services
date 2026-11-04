/** Persistent permission floor owned by a native retained preset revision, independent of the financial service. */
import schema from '@deepseek-ai/schemastery'
import { z } from 'zod'
import { scopeOf, scopeChainOf } from '@deepseek-ai/dsh-scope'
export const name = 'finance-role-floor'
export const inject = ['tools']
export const Config = schema.object({
  roleId: schema.string().required(),
  sourceSha256: schema.string().required(),
  adaptedPromptSha256: schema.string().required(),
})
const input = z.strictObject({ roleId: z.string().regex(/^finance-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/), adaptedPromptSha256: z.string().regex(/^[a-f0-9]{64}$/) })

/** Mask ambient tools and refuse even native Agent-own delegation when the exact role grant is absent. */
export function apply(ctx, config) {
  const expected = input.parse(config)
  const composition = scopeOf(ctx)
  if (!composition) throw new Error('ROLE_SCOPE_REQUIRED: the permission floor must mount inside a financial preset')
  ctx.effect(() => ctx.tools.restrict({ allow: [] }), 'finance.retainedPresetFloor')
  ctx.effect(() => ctx.tools.guard(execution => {
    if (!execution.agent || !scopeChainOf(scopeOf(execution.agent.ctx)).includes(composition)) return
    const authority = ctx.get('financeOperations')
    if (!authority?.isRoleRuntimeActive(execution.agent, expected.roleId, expected)) {
      return 'ROLE_AUTHORITY_UNAVAILABLE: the exact financial role runtime or source revision is not active; all actions are refused'
    }
  }), 'finance.retainedPresetAdmission')
}
