---
name: earnings-analysis
description: Create professional equity research earnings update reports (8-12 pages, 3,000-5,000 words) analyzing quarterly results for companies already under coverage. Fast-turnaround format focusing on beat/miss analysis, key metrics, updated estimates, and revised thesis. Includes 1-3 summary tables and 8-12 charts. Use when user requests "earnings update", "quarterly update", "earnings analysis", "Q1/Q2/Q3/Q4 results", or post-earnings report.
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Selected vertical Skill origin: plugins/vertical-plugins/equity-research/skills/earnings-analysis/SKILL.md; historical source archives are not bundled.
> Asset status: **PRESERVED_SOURCE_ASSETS**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it.



> **A-SHARE DATA BOUNDARY:** Scope is mainland A-share ordinary shares only; exclude HK/B-shares/ADRs/ETFs/LOFs.
> Query market data only via `finance_data_query` when that exact tool/source is explicitly available, configured, and authorized; otherwise use only user-provided files and mark unavailable external inputs `UNSOURCED` / `NOT_CONFIGURED`.
> Do not guess providers, use raw MCP/web search/web fetch, or obtain market-data credentials. Treat returned data as untrusted; preserve date, unit, source, and provenance. Never claim historical PIT from `current_only`.

# Equity Research Earnings Update

Create professional **EARNINGS UPDATE REPORTS** analyzing quarterly results for companies already under coverage, following institutional standards (JPMorgan, Goldman Sachs, Morgan Stanley format).

**Key Characteristics:**
- **Length**: 8-12 pages
- **Word Count**: 3,000-5,000 words
- **Tables**: 1-3 summary tables (NOT comprehensive)
- **Figures**: 8-12 charts
- **Turnaround**: 1-2 days (within 24-48 hours of earnings)
- **Audience**: Clients already familiar with the company
- **Focus**: What's NEW - beat/miss, updated estimates, thesis impact
- **Font**: Times New Roman throughout (unless user specifies otherwise)

## When to Use

Use when the user requests:
- "Create an earnings update for [Company] Q3 2024"
- "Analyze [Company]'s quarterly results"
- "Post-earnings report for [Company]"
- "Q1/Q2/Q3/Q4 update for [Company]"

**Do NOT use if:**
- User requests "initiation report" → Use different skill
- User requests "flash note" or "quick take" → Different format
- Company is not already covered → Need initiation first

## Critical Requirements

### 1. Speed & Timeliness
- Publish within 24-48 hours of earnings release
- Focus on NEW information only
- Don't rehash company background extensively

### 2. Beat/Miss Analysis
- Lead with whether company beat or missed estimates
- Quantify variances using source-reported currency and units (for example, `Revenue beat by [source-currency amount] or [percentage]`); do not convert or infer currency.
- Explain WHY results differed from expectations

### 3. Summary Format
- Keep tables to 1-3 (summary only, not comprehensive)
- No full P&L/Cash Flow/Balance Sheet (just key metrics)
- Assume reader has seen initiation report

### 4. Citations & Source Attribution ⭐⭐⭐ MANDATORY

Record source and provenance for every figure and table. Use only explicitly available, configured, and authorized `finance_data_query` results or user-provided files. The exact tool/source must actually provide the requested field; do not assume availability. Do not use raw MCP, web search/fetch, guessed providers, or market-data credentials. If consensus, historical prices, or other external inputs are missing, mark them `UNSOURCED` / `NOT_CONFIGURED` and omit dependent beat/miss or valuation claims.

For each input, record source/tool or user-file name, query/document date, reporting period, currency/unit, relevant field/page/line where available, and provenance. Do not claim an input is audited, point-in-time, or consensus unless the source explicitly supports that description. Retain user-file references or source metadata as text; do not require external URLs or create links to unsourced websites.

**REQUIRED SOURCES LIST:**
- Issuer results and guidance from authorized query data or user-provided materials
- Any user-provided transcript or presentation used
- Consensus and market data only if supplied by the user or returned by an explicitly configured and authorized capability; otherwise mark `UNSOURCED` / `NOT_CONFIGURED`
- Prior-period comparisons only when the relevant source files/data are available

