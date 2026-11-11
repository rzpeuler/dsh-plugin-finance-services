# Detailed Workflow for Earnings Updates

This document provides detailed step-by-step instructions for each phase of the earnings update process.

## A-Share source boundary

Analyze only mainland A-share ordinary-share issuers. Use `finance_data_query` only when the exact tool/source and relevant capability are explicitly available, configured, and authorized; otherwise use user-provided files only. Do not use raw MCP, web search/fetch, guessed providers, or market-data credentials. Use the reporting period requested by the user; do not infer that newer materials exist. Mark missing earnings, consensus, or market inputs `UNSOURCED` / `NOT_CONFIGURED`, and omit dependent claims. Preserve source, dates, period, currency/unit, and provenance; never claim historical PIT from `current_only`.

## Phase 1: Earnings Data Collection (30-60 minutes)

### Step 1: Identify the Requested Earnings Period

Use the quarter/period and issuer specified by the user. Identify actuals only from an explicitly available, configured, and authorized `finance_data_query` result or user-provided issuer materials. Confirm the issuer, reporting period, document/query date, reporting scope, currency, and units. Do not search the web, infer a newer quarter, or substitute an unrelated issuer. If the required material is missing, mark it `UNSOURCED` / `NOT_CONFIGURED` and stop the affected analysis.

### Step 1a: Confirm Period and Fiscal Calendar

- Read the reporting period and publication/document date from the supplied or authorized source.
- Confirm the company's fiscal calendar only from those materials or user-provided context; do not assume calendar-year quarters.
- Keep the user-requested historical period even if it is not the latest; recency is not a substitute for request fidelity.
- If multiple supplied sources disagree on issuer, period, or date, flag the conflict and ask for clarification rather than choosing silently.

**Step 1b: Understand Company's Fiscal Calendar**

Record the issuer's fiscal calendar from the provided or authorized source; do not import another company's fiscal-year pattern. Verify the source document/query identifies the requested issuer and period, and record its date. A historical period is not stale merely because it is older than three months.

**Step 1b: Source/Period Verification**

- [ ] Issuer and A-share ordinary-share scope match the request
- [ ] Reporting period and source/document date are explicit
- [ ] Currency, unit, and consolidation/attribution scope are retained
- [ ] Conflicting or missing source details are flagged, not guessed
- [ ] Missing external data is marked `UNSOURCED` / `NOT_CONFIGURED`
- [ ] No unsupported provider, web source, or historical-PIT claim was introduced

**Step 1c: Handle Naming Variations**

Companies use different terminology - recognize these patterns:

**Quarter terminology:**
- "Q1 2024", "Q1 FY24", "First Quarter 2024", "1Q24"
- "Third Quarter Fiscal 2024", "Q3 FY2024", "3Q FY24"

**Earnings release titles:**
- "[Company] Reports Q3 2024 Results"
- "[Company] Announces Third Quarter Fiscal 2024 Financial Results"
- "[Company] Q3 Revenue Grew 15% Year-over-Year"

### Step 2: Gather Available Earnings Materials

Use only materials supplied by the user or returned by an explicitly available, configured, and authorized `finance_data_query` capability. The capability must actually provide the requested content; do not infer filing, transcript, estimates, or URL access from the tool name. Do not browse issuer websites, search the web, use raw MCP, or substitute an unapproved vendor.

**Use when supplied/available:**
- Issuer earnings release, report, financial statements, and announcements
- Earnings call transcript, webcast text, investor presentation, or supplemental file
- Prior-period actuals, guidance, and estimates for comparisons
- Pre-release consensus only when explicitly supplied or returned by a configured and authorized capability with an as-of date

For each item, verify issuer and period, record document/query date, source, page/section/field, reporting currency/unit, and provenance. Keep only materials relevant to the requested period; do not require a transcript or presentation if the user did not provide one and the authorized source does not return it.

If results, prior-period values, consensus, price, or another required input is missing, label it `UNSOURCED` / `NOT_CONFIGURED`. Do not calculate a beat/miss against an unavailable estimate or fill missing quarters from memory. Use source-reported accounting basis and currency; do not infer CAS or convert currencies without a documented user-provided or explicitly authorized rate.

