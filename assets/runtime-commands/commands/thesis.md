---
description: Create or update an investment thesis
argument-hint: "[company ticker]"
---

Load the `thesis-tracker` skill to create a new thesis or update an existing one for mainland China A-share ordinary shares only; exclude HK/B-shares, ADRs, ETFs and LOFs initially.

Use `finance_data_query` only if exposed and its source is explicitly configured and authorized for this exact scope. Never use raw MCP, web search/scraping, guessed providers or credentials. Otherwise use user-provided data, mark gaps `UNSOURCED`/`NOT_CONFIGURED`, preserve dates, CNY/units and provenance, and flag snapshots `current_only`.

If a ticker is provided, use it. Otherwise ask the user which A-share position to review.
