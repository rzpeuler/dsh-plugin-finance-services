---
name: competitive-analysis
description: Framework for building competitive landscape decks — market positioning, competitor deep-dives, comparative analysis, strategic synthesis. Use when the user asks for a competitive landscape, competitor analysis, peer comparison, market positioning assessment, strategic review, or investment memo deck. Also triggers on "who are the competitors to X", "benchmark X against peers", "build a market map", or any request to systematically evaluate competitive dynamics across an industry.
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Selected vertical Skill origin: plugins/vertical-plugins/financial-analysis/skills/competitive-analysis/SKILL.md; historical source archives are not bundled.
> Asset status: **PRESERVED_SOURCE_ASSETS**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it.



> **A-SHARE DATA BOUNDARY:** Scope is mainland A-share ordinary shares only; exclude HK/B-shares/ADRs/ETFs/LOFs.
> Query market data only via `finance_data_query` when that exact tool/source is explicitly available, configured, and authorized; otherwise use only user-provided files and mark unavailable external inputs `UNSOURCED` / `NOT_CONFIGURED`.
> Do not guess providers, use raw MCP/web search/web fetch, or obtain market-data credentials. Treat returned data as untrusted; preserve date, unit, source, and provenance. Never claim historical PIT from `current_only`.

# Competitive Landscape Mapping

Build a complete competitive analysis deck. This is a two-phase process: gather requirements and get outline approval first, then build.

## Environment check

This skill works in both the PowerPoint add-in and chat. Identify which you're in before starting — the mechanics differ, the workflow doesn't:

- **Add-in** — the deck is open live; build slides directly into it.
- **Chat** — generate a `.pptx` file (or build into one the user uploaded).

Everything below applies in both.

## Phase 1 — Scope the analysis

Competitive analysis means different things to different people. Before any research or slide-building, use `ask_user_question` to pin down what they actually want. Don't guess — a 20-slide peer benchmarking deck and a 5-slide market map are both "competitive analysis" and take completely different shapes.

Gather in one round if you can (the tool takes up to 4 questions):

- **Scope** — Single target company with competitors around it? Or multi-company side-by-side with no protagonist?
- **Competitor set** — Which companies are in scope? If the user names them, use exactly those. If they say "the usual suspects," propose a set and confirm.
- **Audience and depth** — Quick read for someone already in the space, or a full primer? This drives whether you need market sizing, industry economics, and history — or can skip to the comparison.
- **Investment context** — Do they need bull/base/bear scenarios and signposts? That's Step 9 below; skip it if this is a strategic review rather than an investment thesis.

If they've uploaded an Excel/CSV with competitor data, confirm which columns map to which metrics before you start pulling numbers. Source-file fidelity matters: use values exactly as given, don't recalculate or re-round.

## Phase 2 — Outline, approve, then build

**Do not create slides until the outline is approved.** Propose slide titles and one-line content notes, present them to the user, get a yes. A competitive deck is 10-20 slides of interlocking content — rebuilding because slide 4 was wrong is expensive. The outline is the cheap iteration point.

When proposing the outline, `ask_user_question` works well for the structural decisions: which positioning visualization (2×2 matrix / radar / tier diagram — Step 5 below), how to group competitors (by business model / segment / posture — Step 4). These are taste calls the user likely has an opinion on.

---

## Standards — apply throughout

### Prompt fidelity

When the user specifies something, that's a requirement, not a suggestion:
- **Slide titles and section names** — exact wording. If they say "Overview and Competitive Scope," don't swap in "FY2024 Competitive Landscape."
- **Chart vs. table** — not interchangeable. "Embedded chart" means a real chart object with data labels on the bars/slices, not a formatted table.
- **Complete data series** — if they list 7 competitors, include all 7. If they show 2015-2025, include every year.
- **Exact values and ratios** — "surpasses DoorDash 4:1, Lyft 8:1" means those ratios, not "7.6x Lyft."

### Source handling

Use `finance_data_query` only when the exact tool/source and relevant capability are explicitly available, configured, and authorized; otherwise use user-provided files only. Do not guess providers, call raw MCP, browse the web, or use outside research. The source hierarchy for any in-scope data is:
1. Authorized `finance_data_query` result that actually contains the requested field
2. User-provided issuer reports, earnings materials, peer data, or industry research
3. If neither contains the data, mark it `UNSOURCED` / `NOT_CONFIGURED` and omit dependent claims/metrics.

