import { fault } from './control.js'
/** A deliberately tiny in-process fake: NOT an MCP transport/client manager. */
export function createFakeClient() {
  return {
    tools: {
      async call({ name, arguments: args }, { signal } = {}) {
        signal?.throwIfAborted()
        if (name !== 'financial_statements' || args?.symbol !== 'TOY' || args.period !== 'FY2024'
          || args.market !== 'US' || !Array.isArray(args.fields)
          || args.fields.some(field => !['revenue', 'ebitda'].includes(field))) throw fault('FIXTURE_REQUEST_INVALID')
        return { structuredContent: {
          symbol: 'TOY', fiscalYear: 2024, currencyCode: 'USD', magnitude: 'millions',
          accounting: 'US_GAAP', group: 'consolidated', measurementType: 'actual',
          statementDate: '2025-02-01T00:00:00Z', firstPublished: '2025-02-02T00:00:00Z',
          revisionId: 'mcp-toy-r1', metrics: { revenue: 2, ebitda: 0.4 },
        } }
      },
    },
  }
}
