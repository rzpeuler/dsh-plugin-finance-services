---
name: variance-commentary
description: Write flux commentary for every P&L and balance-sheet line over threshold — current vs prior period and vs budget, with the driver explained from underlying activity. Use for the month-end close package and management reporting.
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Original SKILL.md SHA-256: `11624574b72c05756f62cb4a2d4888a2511d661ce58b1bf980577e03d9d36ea8`; complete source directory archived under `source-archive/plugins/agent-plugins/month-end-closer/skills/variance-commentary`.
> Asset status: **PRESERVED_SOURCE_ASSETS**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it.



# Variance commentary

Given current-period actuals, prior-period actuals, and budget for the same scope, produce a commentary table.

## Threshold

Flag a line for commentary if **either** is true:

- Absolute variance ≥ the firm's materiality threshold (use the provided value; default 5% of the line or a fixed floor, whichever is greater)
- The line is on the "always comment" list (revenue, headcount cost, cash)

## For each flagged line

| Column | Content |
|---|---|
| **Line** | Account or caption |
| **Current / Prior / Budget** | The three values |
| **Δ vs prior** and **Δ vs budget** | Amount and % |
| **Driver** | One sentence explaining the movement from underlying activity — not a restatement of the number |

A driver explains *why*, not *what*: "Cloud spend up $1.2M on incremental GPU reservations for the May launch" — not "Cloud spend increased $1.2M (18%)."

## Sourcing the driver

Look at the activity behind the line (journal-source breakdown, vendor mix, headcount delta, volume × rate) via the internal-gl MCP. If the driver isn't clear from the data, write "driver unclear — flag for controller" rather than inventing one.

## Output

The commentary table plus a short narrative (3–5 sentences) summarizing the period's biggest movers.