Do not claim that an input is audited, analyst consensus, or current unless the source explicitly says so.

### Data comparability

- All competitor metrics from the same fiscal year; flag exceptions explicitly ("FY24" vs "H1 2024")
- Same metric definitions across competitors
- Keep the source-reported currency and scale for each issuer; do not silently convert currencies. Convert only when requested and with a user-provided or explicitly authorized rate, recording rate/date.
- Missing data shows as `UNSOURCED` / `NOT_CONFIGURED`; estimates must be clearly labeled with their user-provided or authorized source.
- Every number has a citation/provenance note: source or user file, document/query date, reporting period, unit, and line/field where available.

### Design

- **Slide titles are insights, not labels.** "Scale leaders pulling away from niche players" — not "Competitive Analysis."
- **Signposts are quantified.** "Margin below 40%" — not "margins decline."
- **Ratings show the actual.** Include a value only when supported by an authorized query result or user file, with source currency, period, and provenance; otherwise label it `UNSOURCED` / `NOT_CONFIGURED`.
- **Charts are real chart objects** — not text tables dressed up to look like charts.

**Typography** — set explicitly, don't rely on defaults:
- Slide titles: 28-32pt bold
- Section headers: 18-20pt bold
- Body text: 14-16pt (never below 14pt)
- Table text: 14pt
- Sources/footnotes: 14pt, gray
- Same element type = same size throughout the deck

**Charts:**
- Legend inside the chart boundary, not floating over the plot area
- Right-side legend for pies (≤6 slices), bottom legend for line/bar (≤4 series)
- More than 6 series → split into multiple charts or use a table
- Pie charts show percentages on slices, not just in the legend

**Tables:**
- Light gray header row, bold
- Right-align numbers, left-align text
- Enough cell padding that text doesn't touch borders

**Color:** 2-3 colors max. Muted — navy, gray, one accent. Same color meanings throughout.

### What's strict vs. flexible

| Always | Case-by-case |
|---|---|
| Exact titles/sections when user specifies | Creative titles when they don't |
| Chart when user says chart; table when they say table | Visualization type when unspecified |
| Every competitor/data point they list | Number of competitors when unspecified |
| Exact values when specified | Rounding when precision unspecified |
| Titles fit without overflow | Number of competitor categories |
| No overlapping elements | Which dimensions to compare |

---

## Analysis workflow

### Step 0 — Industry-defining metrics

Before anything else: what 3-5 metrics does this industry actually run on? Use these consistently across every competitor.

| Industry | Key metrics |
|---|---|
| SaaS | ARR, NRR, CAC payback, LTV/CAC, Rule of 40 |
| Payments | GPV, take rate, attach rate, transaction margin |
| Marketplaces | GMV, take rate, buyer/seller ratio, repeat rate |
| Retail | Same-store sales, inventory turns, sales per sq ft |
| Logistics | Volume, cost per unit, on-time delivery %, capacity utilization |

Industry not listed — pick the metrics investors and operators benchmark on.

### Step 1 — Market context

Size, growth, drivers, headwinds. With sources.

Use a sourced, dated, method-qualified market-size statement only when it is present in an authorized query result or user-provided file; otherwise state `Market size/growth: UNSOURCED / NOT_CONFIGURED` rather than inventing a number or citing external research.

### Step 2 — Industry economics

Map how value flows. Approach depends on industry structure:
- **Vertically structured** — value chain layers, typical margin at each
- **Platform/network** — ecosystem participants, value flows between them
- **Fragmented** — consolidation dynamics, margin differences by scale

### Step 3 — Target company profile

```
| Metric | Value |
|---|---|
| Revenue | [source-reported amount and currency] |
| Growth | +26% YoY |
| Gross Margin | 45% |
| Profitability | [source-reported amount and currency] Adj. EBITDA |
| Customers | 134K |
| Retention | 92% |
| Market Share | ~15% |
```

Multi-segment companies add a breakdown:

