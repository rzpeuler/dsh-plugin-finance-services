import schema from '@deepseek-ai/schemastery'
import { createAshareAdapters } from './sources.js'

export const inject = ['financeData']
export const Config = schema.object({
  ordinaryEquitySymbols: schema.array(schema.string().pattern(/^\d{6}\.(?:SH|SZ|BJ)$/)).max(20).default([]),
  tdxPackageDirectory: schema.string().default(''),
})

/** Independent Adapter IDs and disposers; registry policy still controls every query. */
export function apply(ctx, config = {}) {
  ctx.effect(() => {
    const adapters = createAshareAdapters({
      eastmoney: { ordinaryEquitySymbols: config.ordinaryEquitySymbols ?? [] },
      ths: { ordinaryEquitySymbols: config.ordinaryEquitySymbols ?? [] },
      tdx: { ordinaryEquitySymbols: config.ordinaryEquitySymbols ?? [],
        ...(config.tdxPackageDirectory ? { packageDirectory: config.tdxPackageDirectory } : {}) },
    })
    const disposers = []
    try {
      for (const adapter of adapters) disposers.push(ctx.financeData.registerAdapter(adapter))
    } catch (error) {
      for (const dispose of disposers.reverse()) { try { dispose() } catch { /* keep rollback isolated */ } }
      throw error
    }
    return () => { for (const dispose of disposers.reverse()) dispose() }
  }, 'ashare-source-adapters')
}
