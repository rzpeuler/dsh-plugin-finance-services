# Task 3: Valuation Analysis - Detailed Workflow

This document provides step-by-step instructions for executing Task 3 (Valuation Analysis) of the initiating-coverage skill.

## Task Overview

**Purpose**: Perform comprehensive valuation using DCF, comparables, and precedent transactions.

**Prerequisites**: ⚠️ Verify before starting
- **Required**: Financial model from Task 2
  - Projected income statements
  - Projected cash flows
  - Revenue and EBITDA forecasts
  - DCF inputs (unlevered FCF)

**Required gate:** Task 2 must be complete and its model validated. If it is missing, do not create placeholder valuations. In single-task mode, explain the missing prerequisite and ask whether to complete Task 2 first. In explicit unattended full-run mode, return `BLOCKED` and stop without asking.

**Output**: Valuation analysis (.md) plus supported tabs in the Task 2 workbook.
- DCF/sensitivity analysis only when required model and market inputs are verified
- Comparable-company analysis only with an explicitly justified, source-supported peer set
- Precedent transactions / football field only when authorized transaction data exists
- A price target/recommendation only when price, shares, debt/cash, valuation assumptions, and relevant inputs are complete; otherwise mark `UNSOURCED` / `NOT_CONFIGURED`

---

## Input Verification

**BEFORE STARTING - CHECK:**
- [ ] Task 2 complete? (Financial model exists)
- [ ] Model file path/location known?
- [ ] Can access projected financials from model?

**Required from model:**
- [ ] Projected FCF (5 years)
- [ ] Revenue projections
- [ ] EBITDA projections
- [ ] Terminal year metrics
- [ ] Balance sheet data (debt, cash, shares)

**IF VERIFICATION FAILS**: Stop. In single-task mode, explain the missing Task 2 inputs and ask whether to complete them first. In explicit unattended full-run mode, return `BLOCKED` without asking; do not continue with placeholder values.

---

## Detailed Methodology Reference

For deep dive on valuation methodologies, formulas, and theory, see:
**[valuation-methodologies.md](valuation-methodologies.md)**

This workflow document focuses on execution steps. Reference the methodology file for:
- DCF theory and formulas
- WACC calculation details
- Terminal value methods
- Comparable companies theory
- Precedent transactions theory

---

## Step-by-Step Valuation Workflow

### Step 1: Extract Data from Financial Model

**From Task 2's financial model, extract:**

1. **Projected Financials (5 years)**
   - Revenue by year (2025E-2029E)
   - EBITDA by year
   - EBIT by year
   - Tax rate
   - D&A by year
   - CapEx by year
   - Change in NWC by year

2. **Unlevered Free Cash Flow**
   ```
   Extract from DCF Inputs tab in financial model:

                   2025E   2026E   2027E   2028E   2029E
   EBIT            [source currency] XXX    [source currency] XXX    [source currency] XXX    [source currency] XXX    [source currency] XXX
   × (1 - Tax Rate)
   = NOPAT         [source currency] XXX    [source currency] XXX    [source currency] XXX    [source currency] XXX    [source currency] XXX
   + D&A           [source currency] XXX    [source currency] XXX    [source currency] XXX    [source currency] XXX    [source currency] XXX
   - CapEx         ([source currency] XX)   ([source currency] XX)   ([source currency] XX)   ([source currency] XX)   ([source currency] XX)
   - Chg in NWC    ([source currency] XX)   ([source currency] XX)   ([source currency] XX)   ([source currency] XX)   ([source currency] XX)
   = Unlevered FCF [source currency] XXX    [source currency] XXX    [source currency] XXX    [source currency] XXX    [source currency] XXX
   ```

3. **Balance Sheet Data (current)**
   - Total debt
   - Cash & equivalents
   - Net debt (Debt - Cash)
   - Diluted shares outstanding

4. **Scenario Data**
   - Bull case revenue CAGR and terminal margin
   - Base case revenue CAGR and terminal margin
   - Bear case revenue CAGR and terminal margin

