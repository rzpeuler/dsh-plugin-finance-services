---
name: client-report
description: Generate professional client-facing performance reports with portfolio returns, allocation breakdowns, and market commentary. Suitable for quarterly or annual distribution. Triggers on "client report", "performance report", "quarterly report for [client]", "generate reports", or "client statement".
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Original SKILL.md SHA-256: `bbfede2e0dab00ae368767e51576498c9308b4832aaeaaa77f0fee723a90e4d4`; complete source directory archived under `source-archive/plugins/agent-plugins/meeting-prep-agent/skills/client-report`.
> Asset status: **PRESERVED_SOURCE_ASSETS**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it.



# Client Report

## Workflow

### Step 1: Report Parameters

- **Client name** and household
- **Reporting period**: Quarter, YTD, annual, custom range
- **Accounts**: All accounts or specific account
- **Benchmark**: S&P 500, 60/40 blend, custom benchmark matching IPS
- **Firm branding**: Logo, colors, disclaimers

### Step 2: Performance Summary

**Household Summary:**

| | QTD | YTD | 1-Year | 3-Year Ann. | 5-Year Ann. | ITD Ann. |
|---|-----|-----|--------|-------------|-------------|----------|
| Portfolio | | | | | | |
| Benchmark | | | | | | |
| +/- | | | | | | |

**By Account:**

| Account | Type | Value | QTD | YTD | Benchmark |
|---------|------|-------|-----|-----|-----------|
| Joint Taxable | Brokerage | | | | |
| John IRA | Traditional | | | | |
| Jane Roth | Roth IRA | | | | |
| 529 Plan | Education | | | | |
| **Total** | | | | | |

### Step 3: Allocation Overview

Current allocation with visual (pie chart or bar chart):

| Asset Class | % of Portfolio | $ Value | Benchmark % |
|------------|---------------|---------|-------------|
| | | | |

### Step 4: Holdings Detail

| Security | Asset Class | Shares | Price | Value | % of Portfolio | QTD Return |
|----------|-----------|--------|-------|-------|---------------|-----------|
| | | | | | | |

### Step 5: Market Commentary

Brief market summary tailored to the client's level of sophistication:
- What happened in markets this quarter (2-3 sentences)
- How it affected the portfolio
- Outlook and positioning rationale (2-3 sentences)
- No jargon for retail clients; can be more technical for sophisticated investors

### Step 6: Activity Summary

- Trades executed during the period
- Contributions and withdrawals
- Dividends and interest received
- Fees charged
- Rebalancing activity

### Step 7: Planning Notes

- Progress toward financial goals (retirement, education, etc.)
- Any plan changes or recommendations
- Upcoming action items
- Next review date

### Step 8: Output

- PDF report (8-12 pages) with firm branding
- Word document for customization
- Excel data appendix (optional)

**Report Structure:**
1. Cover page (client name, period, firm logo)
2. Executive summary (1 page)
3. Performance summary (1-2 pages)
4. Allocation overview with charts (1 page)
5. Holdings detail (1-2 pages)
6. Market commentary (1 page)
7. Activity summary (1 page)
8. Planning notes (1 page)
9. Disclosures and disclaimers (1 page)

## Important Notes

- Performance must be calculated net of fees unless client/compliance requires gross
- Always include appropriate disclaimers and disclosures (past performance, risk factors)
- Reports should be consistent across clients — use a standard template
- Match the level of detail to the client — some want every holding, others want a one-page summary
- Benchmark selection matters — use the benchmark from the IPS, not whatever looks best
- Review for compliance approval before first distribution of a new template
