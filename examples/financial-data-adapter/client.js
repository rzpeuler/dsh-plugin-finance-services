import { fault } from './control.js'
/** A deliberately tiny in-process fake: NOT an MCP transport/client manager. */
export function createFakeClient() {
  return {
    tools: {
      async call({ name, arguments: args }, { signal } = {}) {
        signal?.throwIfAborted()
        if (name !== 'financial_statements' || args?.symbol !== '999999.SH' || args.period !== 'FY2024'
          || args.market !== 'CN' || !Array.isArray(args.fields)
          || args.fields.some(field => !['revenue', 'ebitda'].includes(field))) throw fault('FIXTURE_REQUEST_INVALID')
        return { structuredContent: {
          symbol: '999999.SH', fiscalYear: 2024, currencyCode: 'CNY', magnitude: 'ones',
          accounting: 'PRC_GAAP', group: 'consolidated', measurementType: 'actual',
          metrics: { revenue: 2, ebitda: 0.4 },
        } }
      },
    },
  }
}
