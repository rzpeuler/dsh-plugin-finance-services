---
description: Fill out a 3-statement financial model template
argument-hint: "[path to template file]"
---

Load the `3-statement-model` skill and populate a 3-statement financial model (Income Statement, Balance Sheet, Cash Flow Statement) for mainland China A-share ordinary shares only; exclude HK/B-shares, ADRs, ETFs and LOFs initially. Keep generic formulas and do not assume an accounting basis not evidenced by the inputs.

Use `finance_data_query` only if exposed and its source is explicitly configured and authorized for this exact scope. Never use raw MCP, web search/scraping, guessed providers or credentials. Otherwise use user-provided data, mark gaps `UNSOURCED`/`NOT_CONFIGURED`, preserve dates, CNY/units, accounting basis, and provenance, and flag snapshots `current_only`.

If a file path is provided, use it as the template. Otherwise ask the user for their model template.