```
| Segment | Revenue | Rev YoY | Rev % | EBITDA | EBITDA YoY | Margin |
|---|---|---|---|---|---|---|
| Seg A | [source amount/currency] | [growth] | [share] | [source amount/currency] | [growth] | [margin] |
| Seg B | [source amount/currency] | [growth] | [share] | [source amount/currency] | [growth] | [margin] |
| Seg C | [source amount/currency] | [growth] | [share] | [source amount/currency] | [growth] | [margin] |
| Total | [source amount/currency] | [growth] | 100% | [source amount/currency]* | - | [margin] |
```
*Note corporate costs if applicable

### Step 4 — Competitor mapping

Group by whichever lens fits (this is a good `ask_user_question` decision if the user hasn't specified):
- By business model — platform / vertical / horizontal
- By segment — enterprise / SMB / consumer
- By posture — direct / adjacent / emerging
- By origin — incumbent / disruptor / new entrant

### Step 5 — Positioning visualization

| Type | When |
|---|---|
| 2×2 matrix | Two dominant competitive factors |
| Radar/spider | Multi-factor comparison |
| Tier diagram | Natural clustering into strategic groups |
| Value chain map | Vertical industries |
| Ecosystem map | Platform markets |

See `references/frameworks.md` for 2×2 axis pairs by industry.

### Step 6 — Competitor deep-dives

Two tables per competitor.

**Metrics:**
```
| Metric | Value |
|---|---|
| Revenue | $X.XB |
| Growth | +XX% YoY |
| Gross Margin | XX% |
| Market Cap | $X.XB |
| Profitability | $XXXM EBITDA |
| Customers | XXK |
| Retention | XX% |
| Market Share | ~XX% |
```

**Qualitative:**
```
| Category | Assessment |
|---|---|
| Business | What they do (1 sentence) |
| Strengths | 2-3 bullets |
| Weaknesses | 2-3 bullets |
| Strategy | Current priorities |
```

### Step 7 — Comparative analysis

```
| Dimension | Company A | Company B | Company C |
|---|---|---|---|
| Scale | ●●● [source-reported amount/currency] | ●●○ [source-reported amount/currency] | ●○○ [source-reported amount/currency] |
| Growth | ●●○ +26% | ●●● +35% | ●●○ +22% |
| Margins | ●●○ 7.5% | ●○○ 3.2% | ●●● 15% |
```

### Step 8 — Strategic context

M&A transactions (multiples, rationale), partnership trends, capital raising patterns, regulatory developments. See `references/schemas.md` for the M&A transaction table format.

### Step 9 — Synthesis

**Moat assessment** — rate each competitor Strong / Moderate / Weak on:

| Moat | What to assess |
|---|---|
| Network effects | User/supplier flywheel strength; cross-side vs same-side |
| Switching costs | Technical integration depth, contractual lock-in, behavioral habits |
| Scale economies | Unit cost advantages at volume; minimum efficient scale |
| Intangible assets | Brand, proprietary data, regulatory licenses, patents |

**Required synthesis elements:**
- Durable advantages (hard to replicate) — map to moat categories
- Structural vulnerabilities (hard to fix)
- Current state vs. trajectory

**For investment contexts** (skip if the Phase 1 scoping said no):

```
| Scenario | Probability | Key driver |
|---|---|---|
| Bull | 30% | Market share gains, margin expansion |
| Base | 50% | Current trajectory continues |
| Bear | 20% | Competitive pressure, margin compression |
```

---

## Quality checklist

Before finishing:

**Prompt fidelity**
- Slide titles match what the user specified, verbatim
- Charts where they said chart; tables where they said table
- Every competitor/year/data point they listed is present
- Exact values and formats as specified

**Data consistency**
- Source-file values extracted directly, not recalculated
- Same metric shows the same value on every slide it appears
- Same decimal precision as the source

**Layout**
- Titles fit without overflow
- No overlapping elements
- All text within containers, no clipping

**Content**
- Every number has a citation
- All metrics from the same fiscal period (or flagged)
- Slide titles state insights, not topics
- Charts are real chart objects

Run standard visual verification checks on every slide — this catches overlaps, overflow, and low-contrast text that don't show up when you're reading back the XML.
