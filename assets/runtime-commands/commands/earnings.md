---
description: Analyze mainland A-share quarterly earnings and create an earnings update report
argument-hint: "[A-share company or ticker, e.g. 600519.SH] [quarter, e.g. Q3 2026]"
---

# Earnings Analysis Command

Create a professional equity research earnings update report for mainland China A-share ordinary shares only; exclude HK shares, B-shares, ADRs, ETFs and LOFs initially. Use CNY when supported by the source, preserve dates, units and provenance, and mark missing evidence `UNSOURCED` or `NOT_CONFIGURED`.

## Workflow

### Step 1: Gather Information

Parse the input for:
- Mainland China A-share ordinary-share company or six-digit ticker with `.SH`, `.SZ`, or `.BJ` suffix
- Reporting quarter/period

Exclude HK shares, B-shares, ADRs, ETFs and LOFs initially. If not provided, ask which A-share company and reporting period to analyze.

### Step 2: Verify Timeliness and Source Authority

Use only user-provided A-share filings/data or `finance_data_query` when that tool is exposed and its underlying source is explicitly configured and authorized for this exact request. Do not use raw MCP, web search/scraping, guessed providers, credentials, or vendor access. Verify dates from supplied/authorized source evidence; if freshness or availability cannot be established, mark `UNSOURCED`/`NOT_CONFIGURED` instead of searching elsewhere. Flag snapshot/latest-only observations `current_only`; do not present them as historical or PIT data.

### Step 3: Load Earnings Analysis Skill

Use `skill: "earnings-analysis"` to create the report:

1. **Data Collection** (user-provided or explicitly authorized source only):
   - A-share issuer quarterly/annual report and earnings announcement
   - Full earnings call transcript and investor materials, when provided
   - Consensus estimates only if explicitly configured and authorized; otherwise mark `NOT_CONFIGURED`
   - Preserve report period, publication/availability date, CNY units and provenance; do not infer missing fields

2. **Beat/Miss Analysis**:
   - Revenue vs supported consensus: Beat/Miss by CNY X or X%
   - EPS vs supported consensus: Beat/Miss by CNY X/share or X%
   - Key segment performance vs expectations
   - Explain WHY results differed

3. **Key Metrics Analysis**:
   - Revenue breakdown by segment/geography
   - Margin trends (gross, operating, net)
   - Guidance: raised/maintained/lowered
   - Updated forward estimates

4. **Generate Charts** (8-12):
   - Quarterly revenue progression
   - Quarterly EPS progression
   - Margin trends
   - Revenue by segment
   - Beat/miss summary
   - Estimate revisions
   - Valuation charts

5. **Create Report** (8-12 pages):
   - Page 1: Summary with rating and price target
   - Pages 2-3: Detailed results analysis
   - Pages 4-5: Key metrics & guidance
   - Pages 6-7: Updated investment thesis
   - Pages 8-10: Valuation & estimates
   - Sources section with clickable hyperlinks

### Step 4: Deliver Output

Provide:
1. **DOCX report** - 8-12 page earnings update
2. **Summary** highlighting:
   - Beat/miss on key metrics
   - Guidance changes
   - Thesis impact (positive/negative/neutral)

## Report Structure Reference

```
PAGE 1: EARNINGS SUMMARY
┌─────────────────────────────────────────────────────────────────┐
│ TEST_ONLY 600519.SH Q3 2026 Earnings Update                     │
│ Rating: [if requested] | Price Target: CNY XXX (from CNY XXX)   │
├─────────────────────────────────────────────────────────────────┤
│ KEY TAKEAWAYS                                                   │
│ • Revenue beat by X% on strong [segment] performance            │
│ • EPS beat by CNY X.XX/share driven by margin expansion                  │
│ • FY guidance raised to CNY X.XX-CNY X.XX (from CNY X.XX-CNY X.XX)         │
│ • Thesis intact; maintain BUY rating                            │
├─────────────────────────────────────────────────────────────────┤
│ RESULTS SNAPSHOT                                                │
│ ┌─────────────┬──────────┬──────────┬──────────┐               │
│ │ Metric      │ Actual   │ Consensus│ Beat/Miss│               │
│ │ Revenue     │ CNY X.XXB│ CNY X.XXB│ +X.X%    │               │
│ │ EPS         │ CNY X.XX │ CNY X.XX │ +CNY X.XX│               │
│ │ Gross Margin│ XX.X%    │ XX.X%    │ +XXbps   │               │
│ └─────────────┴──────────┴──────────┴──────────┘               │
└─────────────────────────────────────────────────────────────────┘

PAGES 2-3: DETAILED RESULTS
- Segment-by-segment analysis
- Geographic breakdown
- Key drivers of beat/miss

PAGES 4-5: METRICS & GUIDANCE
- Margin analysis
- Full-year guidance comparison
- Updated quarterly estimates

PAGES 6-7: THESIS UPDATE
- What's changed
- Risks and catalysts
- Investment recommendation

PAGES 8-10: VALUATION
- Updated DCF/comps if material
- Price target justification
- Scenario analysis

SOURCES SECTION (cite only supplied/authorized A-share evidence):
- A-share issuer report/announcement: [provided or authorized source reference]
- Earnings Call Transcript: [provided source reference, if available]
- Consensus estimates: [explicitly authorized source and as-of date, or NOT_CONFIGURED]
```

## Quality Checklist

Before delivery:
- [ ] Earnings data is from latest quarter (not stale)
- [ ] Beat/miss quantified with specific numbers
- [ ] All charts embedded (8-12 total)
- [ ] Sources section with clickable hyperlinks
- [ ] Every figure/table has source citation
- [ ] Guidance changes clearly documented
- [ ] Rating and price target stated upfront
- [ ] 8-12 pages, 3,000-5,000 words