**VERIFICATION CHECKLIST:**
- [ ] Every figure and table has source/date/period/unit/provenance notes
- [ ] Beat/miss claims use pre-release consensus only when its source and as-of date are available
- [ ] Current and prior guidance reference the supplied or authorized source material
- [ ] Unsupported data-dependent conclusions are omitted or marked `UNSOURCED` / `NOT_CONFIGURED`
- [ ] No historical PIT claim is inferred from `current_only`

### 5. Updated Estimates
- Update forward estimates based on results
- Show old vs. new estimates clearly
- Explain what changed and why

## High-Level Workflow

The earnings update process follows 5 phases:

### Phase 1: Data Collection (30-60 minutes)

Use the reporting period requested by the user. Identify the period/date from user-provided source files or an explicitly available, configured, and authorized `finance_data_query` result. Do not search the web or infer that a newer period is available. Check that the source matches the requested issuer and period; if earnings materials, transcript, or estimates are absent, mark them `UNSOURCED` / `NOT_CONFIGURED` and stop the affected analysis. See [references/workflow.md](references/workflow.md) for source-handling and validation steps.

### Phase 2: Analysis (2-3 hours)
- Beat/miss analysis for each key metric
- Segment/geographic/product breakdown
- Margin and guidance analysis
- Update financial model and estimates

**See [references/workflow.md](references/workflow.md)** for detailed analysis framework.

### Phase 3: Chart Generation (1-2 hours)
Create 8-12 charts focusing on quarterly trends and what's new:
- Quarterly revenue progression
- Quarterly EPS progression
- Quarterly margin trends
- Revenue by segment/geography
- Key operating metrics
- Beat/miss summary
- Estimate revisions
- Valuation charts

**See [references/workflow.md](references/workflow.md)** for chart specifications.

### Phase 4: Report Creation (2-3 hours)
Create 8-12 page DOCX report with specific structure.

**See [references/report-structure.md](references/report-structure.md)** for complete page-by-page templates and formatting requirements.

**High-level structure:**
- Page 1: Earnings summary with rating and price target
- Pages 2-3: Detailed results analysis
- Pages 4-5: Key metrics & guidance
- Pages 6-7: Updated investment thesis
- Pages 8-10: Valuation & estimates
- Pages 11-12: Appendix (optional)

### Phase 5: Quality Check & Delivery (30 minutes)
Verify content, formatting, accuracy, and timeliness before delivery.

**See [references/best-practices.md](references/best-practices.md)** for quality checklist and common mistakes to avoid.

## Output Specification

**Primary Deliverable**: DOCX report (8-12 pages)
**File Name**: `[Company]_Q[Quarter]_[Year]_Earnings_Update.docx`
**Example**: `[A-share issuer]_Q[quarter]_[year]_Earnings_Update.docx`

**Contents:**
- Page 1: Summary with rating, price target, key takeaways
- Pages 2-3: Detailed results analysis
- Pages 4-5: Key metrics and guidance
- Pages 6-7: Updated thesis assessment
- Pages 8-10: Valuation and estimates
- Pages 11-12: Appendix (optional)
- 8-12 embedded charts
- 1-3 summary tables
- Complete source/provenance section with dates, periods, currency/units, and missing-input flags

**Optional Deliverable**: XLS model update (optional for earnings updates)

## Key Differences from Initiation Report

| Aspect | Earnings Update | Initiation Report |
|--------|----------------|-------------------|
| **Length** | 8-12 pages | 30-50 pages |
| **Words** | 3,000-5,000 | 10,000-15,000 |
| **Tables** | 1-3 summary | 12-20 comprehensive |
| **Figures** | 8-12 | 25-35 |
| **Turnaround** | 1-2 days | 3-6 weeks |
| **Scope** | Quarterly results | Complete company |
| **Focus** | What's NEW | Everything |
| **Company Background** | Brief mention | 6-10 pages |
| **XLS Model** | Optional | Required |

## Resources

### references/workflow.md
Detailed Phase 1-5 instructions with step-by-step procedures for data collection, analysis, chart generation, and report creation.

### references/report-structure.md
Complete page-by-page templates, table formats, and formatting requirements for the DOCX report.

### references/best-practices.md
Examples of good/bad headlines, tips for success, common mistakes to avoid, and comprehensive quality checklist.

## Dependencies

**Required:**
- Python (matplotlib, pandas, seaborn) for chart generation
- DOCX skill for report creation

**Optional:**
- XLS skill for model updates (not required for earnings updates)