### Step 2: Build DCF Analysis

#### A. Calculate WACC

**1. Determine Risk-Free Rate**
   - Use only a user-provided or explicitly configured and authorized input appropriate to the valuation currency and market
   - Do not default to a U.S. Treasury yield or invent a mainland China rate; if unavailable, mark `UNSOURCED` / `NOT_CONFIGURED` and leave WACC incomplete.

**2. Determine Cost of Equity (CAPM)**
   ```
   Cost of Equity = Risk-Free Rate + Beta × Equity Risk Premium

   Inputs:
   - Risk-Free Rate: [user-provided or explicitly authorized input appropriate to valuation currency/market; record date]
   - Beta: [user-provided or explicitly authorized input; document methodology and date]
   - Equity Risk Premium: [user-provided or explicitly authorized assumption; document basis and date]

   Example:
   Cost of Equity = [calculated only from sourced/user-provided inputs; otherwise `UNSOURCED` / `NOT_CONFIGURED`]
   ```

**3. Determine Cost of Debt**

All numerical values in worked examples below are illustrative arithmetic only, not default A-share market, currency, tax, WACC, or growth assumptions. Use only inputs supplied by the user or available from an explicitly configured and authorized source.
   ```
   Cost of Debt = Current borrowing rate or implied yield on bonds

   For private companies:
   Cost of Debt = Risk-Free Rate + Credit Spread (based on rating)

   Example:
   Cost of Debt (pre-tax) = [source/user-provided rate]
   Cost of Debt (after-tax) = [source/user-provided rate] × (1 - source/user-provided applicable tax rate); do not assume jurisdictional treatment
   ```

**4. Determine Capital Structure**
   ```
   Use market values (not book values):

   Market Value of Equity (E) = Share Price × Shares Outstanding
   Market Value of Debt (D) = Total Debt (use book value if bonds not traded)
   Total Value (V) = E + D

   Weight of Equity = E / V
   Weight of Debt = D / V

   Example:
   E = [source currency] 5,000M (90.9%)
   D = [source currency] 500M (9.1%)
   V = [source currency] 5,500M (100%)
   ```

**5. Calculate WACC**
   ```
   WACC = (E/V × Cost of Equity) + (D/V × Cost of Debt × (1 - Tax Rate))

   Example:
   WACC = (90.9% × 11.35%) + (9.1% × 6.5% × (1 - 25%))
   WACC = 10.32% + 0.44% = 10.76%

   Round to: 10.8% for base case
   ```

#### B. Calculate Terminal Value

**Method 1: Perpetuity Growth (Preferred)**
```
Terminal Value = FCF(2029) × (1 + g) / (WACC - g)

Where:
- FCF(2029) = Final year unlevered FCF from model
- g = Perpetual growth rate (user-provided or explicitly authorized input; document currency/market and basis)
  - Do not use an unsupported default; if unavailable, mark `UNSOURCED` / `NOT_CONFIGURED` and leave the valuation incomplete
  - Ensure g is below WACC; compare with long-term GDP only when the relevant source is available

Example:
FCF(2029) = [source currency] 500M
g = 2.5%
WACC = 10.8%

Terminal Value = [source currency] 500M × (1.025) / (0.108 - 0.025)
Terminal Value = [source currency] 512.5M / 0.083 = [source currency] 6,175M
```

**Method 2: Exit Multiple (Alternative)**
```
Terminal Value = EBITDA(2029) × Exit Multiple

Where:
- Exit Multiple = Current peer trading median (e.g., 12-15x EBITDA)

Example:
EBITDA(2029) = [source currency] 800M
Exit Multiple = 13x

Terminal Value = [source currency] 800M × 13x = [source currency] 10,400M
```

**Choose one method or average both.**

#### C. Discount Cash Flows to Present Value

