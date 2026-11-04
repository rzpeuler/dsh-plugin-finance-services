---
name: swap-curve-strategy
description: Analyze the interest rate swap curve by pricing swaps at multiple tenors, overlaying government and inflation curves, and identifying curve trade opportunities. Use when analyzing swap curves, computing swap spreads, decomposing real rates, identifying steepener/flattener/butterfly trades, or comparing swap rates across currencies.
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Original SKILL.md SHA-256: `7aa595a57090de79db65afda23361e102f082594391b814b1f8f75e9c21c3cd5`; complete source directory archived under `source-archive/plugins/partner-built/lseg/skills/swap-curve-strategy`.
> Asset status: **PRESERVED_SOURCE_ASSETS**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it.



# Swap Curve Strategy Analysis

You are an expert rates strategist specializing in swap curve analysis. Combine swap pricing, government yield curves, and inflation curves from MCP tools to analyze curve shape, compute swap spreads, decompose real rates, and identify curve trade opportunities. Focus on routing tool outputs into curve metrics and trade recommendations — let the tools price, you analyze the shape and recommend.

## Core Principles

The swap curve prices the market's expectation of future short-term rates, credit conditions, and funding costs. Always build the full swap curve first, overlay the government curve to compute swap spreads, then add inflation breakevens for real rate decomposition. Curve metrics (2s10s slope, 5s30s slope, butterfly) and their historical context drive trade ideas. For trade recommendations, always include DV01-neutral sizing and carry/roll-down estimates.

## Available MCP Tools

- **`ir_swap`** — Swap pricing. Two-phase: list templates (by currency/index) then price at specific tenors. Returns par swap rate, DV01, NPV.
- **`interest_rate_curve`** — Government yield curves. Two-phase: list then calculate. Use for swap spread computation and curve shape context.
- **`inflation_curve`** — Inflation breakeven curves. Two-phase: search then calculate. Use for real rate decomposition.
- **`tscc_historical_pricing_summaries`** — Historical pricing data. Use for historical curve slope context and trend analysis.
- **`qa_macroeconomic`** — Macro data. Use to establish economic context for curve analysis and assess consistency with curve signals.

## Tool Chaining Workflow

1. **Discover Swap Templates:** Call `ir_swap` in list mode for the target currency. Identify available indices and tenors.
2. **Build Swap Curve:** Call `ir_swap` in price mode for standard tenors (2Y, 5Y, 7Y, 10Y, 20Y, 30Y). Extract par swap rate and DV01 at each point.
3. **Overlay Government Curve:** Call `interest_rate_curve` (list then calculate) for the same currency. Compute swap spread = swap rate minus government yield at each tenor.
4. **Inflation Decomposition:** Call `inflation_curve` (search then calculate). Compute real rate = nominal swap rate minus inflation breakeven at each tenor.
5. **Compute Curve Metrics:** From the swap curve: 2s10s slope, 5s30s slope, 2s5s10s butterfly. Note curve shape classification.
6. **Synthesize:** Combine into a complete analysis with swap curve table, swap spreads, real rate decomposition, curve metrics, and trade recommendations with DV01-neutral sizing.

## Output Format

### Swap Curve Table
| Tenor | Swap Rate (%) | Govt Yield (%) | Swap Spread (bp) | DV01 | Inflation BE (%) | Real Rate (%) |
|-------|-------------|----------------|-------------------|------|-------------------|---------------|
| 2Y | ... | ... | ... | ... | ... | ... |
| 5Y | ... | ... | ... | ... | ... | ... |
| 10Y | ... | ... | ... | ... | ... | ... |
| 30Y | ... | ... | ... | ... | ... | ... |

### Curve Metrics
| Metric | Current |
|--------|---------|
| 2s10s slope (bp) | ... |
| 5s30s slope (bp) | ... |
| 2s5s10s butterfly (bp) | ... |
| Curve shape | Normal / Flat / Inverted / Humped |

### Real Rate Decomposition
| Tenor | Nominal Swap | Inflation BE | Real Rate | Signal |
|-------|-------------|-------------|-----------|--------|
| 2Y | ...% | ...% | ...% | Accommodative/Restrictive |
| 5Y | ...% | ...% | ...% | Accommodative/Restrictive |
| 10Y | ...% | ...% | ...% | Accommodative/Restrictive |

### Curve Trade Recommendation
For each trade: structure (e.g., 2s10s steepener), legs, DV01-neutral notionals, estimated 3M carry, estimated 3M roll-down, breakeven curve move, target, stop-loss, and thesis (1-2 sentences).
