---
description: Draft a morning meeting note
argument-hint: ""
---

Load the `morning-note` skill and draft a concise note on mainland China A-share ordinary shares only, covering A-share session developments, earnings reactions, and research ideas; exclude HK/B-shares, ADRs, ETFs and LOFs initially.

Use `finance_data_query` only if exposed and its source is explicitly configured and authorized for this exact scope. Never use raw MCP, web search/scraping, guessed providers or credentials. Otherwise use user-provided A-share data, mark gaps `UNSOURCED`/`NOT_CONFIGURED`, preserve dates, CNY/units and provenance, and flag snapshots `current_only`.
