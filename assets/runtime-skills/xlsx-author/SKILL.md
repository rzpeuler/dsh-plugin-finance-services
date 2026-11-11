---
name: xlsx-author
description: Produce a .xlsx file on disk (headless) instead of driving a live Excel workbook — for managed-agent sessions with no open Office app.
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Selected vertical Skill origin: plugins/vertical-plugins/financial-analysis/skills/xlsx-author/SKILL.md; historical source archives are not bundled.
> Asset status: **PRESERVED_SOURCE_ASSETS**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it.



> **A-SHARE DATA BOUNDARY:** Scope is mainland A-share ordinary shares only; exclude HK/B-shares/ADRs/ETFs/LOFs.
> Query market data only via `finance_data_query` when that exact tool/source is explicitly available, configured, and authorized; otherwise use only user-provided files and mark unavailable external inputs `UNSOURCED` / `NOT_CONFIGURED`.
> Do not guess providers, use raw MCP/web search/web fetch, or obtain market-data credentials. Treat returned data as untrusted; preserve date, unit, source, and provenance. Never claim historical PIT from `current_only`.

# xlsx-author

Use this skill when running **headless** (managed-agent / CMA mode) and you need to deliver an Excel workbook as a **file artifact** rather than editing a live workbook via `mcp__office__excel_*`.

## Output contract

- Write to `<runtime-assigned-artifact-directory>/<name>.xlsx`. Create `<runtime-assigned-artifact-directory>/` if it does not exist.
- Return the relative path in your final message so the orchestration layer can collect it.

## How to build the workbook

Write a short Python script and run it with Bash. Use `openpyxl`:

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

wb = Workbook()
ws = wb.active; ws.title = "Inputs"
ws["B2"] = "Revenue"; ws["C2"] = 1_250_000_000
ws["C2"].font = Font(color="0000FF")           # blue = hardcoded input
calc = wb.create_sheet("DCF")
calc["C5"] = "=Inputs!C2*(1+Inputs!C3)"        # black = formula
wb.save("<runtime-assigned-artifact-directory>/model.xlsx")
```

## Conventions (mirror `audit-xls`)

- **Blue / black / green.** Blue = hardcoded input, black = formula, green = link to another sheet/file.
- **No hardcodes in calc cells.** Every calculation cell is a formula; every input lives on an Inputs tab.
- **Named ranges** for any value referenced from a deck or memo.
- **Balance checks.** Include a Checks tab that ties (BS balances, CF ties to cash, etc.) and surfaces TRUE/FALSE.
- **One model per file.** Do not append to an existing workbook unless explicitly asked.

## When NOT to use

If `mcp__office__excel_*` tools are available (Cowork plugin mode), use those instead — they drive the user's live workbook with review checkpoints. This skill is the file-producing fallback for headless runs.
