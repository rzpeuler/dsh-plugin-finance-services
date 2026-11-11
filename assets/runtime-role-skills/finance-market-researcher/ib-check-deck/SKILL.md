---
name: ib-check-deck
description: Investment banking presentation quality checker. Reviews a pitch deck or client-ready presentation for (1) number consistency across slides, (2) data-narrative alignment, (3) language polish against IB standards, (4) visual and formatting QC. Use whenever the user asks to review, check, QC, proof, or do a final pass on a deck, pitch, or client materials — including requests like "check my numbers", "reconcile figures across slides", "is this client-ready", or "what am I missing before I send this out".
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Selected vertical Skill origin: plugins/vertical-plugins/financial-analysis/skills/ib-check-deck/SKILL.md; historical source archives are not bundled.
> Asset status: **EXTERNAL_RUNTIME_ADAPTATION_REQUIRED**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it.
> - EXTERNAL_RUNTIME_PATH_NOT_BUNDLED: `/tmp/deck_content.md` (plugins/agent-plugins/pitch-agent/skills/ib-check-deck/SKILL.md:40); original SHA ddb30ad936035f2bb71acdc1dbf723663e74a3d2aba640f7bb84e6007f3210c1
> - EXTERNAL_RUNTIME_PATH_NOT_BUNDLED: `/tmp/deck_content.md` (plugins/vertical-plugins/financial-analysis/skills/ib-check-deck/SKILL.md:40); original SHA ddb30ad936035f2bb71acdc1dbf723663e74a3d2aba640f7bb84e6007f3210c1


> **A-SHARE DATA BOUNDARY:** Scope is mainland A-share ordinary shares only; exclude HK/B-shares/ADRs/ETFs/LOFs.
> Query market data only via `finance_data_query` when that exact tool/source is explicitly available, configured, and authorized; otherwise use only user-provided files and mark unavailable external inputs `UNSOURCED` / `NOT_CONFIGURED`.
> Do not guess providers, use raw MCP/web search/web fetch, or obtain market-data credentials. Treat returned data as untrusted; preserve date, unit, source, and provenance. Never claim historical PIT from `current_only`.

# IB Deck Checker

Perform comprehensive QC on the presentation across four dimensions. Read every slide, then report findings.

## Environment check

This skill works in both the PowerPoint add-in and chat. Identify which you're in before starting:

- **Add-in** — read from the live open deck.
- **Chat** — read from the uploaded `.pptx` file.

This is read-and-report only — no edits — so the workflow is identical in both.

## Workflow

### Read the deck

Pull text from every slide, keeping track of which slide each line came from. You'll need slide-level attribution for every finding ("$500M appears on slides 3 and 8, but slide 15 shows $485M"). A deck with 30 slides is too much to hold in working memory reliably — write the extracted text to a file so the number-checking script can process it.

The script expects markdown-ish input with slide markers. Format as:

```
## Slide 1
[slide 1 text content]

## Slide 2
[slide 2 text content]
```

### 1. Number consistency

Run the extraction script on what you collected:

```bash
python scripts/extract_numbers.py /tmp/deck_content.md --check
```

It normalizes units ($500M vs $500MM vs $500,000,000 → same number), categorizes values (revenue, EBITDA, multiples, margins), and flags when the same metric category shows conflicting values on different slides. This is the part most likely to catch something a human missed on the fifth read-through.

Beyond what the script flags, verify:
- Calculations are correct (totals sum, percentages add up, growth rates match the endpoints)
- Unit style is consistent — the deck should pick one of $M or $MM and stick with it
- Time periods are aligned — FY vs LTM vs quarterly, explicitly labeled

### 2. Data-narrative alignment

Map claims to the data that's supposed to support them. This is where decks go wrong quietly — someone edits the chart on slide 7 and forgets the narrative on slide 4.

- Trend statements ("declining margins") → does the chart actually go that direction?
- Market position claims ("#1 player") → revenue and share data support it?
- Plausibility — "#1 in a $100B market" with $200M revenue is 0.2% share; that's not #1

### 3. Language polish

IB decks have a register. Scan for anything that breaks it: casual phrasing ("pretty good", "a lot of"), contractions, exclamation points, vague quantifiers without numbers, inconsistent terminology for the same concept.

See `references/ib-terminology.md` for replacement patterns.

### 4. Visual and formatting QC

Run standard visual verification checks on each slide. You're looking for: missing chart source citations, missing axis labels, typography inconsistencies, number formatting drift (1,000 vs 1K within the same deck), date format drift, footnote and disclaimer gaps.

Visual verification catches overlaps, overflow, and contrast issues that don't show up in text extraction. Don't skip it — a chart with no source citation looks the same as a properly sourced one in the text dump.

## Output

Use `references/report-format.md` as the structure. Categorize by severity:

- **Critical** — number mismatches, factual errors, data contradicting narrative. These block client delivery.
- **Important** — language, missing sources, terminology drift. Should fix.
- **Minor** — font sizes, spacing, date formats. Polish.

Lead with criticals. If there aren't any, say so explicitly — "no number inconsistencies found" is a finding, not an absence of one.
