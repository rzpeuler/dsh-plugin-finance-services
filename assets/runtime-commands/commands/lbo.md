---
description: Build an LBO model for a PE acquisition
argument-hint: "[company name or deal details]"
---

Load the `lbo-model` skill and build a leveraged buyout model for a mainland China A-share ordinary-share target only; exclude HK/B-shares, ADRs, ETFs and LOFs initially. Keep the financial method generic and express deal inputs in the evidenced currency, normally CNY only when the input establishes it.

Use `finance_data_query` only if exposed and its source is explicitly configured and authorized for this exact scope. Never use raw MCP, web search/scraping, guessed providers or credentials. Otherwise use user-provided data and assumptions, mark gaps `UNSOURCED`/`NOT_CONFIGURED`, preserve dates, units, currency, accounting basis and provenance, and flag snapshots `current_only`.

If a company is provided as an argument, use it. Otherwise ask the user for the A-share target and deal parameters.
