---
name: break-trace
description: Root-cause a reconciliation break to its source transaction or posting — follow the audit trail from the break row back to the originating entry on each side and state what differs and why. Use after gl-recon has classified a break.
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Original SKILL.md SHA-256: `a7064b5cea13a4dc68f4b0ee36f8aa6efc70d738753c0eb721020bfb65932a9a`; complete source directory archived under `source-archive/plugins/agent-plugins/gl-reconciler/skills/break-trace`.
> Asset status: **PRESERVED_SOURCE_ASSETS**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it.



# Root-cause a break

Given a single break row (key, GL values, subledger values, bucket, likely cause), trace it to source and produce a root-cause statement.

## Trace path

1. **Pull the GL side** — via the internal-gl MCP, fetch the journal entry or posting that produced this GL line: entry id, posting date, source system, batch id, preparer.
2. **Pull the subledger side** — via the subledger MCP, fetch the matching transaction: trade id, trade/settle dates, counterparty, source feed, FX rate used.
3. **Diff the attributes** — line up posting date, FX rate/date, account mapping, quantity sign, amount sign. The differing attribute is usually the cause.

## Cause → statement

Write the root cause as a single sentence in the form **"⟨side⟩ ⟨did what⟩ because ⟨reason⟩"**, e.g.:

- "GL posted on settle date (T+2) while subledger posted on trade date — timing break, will clear on 2026-05-07."
- "Subledger used WM/R 4pm rate; GL used Bloomberg close — FX break of 12 bps on the base amount."
- "Security ABC123 maps to GL account 11420 in the mapping table but the subledger fed 11410 — mapping break, raise to reference-data."
- "Subledger posted the trade twice (trade ids 88412 and 88419 are duplicates) — duplicate post, suppress 88419."

## Output

For each traced break, return:

```json
{
  "key": "...",
  "root_cause": "one sentence as above",
  "owner": "ops | reference-data | accounting | upstream-system",
  "expected_clear_date": "YYYY-MM-DD or null",
  "action": "monitor | adjust | raise-ticket | suppress"
}
```

Only the resolver writes adjustments — this skill diagnoses, it does not post.
