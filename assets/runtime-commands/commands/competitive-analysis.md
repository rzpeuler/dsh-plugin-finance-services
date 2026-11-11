---
description: Create a competitive landscape analysis
argument-hint: "[company or industry]"
---

Load the `competitive-analysis` skill and build a competitive landscape analysis for mainland China A-share ordinary shares only; exclude HK/B-shares, ADRs, ETFs and LOFs initially.

Use `finance_data_query` only if exposed and its source is explicitly configured and authorized for this exact scope. Never use raw MCP, web search/scraping, guessed providers or credentials. Otherwise use user-provided A-share data, mark gaps `UNSOURCED`/`NOT_CONFIGURED`, preserve dates, CNY/units and provenance, and flag snapshots `current_only`.

If a company/industry is provided as an argument, use it. Otherwise ask the user which A-share company or industry they want to analyze.
