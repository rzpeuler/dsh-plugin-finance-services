---
description: Create a sector overview report
argument-hint: "[sector or industry]"
---

Load the `sector-overview` skill and create an industry landscape report for mainland China A-share ordinary shares only, covering market sizing, competitive dynamics, and investment implications; exclude HK/B-shares, ADRs, ETFs and LOFs initially.

Use `finance_data_query` only if exposed and its source is explicitly configured and authorized for this exact scope. Never use raw MCP, web search/scraping, guessed providers or credentials. Otherwise use user-provided A-share data, mark gaps `UNSOURCED`/`NOT_CONFIGURED`, preserve dates, CNY/units and provenance, and flag snapshots `current_only`.

If a sector is provided, use it. Otherwise ask the user which mainland A-share industry to cover.
