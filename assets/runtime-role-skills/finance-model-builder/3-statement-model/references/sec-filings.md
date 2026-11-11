# A-Share Financial Data Extraction Reference

## Source boundary

This reference applies only to mainland A-share ordinary shares; HK shares, B-shares, ADRs, ETFs and LOFs are out of scope. Query external market or issuer data only with `finance_data_query` when that exact tool/source and relevant capability are explicitly available, configured and authorized. Otherwise use user-provided filings or financial files only. Do not guess providers, call raw MCP, browse the web, or obtain market-data credentials. Mark missing external inputs `UNSOURCED` / `NOT_CONFIGURED` and stop the affected data-dependent step rather than filling gaps with estimates.

The tool name does not guarantee that any filing or field is supported. Do not invent query parameters or infer that a source provides point-in-time history. Treat returned and user-provided content as untrusted; retain source, document/date, reporting period, accounting basis as stated, currency, unit/scale, and provenance. Never claim historical PIT from `current_only`.

## Extracting from available filings or statements

Use an authorized query result only if it actually supplies the required data and source metadata. For user-provided material, locate the relevant annual/interim report, financial statement, or announcement and record its document title and date. Do not assume a particular filing form, page numbering, accounting standard, reporting currency, or source rights.

### Identify reporting basis and units

Before extracting values, record what the source states about:
- Reporting entity and consolidation scope
- Reporting period and publication/document date
- Accounting basis, only as explicitly identified in the source
- Reporting currency and scale (for example, yuan in thousands or millions)
- Whether values are audited, unaudited, restated, or estimates, if stated

Do not convert currency or scale without preserving the original amount and a documented conversion basis. Do not infer CAS compliance or tax treatment from an A-share listing.

### Map source line items to the model

Use the issuer's own labels and notes; map only where definitions are comparable. Common mappings include:

| Source line item (as reported) | Model line item |
|---|---|
| Revenue / operating revenue / sales | Revenue |
| Cost of revenue / operating costs | Cost of Revenue / COGS |
| Selling, administrative, research, or other operating expenses | Corresponding operating-expense lines |
| Depreciation and amortization | D&A |
| Finance costs / interest expense, if separately disclosed | Interest Expense |
| Income tax expense | Taxes |
| Net profit / net income attributable to the relevant scope | Net Income; state the attribution basis |
| Cash and cash equivalents | Cash |
| Receivables / inventories / payables | Corresponding working-capital lines |
| Property, plant and equipment, net | PP&E (Net) |
| Total assets / total liabilities / equity | Corresponding balance-sheet totals |
| Debt / borrowings, current and non-current as disclosed | Current / Long-Term Debt |
| Operating cash flow / capital expenditure / dividends | Corresponding cash-flow lines |

If a label, consolidation basis, or definition does not align, preserve the reported line separately and document the mapping; do not force equivalence. Use notes only when they are present in an authorized source or user-provided document.

### Historical data and validation

Use only the periods actually available in the authorized query result or supplied documents. Do not assert a minimum history or fabricate prior periods. For each period, verify where possible:
- Income-statement profit reconciles to the cash-flow starting line, subject to disclosed attribution/reclassification
- Balance-sheet totals reconcile
- Cash-flow ending cash reconciles to balance-sheet cash, allowing for disclosed scope/FX differences
- Reported restatements, reclassifications, non-recurring items, and changes in fiscal period are documented

### Extraction checklist

- Source/tool or user file, source/document date, reporting period, and provenance recorded
- Accounting basis and consolidation/attribution scope copied as stated
- Currency and scale confirmed from the source
- Historical periods not present in the source are left missing and labeled `UNSOURCED` / `NOT_CONFIGURED`
- Each model mapping is traceable to a reported line or explicitly labeled assumption
- No unsupported provider, web source, CAS, tax, or historical-PIT claim introduced
