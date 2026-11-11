---
description: Build a pre-earnings preview with scenarios
argument-hint: "[company ticker]"
---

Load the `earnings-preview` skill and build a pre-earnings analysis with consensus estimates, key metrics to watch, and bull/base/bear scenarios for mainland China A-share ordinary shares only; exclude HK/B-shares, ADRs, ETFs and LOFs initially.

Use `finance_data_query` only if exposed and its source is explicitly configured and authorized for this exact scope. Never use raw MCP, web search/scraping, guessed providers or credentials. Otherwise use user-provided A-share data, mark gaps `UNSOURCED`/`NOT_CONFIGURED`, preserve reporting/as-of dates, CNY/units and provenance, and flag latest-only values `current_only`.

If a ticker is provided, use it. Otherwise ask the user which A-share company is reporting.
