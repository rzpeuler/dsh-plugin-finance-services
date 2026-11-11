---
description: Build a DCF valuation model for mainland China A-shares
argument-hint: "[A-share company or ticker, e.g. 600519.SH]"
---

# DCF Valuation Command

Build a DCF model that uses comparable company analysis to inform valuation ranges for mainland China A-share ordinary shares only; exclude HK shares, B-shares, ADRs, ETFs and LOFs initially. Use CNY when evidenced by the inputs and preserve dates, units, accounting basis and provenance.

## Workflow

### Step 1: Gather Company Information

If a mainland China A-share ordinary-share company or six-digit ticker with `.SH`, `.SZ`, or `.BJ` suffix is provided, use it. Otherwise ask which A-share company to value. Exclude HK/B-shares, ADRs, ETFs and LOFs.

### Step 2: Run Comparable Company Analysis

**First, load the comps-analysis skill** to build trading comps:

Use `skill: "comps-analysis"` to:
1. Identify 4-6 comparable mainland A-share ordinary-share companies only
2. Obtain operating metrics (Revenue, EBITDA, margins, growth) from user-provided data or `finance_data_query` only when exposed and the underlying source is explicitly configured and authorized
3. Obtain valuation multiples (EV/Revenue, EV/EBITDA, P/E) on the same approved basis
4. Calculate statistical summary (median, 25th/75th percentiles)

Never use raw MCP, web search/scraping, guessed providers or credentials. If no authorized data is available, use user-provided data and mark gaps `UNSOURCED`/`NOT_CONFIGURED`; preserve dates, CNY/units, accounting basis, provenance, and flag latest-only observations `current_only`.

**Key outputs to capture from comps:**
- Median EV/EBITDA multiple → informs terminal value exit multiple
- Median EV/Revenue multiple → sanity check on DCF output
- Peer growth rates → benchmark for revenue projections
- Peer margins → benchmark for margin assumptions

### Step 3: Build DCF Model

**Load the dcf-model skill** to construct the valuation:

Use `skill: "dcf-model"` to:
1. Gather historical financials and market data from user-provided inputs or `finance_data_query` only when exposed and the source is explicitly configured and authorized
2. Build revenue projections (Bear/Base/Bull cases)
3. Model operating expenses and FCF
4. Calculate WACC using CAPM, matching currency and nominal/real basis to the inputs
5. Discount cash flows and calculate terminal value
6. Bridge to equity value and implied share price in CNY/share when inputs are CNY

Never use raw MCP, web search/scraping, guessed providers or credentials. Mark missing data `UNSOURCED`/`NOT_CONFIGURED`; preserve dates, units, accounting basis and provenance; flag snapshot/latest-only market values `current_only` and never imply historical availability.

**Use comps to inform DCF assumptions:**

| Comps Output | DCF Input |
|--------------|-----------|
| Peer median EV/EBITDA | Terminal exit multiple range |
| Peer 25th-75th EV/EBITDA | Sensitivity analysis range |
| Peer median growth rate | Benchmark for revenue assumptions |
| Peer median EBITDA margin | Target margin in terminal year |
| Peer median P/E | Cross-check implied P/E from DCF |

### Step 4: Cross-Check Valuation

After DCF is complete, validate:
1. **Implied EV/EBITDA** from DCF vs peer median
   - If DCF implies 25x but peers trade at 12x, investigate why
2. **Implied P/E** from DCF vs peer median
3. **Terminal value as % of EV** (should be 50-70%)
4. **Implied growth** embedded in valuation vs peer growth rates

### Step 5: Deliver Output

Provide:
1. **Comps analysis spreadsheet** (.xlsx) with peer trading multiples
2. **DCF model** (.xlsx) with:
   - Bear/Base/Bull scenarios
   - Sensitivity tables (WACC vs Terminal Growth, etc.)
   - Valuation summary with implied upside/downside
3. **Summary** explaining:
   - Key valuation drivers
   - How comps informed the analysis
   - Risks and sensitivities to watch

## Example Output Summary

```
VALUATION SUMMARY: TEST_ONLY 600519.SH (A-share ordinary share)

Comparable Companies Analysis:
- Peer Group: [List of 4-6 comps]
- Median EV/EBITDA: 12.5x (range: 10.2x - 15.8x)
- Median EV/Revenue: 3.2x (range: 2.1x - 4.5x)

DCF Valuation (Base Case):
- Implied Share Price: CNY XX.XX/share
- Current Price: CNY YY.YY/share (include only with dated, authorized or user-provided evidence)
- Implied Upside: +XX%

Valuation Cross-Check:
- DCF Implied EV/EBITDA: 13.2x (vs peer median 12.5x)
- DCF Implied P/E: 22.4x (vs peer median 20.1x)
- Terminal Value: 62% of EV (within normal range)

Key Assumptions:
- Revenue CAGR: X% (vs peer median X%)
- Terminal EBITDA Margin: X% (vs peer median X%)
- WACC: X.X%
- Terminal Growth: X.X%
```