```
PV of Projected FCF = Σ [FCFt / (1 + WACC)^t] for t = 1 to 5

Example:
Year    FCF      Discount    PV of FCF
        ([source currency] M)     Factor      ([source currency] M)
2025    [source currency] 250     1/(1.108)^1 = 0.9026    [source currency] 226
2026    [source currency] 320     1/(1.108)^2 = 0.8147    [source currency] 261
2027    [source currency] 390     1/(1.108)^3 = 0.7353    [source currency] 287
2028    [source currency] 450     1/(1.108)^4 = 0.6636    [source currency] 299
2029    [source currency] 500     1/(1.108)^5 = 0.5988    [source currency] 299
                              Total PV:  [source currency] 1,372M

PV of Terminal Value = Terminal Value / (1 + WACC)^5
PV of Terminal Value = [source currency] 6,175M / (1.108)^5 = [source currency] 6,175M × 0.5988 = [source currency] 3,697M

Enterprise Value = [source currency] 1,372M + [source currency] 3,697M = [source currency] 5,069M
```

#### D. Calculate Equity Value and Price Per Share

```
Enterprise Value                 [source currency] 5,069M
- Net Debt (Debt - Cash)         ([source currency] 450M)
+ Non-operating Assets           [source currency] 0M
- Minority Interest              [source currency] 0M
- Preferred Stock                [source currency] 0M
= Equity Value                   [source currency] 4,619M

Diluted Shares Outstanding       100M

Price Per Share = [source currency] 4,619M / 100M = [source currency] 46.19

Current Stock Price: [source currency] 42.00
Implied Upside: 10.0%
```

#### E. DCF Sensitivity Analysis **CRITICAL**

**Table 1: WACC vs. Terminal Growth Rate**

Create 2-way sensitivity table:
```
Price Per Share ([source currency] )     Terminal Growth Rate
WACC        1.5%    2.0%    2.5%    3.0%    3.5%
9.0%        [source currency] 52     [source currency] 55     [source currency] 59     [source currency] 63     [source currency] 68
9.5%        [source currency] 48     [source currency] 51     [source currency] 54     [source currency] 58     [source currency] 62
10.0%       [source currency] 45     [source currency] 48     [source currency] 51     [source currency] 54     [source currency] 57
10.5%       [source currency] 42     [source currency] 45     [source currency] 47     [source currency] 50     [source currency] 53
11.0%       [source currency] 40     [source currency] 42     [source currency] 44     [source currency] 47     [source currency] 50
11.5%       [source currency] 38     [source currency] 40     [source currency] 42     [source currency] 44     [source currency] 47
12.0%       [source currency] 36     [source currency] 38     [source currency] 40     [source currency] 42     [source currency] 44

Base Case: WACC = 10.8%, g = 2.5% → [source currency] 46
Format as heatmap: Green (high values) → Yellow → Red (low values)
```

**Table 2: Revenue CAGR vs. Terminal EBITDA Margin**
```
Price Per Share ([source currency] )     Terminal EBITDA Margin (2029E)
Revenue CAGR    28%     30%     32%     34%     36%
15%             [source currency] 38     [source currency] 42     [source currency] 46     [source currency] 50     [source currency] 54
20%             [source currency] 42     [source currency] 46     [source currency] 51     [source currency] 56     [source currency] 61
25%             [source currency] 46     [source currency] 51     [source currency] 56     [source currency] 62     [source currency] 68
30%             [source currency] 51     [source currency] 56     [source currency] 62     [source currency] 68     [source currency] 75
35%             [source currency] 56     [source currency] 62     [source currency] 68     [source currency] 75     [source currency] 83

Base Case: Rev CAGR = 25%, EBITDA Margin = 32% → [source currency] 56
```

### Step 3: Comparable Companies Analysis

#### A. Select Comparable Companies

**Selection Criteria:**
- Same industry/sector (primary requirement)
- Similar business model
- Comparable size (market cap, revenue)
- Similar growth profile
- Similar geographies

Identify a peer set only from listed A-share issuers and valuation data returned by user-provided files or an explicitly configured and authorized capability. Select peers for business-model, product, scale, and market comparability; document inclusion/exclusion rationale. Do not force a peer count or use foreign-market peers without explicitly supported, comparable data.