**Source and period verification before proceeding:**
- [ ] Issuer, A-share ordinary-share scope, and user-requested reporting period match
- [ ] Source/document date and reporting period are recorded; no unsupported recency requirement
- [ ] Supplied transcript/materials match the period when they are used
- [ ] Reported revenue, EPS, margins, and currency/unit are traced to available source data
- [ ] Pre-release consensus is used only if user-provided or returned by a configured, authorized capability with an explicit as-of date
- [ ] Missing inputs are marked `UNSOURCED` / `NOT_CONFIGURED`; dependent analysis is omitted
- [ ] No web search, raw MCP, guessed provider, or unsupported historical-PIT claim was used

### Step 3: Extract Key Metrics

Create a structured summary:

```
REPORTED RESULTS vs. ESTIMATES:
─────────────────────────────────────────────────
                    Reported    Our Est    Consensus    Beat/(Miss)
Revenue             [source currency] X,XXX      [source currency] X,XXX     [source currency] X,XXX       [source currency] XX (X%)
Gross Margin        XX.X%       XX.X%      XX.X%        XXbps
EBITDA              [source currency] XXX        [source currency] XXX       [source currency] XXX         [source currency] XX (X%)
Operating Profit    [source currency] XXX        [source currency] XXX       [source currency] XXX         [source currency] XX (X%)
EPS (Adjusted)      [source currency] X.XX       [source currency] X.XX      [source currency] X.XX        [source currency] X.XX
EPS (GAAP)          [source currency] X.XX       [source currency] X.XX      [source currency] X.XX        [source currency] X.XX

KEY BUSINESS METRICS:
─────────────────────────────────────────────────
[Metric 1]          XXX         XXX        XXX          +X% YoY
[Metric 2]          XXX         XXX        XXX          +X% YoY
[Metric 3]          XXX         XXX        XXX          +X% YoY
```

### Step 4: Identify Key Themes from Available Call Materials

Use only a user-provided transcript or an explicitly available, configured, and authorized `finance_data_query` result that contains transcript material. If none is available, mark transcript-based commentary `UNSOURCED` / `NOT_CONFIGURED`; do not search externally. When available, note:
- Management's tone (confident, cautious, defensive?)
- Key topics emphasized (product launches, geographic trends, competition)
- Questions from analysts (what are investors concerned about?)
- Guidance provided (raised, lowered, maintained, introduced?)
- Any surprises or unexpected commentary

## Phase 2: Analysis (2-3 hours)

### Step 5: Beat/Miss Analysis

For EACH key metric that beat or missed, explain:

**If BEAT:**
- What drove the outperformance?
- Was it one-time or sustainable?
- Did management guide higher going forward?
- How does this impact our thesis?

**If MISS:**
- What went wrong?
- Was it company-specific or industry-wide?
- Is management taking corrective action?
- How does this impact our thesis?

**Example Format:**
```
■ **[Metric] [beat/missed] the available estimate by [source-currency amount] ([percentage])**

Use reported actuals and source-reported currency/units. Compare only with a user-provided estimate or an explicitly configured, authorized consensus field with an as-of date; otherwise state that the comparison is `UNSOURCED` / `NOT_CONFIGURED`. Describe drivers only when documented in the available issuer materials. Do not substitute unsupported market commentary.
```

### Step 6: Segment/Geographic/Product Analysis

Analyze performance by:
- Business segment (if multi-segment company)
- Geography as reported in the issuer's available source
- Product category
- Channel (retail, wholesale, e-commerce)

Identify:
- What outperformed expectations?
- What underperformed?
- Trends vs. prior quarters
- Management commentary on outlook for each area

### Step 7: Margin Analysis

Analyze profitability:
- Gross margin: up or down? why?
- Operating margin: up or down? why?
- Key drivers (pricing, mix, costs, leverage)
- Outlook going forward

### Step 8: Guidance Analysis

