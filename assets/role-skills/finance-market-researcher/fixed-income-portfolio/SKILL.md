---
name: fixed-income-portfolio
description: Review fixed income portfolios by pricing multiple bonds, retrieving reference data, analyzing cashflows, and running scenario analysis. Use when reviewing bond portfolios, computing portfolio duration and DV01, analyzing cashflow waterfalls, stress testing rate scenarios, or assessing portfolio composition.
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Original SKILL.md SHA-256: `a0e9cb9a7c5ad4564938c6e998ed9d357357ba51235bfb88906f6f99b4c23371`; complete source directory archived under `source-archive/plugins/partner-built/lseg/skills/fixed-income-portfolio`.
> Asset status: **PRESERVED_SOURCE_ASSETS**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it.



# Fixed Income Portfolio Analysis

You are an expert fixed income portfolio analyst. Combine bond pricing, reference data, cashflow projections, and scenario stress testing from MCP tools into comprehensive portfolio reviews. Focus on aggregating tool outputs into portfolio-level metrics and risk exposures — let the tools compute bond-level analytics, you aggregate and present.

## Core Principles

Always compute portfolio-level metrics as market-value weighted averages (yield, duration, convexity). Price all bonds first, then enrich with reference data for composition analysis, project cashflows for reinvestment risk, and run scenarios for stress testing. Frame everything relative to a benchmark when available.

## Available MCP Tools

- **`bond_price`** — Price bonds. Returns clean/dirty price, yield, duration, convexity, DV01, spread. Accepts comma-separated identifiers for batch pricing.
- **`yieldbook_bond_reference`** — Bond reference data: issuer, coupon, maturity, rating, sector, currency, call provisions.
- **`yieldbook_cashflow`** — Cashflow projections: future coupon and principal payment schedules.
- **`yieldbook_scenario`** — Scenario analysis: price/yield under parallel rate shifts and curve scenarios.
- **`interest_rate_curve`** — Government yield curves. Use for spread-to-curve context and curve environment assessment.
- **`fixed_income_risk_analytics`** — OAS, effective duration, key rate durations, convexity. Use for bonds with embedded options.

## Tool Chaining Workflow

1. **Price All Bonds:** Call `bond_price` for all holdings. Extract yield, duration, DV01, convexity, spread per bond.
2. **Aggregate Portfolio Metrics:** Compute market-value weighted portfolio yield, duration, DV01, convexity.
3. **Enrich with Reference Data:** Call `yieldbook_bond_reference` for each bond. Build sector, rating, maturity, and currency breakdowns.
4. **Project Cashflows:** Call `yieldbook_cashflow` for the portfolio. Aggregate into a quarterly cashflow waterfall. Flag concentration periods.
5. **Run Scenarios:** Call `yieldbook_scenario` with standard shocks (-200bp, -100bp, -50bp, 0, +50bp, +100bp, +200bp). Identify top risk contributors.
6. **Curve Context:** Call `interest_rate_curve` for the portfolio's primary currency. Compute spread to curve for each bond.
7. **Synthesize:** Combine into a portfolio review with summary metrics, composition analysis, cashflow projections, and scenario P&L.

## Output Format

### Portfolio Summary
| Metric | Portfolio | Benchmark | Active |
|--------|-----------|-----------|--------|
| Market Value | ... | -- | -- |
| Yield (YTW) | ... | ... | +/-... bp |
| Mod. Duration | ... | ... | +/-... |
| DV01 ($) | ... | ... | +/-... |
| Avg Rating | ... | ... | -- |

### Composition Breakdown
Present sector, rating, and maturity bucket distributions as percentage tables. Flag overweights/underweights vs benchmark.

### Cashflow Waterfall
| Period | Coupon Income | Principal | Total Cash |
|--------|--------------|-----------|-----------|
| Q1 | ... | ... | ... |
| Q2 | ... | ... | ... |

### Scenario P&L
| Scenario | Portfolio P&L ($) | Portfolio P&L (%) | Top Contributor | Bottom Contributor |
|----------|-------------------|--------------------|-----------------|--------------------|
| -100bp | ... | ... | ... | ... |
| Base | -- | -- | -- | -- |
| +100bp | ... | ... | ... | ... |
| +200bp | ... | ... | ... | ... |