#### B. Gather Peer Financial Data

**For each comparable, gather:**
- Current stock price
- Shares outstanding (diluted)
- Market capitalization
- Total debt and cash (for EV calculation)
- Enterprise value
- LTM (Last Twelve Months) financials:
  - Revenue
  - EBITDA
  - EBIT
  - Net Income
- NTM (Next Twelve Months) estimates only if user-provided or returned by an explicitly configured, authorized capability with an as-of date; otherwise mark `UNSOURCED` / `NOT_CONFIGURED`
- Revenue growth rate
- EBITDA margin

**Data sources:**
- Use only `finance_data_query` when the exact tool/source and relevant capability are explicitly available, configured, and authorized, or user-provided financial files.
- Do not use raw MCP, SEC/foreign filing workflows, web search/fetch, guessed vendors, or credentials.
- Record source/file, date, period, currency/unit, and provenance. Mark unavailable actuals, consensus, share prices, or peer values `UNSOURCED` / `NOT_CONFIGURED`; omit dependent valuations.

#### C. Calculate Valuation Multiples

**For each peer, calculate:**
```
EV/Revenue (LTM) = Enterprise Value / LTM Revenue
EV/Revenue (NTM) = Enterprise Value / NTM Revenue (est.)
EV/EBITDA (LTM) = Enterprise Value / LTM EBITDA
EV/EBITDA (NTM) = Enterprise Value / NTM EBITDA (est.)
P/E (NTM) = Market Cap / NTM Net Income (est.)
```

#### D. Create Comparable Companies Table (MANDATORY FORMAT)

```
COMPARABLE COMPANIES ANALYSIS

Company      Ticker  Mkt Cap  EV/Rev  EV/Rev  EV/EBITDA  EV/EBITDA  P/E   Rev     EBITDA
                     ([source currency] B)     LTM     NTM     LTM        NTM        NTM   Growth  Margin
Peer A       PRA     45.2     3.5x    3.2x    15.2x      13.8x      25x   18%     23%
Peer B       PRB     32.8     3.2x    2.9x    14.1x      12.5x      22x   15%     23%
Peer C       PRC     28.5     2.8x    2.6x    12.8x      11.2x      20x   12%     22%
Peer D       PRD     52.1     4.1x    3.7x    17.5x      15.2x      29x   22%     23%
Peer E       PRE     38.9     3.6x    3.3x    15.8x      14.1x      25x   17%     23%
Peer F       PRF     41.2     3.7x    3.4x    16.1x      13.9x      26x   19%     23%
Peer G       PRG     35.5     3.3x    3.0x    14.5x      12.8x      23x   16%     22%

[Target]     TRGT    38.0     3.4x    3.1x    14.8x      13.0x      24x   17%     23%

STATISTICAL SUMMARY
Maximum              52.1     4.1x    3.7x    17.5x      15.2x      29x   22%     23%
75th Percentile      45.2     3.7x    3.4x    16.1x      14.1x      26x   19%     23%
Median               38.9     3.5x    3.2x    15.2x      13.8x      25x   17%     23%
25th Percentile      32.8     3.2x    2.9x    14.1x      12.5x      22x   15%     22%
Minimum              28.5     2.8x    2.6x    12.8x      11.2x      20x   12%     22%

Note: Market inputs as of [date] only when source metadata supports it. LTM = Last Twelve Months. NTM = Next Twelve Months.
Source: [authorized query result or user-provided file]; include period, currency/unit, and provenance. Do not infer consensus.
```

When the verified peer set is large enough for a meaningful distribution, include the maximum, quartiles, median, and minimum; otherwise report the individual supported observations and explain why a summary statistic is not reliable.

#### E. Apply Multiples to Target Company

**Choose primary multiple (typically EV/EBITDA for mature companies):**

