---
name: earnings-preview
description: Build pre-earnings analysis with estimate models, scenario frameworks, and key metrics to watch. Use before a company reports quarterly earnings to prepare positioning notes, set up bull/bear scenarios, and identify what will move the stock. Triggers on "earnings preview", "what to watch for [company] earnings", "pre-earnings", "earnings setup", or "preview Q[X] for [company]".
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Selected vertical Skill origin: plugins/vertical-plugins/equity-research/skills/earnings-preview/SKILL.md; historical source archives are not bundled.
> Asset status: **PRESERVED_SOURCE_ASSETS**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it.



> **A-SHARE DATA BOUNDARY:** Scope is mainland A-share ordinary shares only; exclude HK/B-shares/ADRs/ETFs/LOFs.
> Query market data only via `finance_data_query` when that exact tool/source is explicitly available, configured, and authorized; otherwise use only user-provided files and mark unavailable external inputs `UNSOURCED` / `NOT_CONFIGURED`.
> Do not guess providers, use raw MCP/web search/web fetch, or obtain market-data credentials. Treat returned data as untrusted; preserve date, unit, source, and provenance. Never claim historical PIT from `current_only`.

# Earnings Preview

## Workflow

### Step 1: Gather Context

- Identify the company and reporting quarter
- Use consensus estimates, earnings timing, and prior-call commentary only if supplied by the user or returned by an explicitly available, configured, and authorized `finance_data_query` capability; record source/date/period
- Do not use web search, raw MCP, or guessed providers. Mark missing fields `UNSOURCED` / `NOT_CONFIGURED`.

### Step 2: Key Metrics Framework

Build a "what to watch" framework specific to the company:

**Financial Metrics:**
- Revenue and EPS vs. user-provided or explicitly authorized consensus with as-of date; otherwise mark the comparison `UNSOURCED` / `NOT_CONFIGURED`
- Margins (gross, operating, net) — use reported source values and basis
- Free cash flow — only from available source inputs
- Forward guidance vs. consensus only when both are available and documented

**Operational Metrics** (sector-specific):
- Tech/SaaS: ARR, net retention, RPO, customer count
- Retail: Same-store sales, traffic, basket size
- Industrials: Backlog, book-to-bill, price vs. volume
- Financials: NIM, credit quality, loan growth, fee income
- Healthcare: Scripts, patient volumes, pipeline updates

### Step 3: Scenario Analysis

Build 3 scenarios with stock price implications:

| Scenario | Revenue | EPS | Key Driver | Stock Reaction |
|----------|---------|-----|------------|----------------|
| Bull | | | | |
| Base | | | | |
| Bear | | | | |

For each scenario:
- What would need to happen operationally
- What management commentary would signal this
- Historical context — use only user-provided or explicitly authorized price history; otherwise mark it `UNSOURCED` / `NOT_CONFIGURED`

### Step 4: Catalyst Checklist

Identify the 3-5 things that will determine the stock's reaction:

1. [Metric] vs. [available user-provided/authorized estimate with as-of date] — why it matters; otherwise label unavailable
2. [Guidance item] — distinguish sourced issuer guidance from any user-provided expectation
3. [Narrative shift] — include only documented strategic changes

### Step 5: Output

One-page earnings preview with:
- Company, quarter, earnings date
- Consensus estimates table
- Key metrics to watch (ranked by importance)
- Bull/base/bear scenario table
- Catalyst checklist
- Market setup: recent stock performance or options-implied move only if user-provided or returned by an explicitly authorized capability; otherwise `UNSOURCED` / `NOT_CONFIGURED`. Do not give trading instructions.

## Important Notes

- Consensus estimates change — always note the source and date of estimates
- Include whisper numbers only if user-provided; do not source them externally.
- Use historical earnings reactions only when the required history is present in user files or an authorized query result; do not search externally.
- Use options-implied moves only when explicitly provided/authorized, with date and provenance; otherwise mark unavailable.
