---
description: Run a stock screen or generate investment ideas
argument-hint: "[screen criteria, e.g. 'undervalued midcap tech']"
---

Load the `idea-generation` skill and run quantitative screens or thematic sweeps only for mainland China A-share ordinary shares; exclude HK/B-shares, ADRs, ETFs and LOFs initially.

Use `finance_data_query` only if exposed and its source is explicitly configured and authorized for this exact scope. Never use raw MCP, web search/scraping, guessed providers or credentials. Otherwise use user-provided A-share data, mark gaps `UNSOURCED`/`NOT_CONFIGURED`, preserve as-of dates, CNY/units and provenance, and flag snapshots `current_only`.

If criteria are provided, use them. Otherwise ask the user for A-share screening criteria, sector, style, or theme.