```
Target Company NTM EBITDA = [source currency] 550M (from financial model)

Apply Median Peer Multiple:
Peer Median EV/EBITDA (NTM) = 13.8x
Implied EV = [source currency] 550M × 13.8x = [source currency] 7,590M

Apply 25th Percentile (Conservative):
25th Percentile EV/EBITDA (NTM) = 12.5x
Implied EV = [source currency] 550M × 12.5x = [source currency] 6,875M

Apply 75th Percentile (Optimistic):
75th Percentile EV/EBITDA (NTM) = 14.1x
Implied EV = [source currency] 550M × 14.1x = [source currency] 7,755M

Valuation Range (Comps): [source currency] 6,875M - [source currency] 7,755M
Midpoint: [source currency] 7,315M

Convert to Equity Value:
Implied EV (Median)        [source currency] 7,590M
- Net Debt                 ([source currency] 450M)
= Implied Equity Value     [source currency] 7,140M

Shares Outstanding         100M
Implied Price/Share        [source currency] 71.40
```

**Justify Premium/Discount:**
- Target is growing 17% vs. peer median 17% → In-line
- Target EBITDA margin 23% vs. peer median 23% → In-line
- Target market position → [Justify premium/discount]
- **Conclusion**: Apply median multiple (no adjustment)

### Step 4: Precedent Transactions (Optional)

**Note**: Only if M&A is relevant for this sector/company.

#### A. Identify Relevant Transactions

Use only transaction records in user-provided files or returned by an explicitly configured and authorized capability. Include only disclosed, date-stamped deals with sufficient target/acquirer and valuation detail; do not browse/search for deals or force a minimum count. If none are supported, mark precedent transactions `UNSOURCED` / `NOT_CONFIGURED` and omit this method.

**Example:**
```
PRECEDENT TRANSACTIONS ANALYSIS

Date     Target        Acquirer      Deal     EV/Rev  EV/EBITDA  Premium  Rationale
                                    Value([source currency] B)  LTM     LTM
Q1 2024  Comp A       Strategic      [source currency] 5.2B    4.2x    16.5x      35%      Consolidation
Q3 2023  Comp B       PE Firm        [source currency] 3.8B    3.8x    14.2x      28%      Platform
Q4 2023  Comp C       Strategic      [source currency] 4.5B    4.0x    15.8x      32%      Geographic
Q2 2023  Comp D       Strategic      [source currency] 6.1B    4.5x    17.2x      38%      Strategic fit
Q1 2023  Comp E       PE Firm        [source currency] 3.2B    3.5x    13.5x      25%      Carve-out

Median                                        4.0x    15.8x      32%

Source: [user-provided or explicitly authorized transaction source]; otherwise mark precedent transactions `UNSOURCED` / `NOT_CONFIGURED`.
```

#### B. Apply to Target Company

```
Target Company LTM EBITDA = [source currency] 500M
Precedent Median EV/EBITDA (LTM) = 15.8x

Implied EV (Precedent) = [source currency] 500M × 15.8x = [source currency] 7,900M

Do not apply a generic control premium or synergy uplift; use transaction-specific evidence if available and explain the basis.
```

### Step 5: Valuation Reconciliation

#### A. Create Valuation Summary Table

```
VALUATION SUMMARY

Method                  Low     Base    High    Weight  Weighted Value
DCF Analysis            [source currency] 42     [source currency] 46     [source currency] 51     50%     [source currency] 23.00
Trading Comps (NTM)     [source currency] 64     [source currency] 71     [source currency] 78     40%     [source currency] 28.40
Precedent Trans.        [source currency] 70     [source currency] 79     [source currency] 88     10%     [source currency] 7.90
                                                        -------
Weighted Average Target                         100%    [source currency] 59.30

Rounded Price Target: [source currency] 59.00

Current Price (as of [Date]):    [source currency] 42.00
Upside to Target:                40% ([source currency] 59.00 / [source currency] 42.00 - 1)
```

#### B. Determine Weighting Rationale

**Typical Weighting:**
- DCF: 40-60% (higher when forecasts reliable)
- Trading Comps: 25-40% (reflects market sentiment)
- Precedent Trans: 10-25% (lower unless M&A likely)