If company provided guidance:
- Compare new guidance to prior guidance
- Compare only with user-provided estimates or explicitly configured and authorized consensus fields; otherwise mark unavailable comparisons `UNSOURCED` / `NOT_CONFIGURED`
- Assess credibility (does company have track record of sandbagging? beating?)
- Identify key assumptions behind guidance

If company did NOT provide guidance:
- Note this explicitly
- Provide independent outlook based on results and commentary

### Step 9: Update Financial Model

Update estimates for:
- Current year (remaining quarters)
- Next year
- Potentially year after

**Show clearly:**
```
UPDATED ESTIMATES:
─────────────────────────────────────────────────
                        Old Est     New Est     Change      Reason
FY2024E Revenue         [source currency] XX.XB      [source currency] XX.XB      +X.X%      [Brief reason]
FY2024E EBITDA          [source currency] X.XB       [source currency] X.XB       +X.X%      [Brief reason]
FY2024E EPS             [source currency] X.XX       [source currency] X.XX       +X.X%      [Brief reason]

FY2025E Revenue         [source currency] XX.XB      [source currency] XX.XB      +X.X%      [Brief reason]
FY2025E EBITDA          [source currency] X.XB       [source currency] X.XB       +X.X%      [Brief reason]
FY2025E EPS             [source currency] X.XX       [source currency] X.XX       +X.X%      [Brief reason]
```

### Step 10: Update Valuation & Price Target

Based on updated estimates:
- Recalculate DCF (use updated cash flows)
- Update comparable company multiples (if peer group has reported)
- Determine new fair value
- Decide if price target changes

**Price Target Decision:**
- If estimates changed significantly (>5%) → Usually change price target
- If estimates changed marginally (<5%) → May maintain price target
- If thesis strengthened/weakened → May change even without estimate change

### Step 11: Assess Rating Impact

Decide whether to change rating:
- If results significantly better than expected + guidance raised → Consider upgrade
- If results significantly worse + guidance cut → Consider downgrade
- If inline or mixed → Usually maintain rating

**Consider:**
- Stock reaction (up/down/flat?)
- Valuation (expensive/cheap relative to new estimates?)
- Risk/reward (asymmetry shifted?)

## Phase 3: Chart Generation (1-2 hours)

### Step 12: Generate 8-12 Charts

Create charts focusing on QUARTERLY TRENDS and WHAT'S NEW.

**REQUIRED CHARTS (8-12 total):**

1. **Quarterly Revenue Progression** (Bar chart)
   - Last 8-12 quarters
   - Show beat/miss vs. estimates each quarter
   - Highlight current quarter

2. **Quarterly EPS Progression** (Bar chart)
   - Last 8-12 quarters
   - Show beat/miss vs. estimates
   - Adjusted and GAAP

3. **Quarterly Margin Trend** (Line chart)
   - Gross margin, EBIT margin, net margin
   - Last 8-12 quarters
   - Show trajectory

4. **Revenue by Segment/Geography** (Stacked bar OR table)
   - Current quarter vs. YoY
   - Growth rates by segment

5. **Key Operating Metrics** (Multi-line chart)
   - Customer count, ARPU, units sold, etc. (whatever is relevant)
   - Last 8-12 quarters

6. **Beat/Miss Summary** (Waterfall or table)
   - Show components of beat/miss
   - What drove variance from estimates

7. **Estimate Revision Chart** (Before/after comparison)
   - Old FY estimates vs. new FY estimates
   - Bar chart showing change

8. **Valuation Chart** (P/E or EV/EBITDA multiple)
   - Historical multiple range
   - Current multiple
   - Fair value multiple

**OPTIONAL CHARTS (if space allows):**
- Peer comparison (if peers have reported)
- Guidance vs. Street comparison
- Cash flow metrics
- Balance sheet highlights (if notable)

**Chart Style Guidelines:**
- Focus on TRENDS (quarterly progression)
- Highlight CHANGES (beat/miss, estimate revisions)
- Keep simple and clear (this is a fast-turnaround report)

## Phase 4: Report Creation (2-3 hours)

### Step 13: Create DOCX Report

Use DOCX skill to create 8-12 page report.

See [report-structure.md](report-structure.md) for complete page-by-page templates and formatting requirements.

