---
description: View or update the catalyst calendar
argument-hint: "[timeframe, e.g. 'next 2 weeks']"
---

Load the `catalyst-calendar` skill to build or review upcoming catalysts for mainland China A-share ordinary shares only; exclude HK/B-shares, ADRs, ETFs and LOFs initially.

Use `finance_data_query` only if exposed and its source is explicitly configured and authorized for this exact scope. Never use raw MCP, web search/scraping, guessed providers or credentials. Otherwise use user-provided A-share data, mark gaps `UNSOURCED`/`NOT_CONFIGURED`, preserve event dates, units and provenance, and flag snapshots `current_only`.

If a timeframe is provided, use it. Otherwise default to the next 2 weeks.