**For this example:**
- DCF 50%: High confidence in projections
- Comps 40%: Robust peer set
- Precedent 10%: M&A unlikely near-term

#### C. Create Valuation Football Field Chart

```
VALUATION FOOTBALL FIELD

Method                  Low ◄────────── Range ──────────► High

DCF Analysis            [source currency] 42 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ [source currency] 51

Trading Comps (NTM)     [source currency] 64 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ [source currency] 78

Precedent Trans.        [source currency] 70 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ [source currency] 88
                                          ↑
                                    Current: [source currency] 42
─────────────────────────────────────────────────────────
Valuation Range         [source currency] 42                          [source currency] 88
Price Target: [source currency] 59 (weighted average)

Color code:
- DCF: Blue
- Trading Comps: Green
- Precedent Trans: Orange
- Vertical line at current price: Red dashed
- Vertical line at target: Black solid
```

#### D. Scenario-Based Valuations

```
VALUATION BY SCENARIO

Scenario    Probability  Revenue  EBITDA    DCF      Comps    Weighted
                        CAGR     Margin    Value    Multiple  Avg
Bear Case   20%         18%      28%       [source currency] 38      11.5x     [source currency] 42
Base Case   60%         25%      32%       [source currency] 46      13.8x     [source currency] 59
Bull Case   20%         32%      36%       [source currency] 58      16.0x     [source currency] 82

Expected Value (probability-weighted): [source currency] 59
```

### Step 6: Final Price Target & Recommendation

```
═══════════════════════════════════════════════════════════
INVESTMENT RECOMMENDATION
═══════════════════════════════════════════════════════════

Current Price:          [source currency] 42.00 (as of [Date])
Price Target:           [source currency] 59.00 (12-month)
Upside/(Downside):      +40.5%

Rating:                 BUY / OUTPERFORM

Valuation Methodology:  Based on weighted average of DCF (50%),
                       trading comparables (40%), and precedent
                       transactions (10%).

Time Horizon:          12 months

───────────────────────────────────────────────────────────
KEY INVESTMENT CATALYSTS
───────────────────────────────────────────────────────────

1. New Product Launch (Q2 2025)
   - Expected to drive 15-20% revenue acceleration
   - Already seeing strong pre-orders

2. Margin Expansion (FY2025-2026)
   - Operating leverage from scale
   - Path to 35% EBITDA margin (from current 28%)

3. Market Share Gains (Ongoing)
   - Taking share from legacy competitors
   - Net Promoter Score improvement

4. International Expansion (H2 2025)
   - Entry into European markets
   - Potential [source currency] 200M incremental revenue opportunity

5. Potential M&A Target (12-18 months)
   - Strategic fit for larger players
   - Precedent transactions suggest 30-40% premium

───────────────────────────────────────────────────────────
KEY RISKS TO PRICE TARGET
───────────────────────────────────────────────────────────

Downside Risks:
1. Competitive Pressure (High probability, -15% impact)
   - New entrant launched competing product
   - Could pressure pricing and market share

2. Execution Risk (Medium probability, -10% impact)
   - New product launch delays or underperformance
   - Management turnover

3. Macro Slowdown (Medium probability, -20% impact)
   - Economic recession would impact customer spending
   - Operating leverage would reverse

4. Regulatory Risk (Low probability, -25% impact)
   - Potential new regulations in key market
   - Would increase compliance costs

Upside Risks:
1. M&A Bid (Low probability, +35% impact)
   - Strategic acquirer pays control premium

2. Beat-and-Raise (Medium probability, +10% impact)
   - Consistent outperformance vs. estimates

═══════════════════════════════════════════════════════════
```

---

## Quality Standards

### DCF Quality Checks
- [ ] WACC properly calculated with documented components
- [ ] Terminal value reasonable (< 70% of total enterprise value)
- [ ] Sensitivity analysis covers realistic ranges (±200-300bps for WACC, ±100bps for terminal growth)
- [ ] Unlevered FCF properly calculated from EBIT
- [ ] Enterprise to equity value bridge correct
- [ ] Share count is diluted shares, not basic