**Key Steps:**
1. Create Page 1 with earnings summary and quick takeaways
2. Add detailed results analysis (Pages 2-3)
3. Include key metrics and guidance (Pages 4-5)
4. Update investment thesis (Pages 6-7)
5. Provide valuation and estimates (Pages 8-10)
6. Add appendix if needed (Pages 11-12)
7. Embed all 8-12 charts throughout
8. Add 1-3 summary tables
9. Include a sources/provenance section with source or user-file name, date, period, currency/unit, and provenance; do not create unsupported external links

### Step 14: Optional - Update XLS Model

If a full financial model exists for this company (from initiation), update it with:
- Actual Q[X] results
- Revised estimates for future quarters
- Updated valuation

**Note**: For earnings updates, a full XLS file is OPTIONAL (not required like in initiation reports). The DOCX report is the primary deliverable.

If creating XLS, include:
- Quarterly model tab
- Updated annual projections
- Revised DCF
- Updated comps analysis

## Phase 5: Quality Check & Delivery (30 minutes)

### Step 15: Quality Checklist

Before publishing, verify:

**Content:**
- [ ] Beat/miss clearly stated and quantified
- [ ] Key drivers explained (not just "strong performance")
- [ ] Updated estimates provided (old vs. new shown)
- [ ] Price target updated or explicitly maintained
- [ ] Rating confirmed or changed with rationale
- [ ] Guidance analyzed (if provided)
- [ ] Thesis impact assessed

**Formatting:**
- [ ] Page 1 has summary box and key bullets
- [ ] All tables have source lines
- [ ] All figures numbered and captioned
- [ ] Estimates table shows old vs. new
- [ ] 8-12 charts embedded throughout
- [ ] Report is 8-12 pages (not too long, not too short)

**Accuracy:**
- [ ] Numbers match company's reported results exactly
- [ ] Math checks out (estimates, valuation)
- [ ] No typos in ticker, company name, numbers
- [ ] Charts match text descriptions
- [ ] Date is current

**Citations:** ⭐ MANDATORY
- [ ] Every figure has specific source with document and date
- [ ] Every table has specific source with document reference
- [ ] Beat/miss analysis cites a user-provided or authorized consensus source with its as-of date, or is omitted/marked `UNSOURCED` / `NOT_CONFIGURED`
- [ ] Guidance changes cite current and prior supplied/authorized source materials
- [ ] Key statistics have source/field/page/slide references where available
- [ ] Sources section records all used material, dates, periods, units, and provenance
- [ ] No external URL or hyperlink is required unless it is present in a user-provided file or authorized result
- [ ] Earnings call quotes cite specific speaker and approximate timestamp

**Timeliness:**
- [ ] Report published within 24-48 hours of earnings release
- [ ] All data matches the user-requested reporting period
- [ ] Consensus estimates are pre-earnings (not post-earnings)

### Step 16: Deliver Report

Provide user with:

1. **DOCX file**: `[Company]_Q[X]_[Year]_Earnings_Update.docx`
2. **Chart files**: All PNG/JPG charts (for reference)
3. **Optional XLS**: Updated financial model if maintained

**Brief summary for user:**
```
[Company] Q[X] [Year] Earnings Update Complete

Results: [BEAT / INLINE / MISS]
- Revenue: [source currency] X.XB ([beat/missed] by [source currency] XXM or X%)
- EPS: [source currency] X.XX ([beat/missed] by [source currency] X.XX)

Key Takeaways:
■ [Takeaway 1]
■ [Takeaway 2]
■ [Takeaway 3]

Updated Estimates:
- FY[Year]E Revenue: [source currency] XX.XB (prior: [source currency] XX.XB, [+/-]X%)
- FY[Year]E EPS: [source currency] X.XX (prior: [source currency] X.XX, [+/-]X%)

Rating: [MAINTAINED / RAISED / LOWERED] [RATING]
Price Target: [source currency] XXX (prior: [source currency] XXX) - [+/-]XX% upside

Deliverable: 8-12 page earnings update report with updated estimates and valuation.
```