### Comparables Quality Checks
- [ ] Peer set is drawn from authorized, source-supported data and selection rationale is documented
- [ ] Peer observations are sufficient for the analysis claimed; do not force a count or unreliable summary statistics
- [ ] Multiples are appropriate to the issuer's economics and financial definitions
- [ ] Premium/discount rationale is supported, not assumed
- [ ] Source dates, periods, currencies, units, and provenance are recorded

### Overall Valuation Quality Checks
- [ ] Both DCF and trading-comps methods are supported for a complete valuation; if either is unavailable, mark the analysis incomplete and block a full-run completion
- [ ] Any weighting is explained; do not use fixed weights by default
- [ ] Valuation range and scenarios are shown only when their inputs support them
- [ ] Sanity checks are run where the required reference data exists; unavailable checks are disclosed
- [ ] All assumptions are documented with rationale and dates

---

## Sanity Checks

**Always perform these validation checks:**

1. **Historical Multiple Check**
   - Is implied multiple in line with company's historical trading range?
   - If not, explain why

2. **Peer Comparison**
   - Is premium/discount vs. peers justified by fundamentals?
   - Check: growth, margins, market position

3. **Implied Growth Check**
   - What growth is market pricing in at current price?
   - Is that reasonable given company trajectory?

4. **Market Cap Reasonableness**
   - Does total market cap make sense given company size and peers?
   - Would company be too large/small relative to industry?

5. **Terminal Value Check**
   - Is terminal value < 60-70% of total enterprise value?
   - If > 70%, projections may not be long enough

6. **Discount-Rate Reasonableness**
   - Recheck each sourced/user-provided component, date, currency, and market basis.
   - Do not apply a generic WACC range; flag an unexplained result rather than overriding the inputs.

7. **Implied Returns Check**
   - Calculate only when a verified current price and target exist; otherwise mark unavailable.
   - Do not assign a recommendation rating without the approved methodology and supporting inputs.

---

## Output Files

Create the following deliverables:

### 1. Valuation Analysis Document
**File**: `[Company]_Valuation_Analysis_[Date].md` (written analysis)

**Contents** (length follows supported analysis):
- Summary and limitations; include a target/recommendation only if supported
- DCF and sensitivity table when inputs permit
- Comparable-company analysis with source-supported observations
- Precedent transactions only when authorized inputs exist
- Valuation reconciliation, assumptions, and checks
- Catalysts/risks only when supported by disclosures

### 2. Excel Valuation Tabs
**Add to Task 2's financial model file:** `[Company]_Financial_Model_[Date].xlsx`

**IMPORTANT**: Do NOT create a separate Excel file. Add these tabs to the existing financial model from Task 2. This keeps all quantitative data in one place.

**Tabs to add:**
- DCF tab with full calculations
- Sensitivity analysis tab
- Comps tab with peer data
- Precedent transactions tab (if applicable)
- Valuation summary tab

---

## Success Criteria

A successful valuation analysis must:
1. Use both DCF and trading-comps for a complete valuation, with each method backed by authorized data and explicit assumptions.
2. Include sensitivity analysis and a valuation range only where the required inputs are complete.
3. Avoid unreliable peer statistics, hardcoded weights, or generic discount-rate assumptions.
4. Document source, date, period, currency/unit, and methodology for all inputs.
5. Run feasible sanity checks and disclose any unavailable checks.
6. State a price target/rating only when all supporting inputs and the applicable methodology are verified.
7. Be auditable and transparent; otherwise label the output incomplete and do not mark the five-task run complete.

---

## Next Steps

After completing Task 3, the valuation analysis will be used for:
- **Task 4 (Charts)**: Create DCF sensitivity heatmaps, valuation football field, scenario comparison charts
- **Task 5 (Report Assembly)**: Integrate valuation analysis into final report

The price target and recommendation are the foundation of the final investment recommendation in the equity research report.
