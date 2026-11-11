# Task 5: Report Assembly - Detailed Workflow

This document provides step-by-step instructions for executing Task 5 (Report Assembly) of the initiating-coverage skill.

## Task Overview

**Purpose**: Assemble the required prior-task artifacts into an auditable internal DOCX research draft.

**Prerequisites**: Verify that Tasks 1–4 produced the required, validated artifacts for the requested scope, and that an authorized DOCX/XLSX read/export workflow is available.

**If a required artifact or Office capability is missing**: Do not fabricate, substitute, or claim completion. In single-task mode, explain the missing prerequisite and ask whether to complete it first. In an explicitly authorized unattended full run, return `BLOCKED` with the exact missing task/input/capability and stop without asking. No downstream placeholder DOCX is created.

**Output**: Source-grounded DOCX internal research draft. Its length, tables, and charts follow verified source coverage; no page, word, chart, or table minimum applies. This workflow does not authorize publication, distribution, client communication, trading, or compliance approval.

---

## Quality and Source Integrity

- Include the material content required by the user's scope and supported by the prior artifacts; do not copy errors or unsupported statements.
- Preserve provenance, period, currency, units, actual/estimate labels, model assumptions, and limitations.
- Include only useful source-supported tables and charts; never pad the report with redundant material.
- Do not imitate or imply endorsement by a named research firm.
- Label the result as an internal draft. Publication readiness requires separate review and authorization.
- If a source gap prevents a required section, disclose it; if the gap makes the requested report incomplete, return `BLOCKED` rather than a fake completed report.

---

## Input Verification (CRITICAL)

Before assembly, verify that the Task 1 research, Task 2 workbook, Task 3 valuation, and Task 4 chart package exist, are accessible, and agree on issuer, periods, currency, units, assumptions, and provenance. Confirm the DOCX/XLSX workflow is actually available and validated.

- Do not require unsupported management bios, peer counts, market sizing, or minimum rows.
- A complete valuation requires supported DCF and trading-comps methods; a target/rating is included only when all required inputs are verified.
- Include only charts available from supported inputs; verify each file and its index.
- A missing optional input omits the dependent content and is disclosed. A missing required artifact or essential input blocks the full report.

If verification fails, single-task mode may ask the user whether to complete the missing prerequisite. In an explicit unattended full run, return `BLOCKED` with the exact missing item and stop without asking.

---

## Report Specifications

### Length and Content Requirements
- Page and word count follow verified source coverage and requested scope; no minimum applies.
- Embed only source-supported charts and include only useful tables; no minimum count or page density.
- Section depth follows the available Task 1–4 evidence. Do not pad assumptions, scenarios, management biographies, or market analysis to reach a target.
- Required content gaps are disclosed and may block completion; optional unsupported material is omitted.

---

## Report Structure

### Page 1: Investment Summary (CRITICAL PAGE)

**This is the most important page. Must have:**

1. **"INITIATING COVERAGE" header** (NOT "Company Update")
2. **Thesis-focused title** (e.g., "AI Platform Leader Positioned for 40% CAGR")
3. **Rating box** with:
   - Rating (BUY/OUTPERFORM/HOLD/UNDERPERFORM/SELL)
   - Current price
   - Target price
   - 52-week range
   - Market cap
   - Enterprise value
4. **Research analyst information** with credentials
5. **Stock price performance chart** (Figure 1)
6. **3-4 detailed investment bullets** with ■ character
   - Each bullet has **bold topic header** + 3-5 sentences
   - Lead with key numbers
7. **Financial summary table** (2-3 years historical + 2-3 years projected)
   - Years noted as "A" for actual, "E" for estimate

**Bullet Format Example:**
```
■ **[Evidence-backed mainland A-share issuer thesis].**
State competitive position, market size, growth, and customer metrics only when documented in user-provided material or an explicitly available, configured, and authorized `finance_data_query` result. Record source, date, period, units, and methodology. Mark unavailable market context `UNSOURCED` / `NOT_CONFIGURED`; do not invent a TAM or company position.
[Add only issuer facts, customer mix, competitive advantages, and management statements documented in available source materials; otherwise mark them `UNSOURCED` / `NOT_CONFIGURED`.]
```

### Pages 2-5: Investment Thesis & Risks

**Investment Thesis (800-1,200 words)**
- 3-5 key thesis pillars
- Each pillar: 200-300 words
- Lead with key statistic
- Quantify financial impact
- Include timeline

**Risk Assessment (600-900 words)**
- 8-12 identified risks
- Organized by category:
  - Company-specific risks (4-6)
  - Industry/market risks (3-4)
  - Financial risks (2-3)
  - Macroeconomic risks (2-3)
- Each risk: 50-100 word description

### Pages 6-17: Company 101

**Company Description (800-1,200 words)**
- What the company does (plain English)
- Business model and monetization
- Geographic presence
- Scale metrics

**Company History (800-1,200 words)**
- Founding story
- Timeline of major milestones
- Strategic pivots
- Recent developments

**Management Team (1,000-1,400 words)**
- Management/governance facts only where documented; no biography count or length minimum
- Include: role, background, accomplishments, education
- Governance structure

**Products & Services (700-1,000 words)**
- Detailed product portfolio
- Features and differentiation
- Target customers
- Pricing models

**Customers & Go-to-Market (500-700 words)**
- Customer segments
- Distribution channels
- Sales strategy
- Key partnerships

**Industry Overview (800-1,200 words)**
- Industry definition and scope
- Market size and growth
- Key trends
- Regulatory environment

**Competitive Landscape (700-1,000 words)**
- 5-10 key competitors
- Market positioning
- Competitive advantages
- Market share analysis

**TAM Analysis (500-700 words)**
- Total addressable market sizing
- Market growth projections
- Company's serviceable market

### Pages 18-30: Financial Analysis

**Historical Financial Analysis (1,200-1,800 words)**
- Revenue trends and drivers
- Margin evolution
- Cash flow analysis
- Key metrics trajectory
- Historical context

**Projection Assumptions (source-supported scope)** ⭐ CRITICAL

**MUST be extremely detailed. Structure:**

**A. Revenue by Product Assumptions (1,000-1,500 words)**

For EACH major product category:
```
[Product Category A] Revenue Assumptions

We project [Product A] revenue to grow from [source currency] XXM in 2024A to [source currency] XXM in 2029E,
representing a XX% CAGR. This growth is driven by:

1. [Driver 1 with specific quantification]
   - Specific metric: from XX to XX
   - Timeline: achieving YY by 2026E
   - Basis: [source or rationale]

2. [Driver 2 with specific quantification]
3. [Driver 3 with specific quantification]
[... 8-12 detailed points total for this product ...]

Specific assumptions by year:
- 2025E: XX% growth driven by [specific factors]
- 2026E: XX% growth as [specific factors]
- 2027-2029E: XX% CAGR as [longer-term factors]

Key risks to these assumptions include [specific risks].
```

**Repeat for EACH major product category.**

**B. Geographic Revenue Assumptions (500-800 words)**

For EACH major region:
```
[Region] Revenue Assumptions

We project [Region] revenue to grow XX% CAGR from 2024-2029E, reaching [source currency] XXM, driven by:

1. [Market dynamic with quantification]
2. [Distribution expansion with specifics]
3. [Competitive positioning]
[... 6-8 detailed points total for this region ...]
```

**Repeat for EACH major geographic region.**

**C. Other Key Assumptions (500-700 words)**
- Gross margin evolution (with specific drivers and bridge)
- Operating expense assumptions (R&D, S&M, G&A as % of revenue)
- Working capital assumptions (DSO, DIO, DPO with specific days)
- CapEx as % of sales (with justification)
- Tax rate assumptions

**Scenario Analysis (source-supported scope)** ⭐ CRITICAL

**MUST have specific parameters for each scenario. Structure:**

**Bull Case (500-700 words)**
```
Bull Case: [Title describing key optimistic scenario]

Probability: XX%

Key Assumptions:
- Revenue CAGR (2024-2029E): XX% (vs. XX% base case)
- 2029E Revenue: [source currency] X,XXXm (vs. [source currency] X,XXXm base)
- 2029E EBITDA Margin: XX% (vs. XX% base)
- Key product growth: XX% CAGR (vs. XX% base)
- Geographic expansion: [specific milestones and timeline]
- Market share: XX% by 2029E (vs. XX% base)

Catalysts Required for Bull Case:
1. [Specific catalyst] - Expected timing: [date/quarter]
2. [Specific catalyst] - Expected timing: [date/quarter]
3. [Specific catalyst] - Expected timing: [date/quarter]

Detailed Rationale:
[200-300 words explaining what needs to happen for bull case to materialize.
Be specific about product launches, market conditions, competitive dynamics, etc.]

Valuation Implications:
- DCF Value: [source currency] XX per share (XX% upside from current)
- Trading Comps: XX.Xx EV/EBITDA implies [source currency] XX per share
- Bull Case Target: [source currency] XX per share
```

**Base Case (300-500 words)**
```
Base Case: [Title describing most likely scenario]

Probability: XX%

Key Assumptions:
[Similar structure to Bull Case with base assumptions]

Rationale:
[Explain why this is most likely scenario]

Valuation:
- DCF Value: [source currency] XX per share
- Trading Comps: [source currency] XX per share
- Base Case Target: [source currency] XX per share (weighted average)
```

**Bear Case (500-700 words)**
```
Bear Case: [Title describing downside scenario]

Probability: XX%

Key Assumptions:
[Similar structure with downside parameters]

Downside Triggers:
1. [Specific risk event] - Likelihood: [%]
2. [Specific risk event] - Likelihood: [%]
3. [Specific risk event] - Likelihood: [%]

Rationale:
[200-300 words on what would cause bear case]

Valuation Implications:
- DCF Value: [source currency] XX per share (XX% downside from current)
- Trading Comps: [source currency] XX per share
- Bear Case Target: [source currency] XX per share
```

**Scenario Comparison (200-300 words)**
- Comprehensive comparison table with key metrics
- Analysis of probability-weighted outcomes
- Risk/reward assessment
- Path dependency discussion

**Growth Drivers (800-1,200 words)**
- 3-5 key growth drivers
- Each quantified with specific opportunity size
- Timeline and milestones
- Supporting data from model

### Pages 31-40: Valuation Analysis

**Valuation Methodology (800-1,200 words)**

**DCF Analysis (source-supported detail)**
- Methodology explanation
- Key assumptions:
  - WACC: X.X% (calculation breakdown)
  - Terminal growth: X.X% (rationale)
  - Terminal margin: XX% (justification)
- Sensitivity analysis discussion
- DCF value: [source currency] XX per share

**Comparable Companies (source-supported detail)**
- Peer selection rationale (why these 5-10 companies)
- Statistical summary (max/75th/median/25th/min)
- Multiple selection (why EV/EBITDA vs. EV/Revenue vs. P/E)
- Premium/discount justification (why target deserves premium/discount)
- Comparable companies value: [source currency] XX per share

**Precedent Transactions (200-300 words, if applicable)**
- Transaction relevance
- Control premium analysis
- Precedent transactions value: [source currency] XX per share

**Valuation Reconciliation (200-300 words)**
- Weighting rationale (e.g., DCF 50%, Comps 40%, Precedent 10%)
- Weighted average calculation
- Valuation range (low/base/high)
- Final price target: [source currency] XX

**Price Target & Recommendation (300-500 words)**
- Final recommendation (BUY/OUTPERFORM/HOLD/UNDERPERFORM/SELL)
- Price target: [source currency] XX (XX% upside from current [source currency] XX)
- Time horizon: 12 months
- Key catalysts (3-5 with specific timeframes)
- Key risks to price target (3-5 with impact quantification)

### Pages 41-50: Appendices

**Data Sources & References**
- List source/tool or user-file name, document/query date, reporting period, currency/unit, and provenance
- Organize by category: authorized query results, user-provided issuer materials, user-provided industry/peer files
- Do not use SEC/foreign-filing workflows, web research, or external news lookups
- Retain URLs only when present in supplied material or authorized result; no hyperlinks are required or tested

**Detailed Financial Model Assumptions**
- Comprehensive assumptions detail
- Calculation methodologies
- Data sources for historical figures

**Additional Supporting Tables**
- Extended financial projections
- Detailed comparable companies data
- Sensitivity analyses

---

## Report Assembly Philosophy

**CRITICAL PRINCIPLE 1**: A good equity research report is **text-dense with lots of illustrating images**.

**Target density**: no fixed page density
- Every page should have BOTH text AND visuals
- Charts should be interspersed throughout text, not grouped
- Use source-supported charts near relevant discussion; no chart-per-page minimum.
- Tables should break up large text blocks

**CRITICAL PRINCIPLE 2**: Use Claude's DOCX and XLSX skills to programmatically create the report.

**REQUIRED TOOLS** (Claude has built-in skills for these):
- **DOCX skill** - To create and manipulate Word documents
  - Read Task 1 .md file → Convert to Word formatting
  - Insert images from Task 4 chart files
  - Create tables
  - Format text, headers, footers, page numbers
  - Add hyperlinks
- **XLSX skill** - To read data from Excel files
  - Extract tables from Task 2 financial model
  - Read Task 3 valuation tabs
  - Pull historical financials from Task 1
- **Direct file operations** - Work with actual files
  - Read: `[Company]_Research_Document_[Date].md`
  - Read: `[Company]_Financial_Model_[Date].xlsx`
  - Read: `chart_01.png`, `chart_02.png`, etc.
  - Write: `[Company]_Initiation_Report_[Date].docx`

**DO NOT**: Manually copy/paste or describe what should be done
**DO**: Use Claude's DOCX and XLSX skills to open files, extract data, and create the DOCX report

**Content Reuse Strategy**:
- **Task 1 content (40-50% of report)**: Read .md file → Convert to Word format → Add charts
- **Task 2/3 data (30-40% of report)**: Read .xlsx file → Extract tables → Write interpretation
- **Original writing (10-20% of report)**: Investment thesis, projection assumptions, scenario analysis

**This approach**:
- Maximizes efficiency (no rewriting source-supported research content that are already good)
- Maintains quality (Task 1 content is substantive, professional analysis)
- Focuses effort on value-add (quantitative interpretation and investment thesis)
- Uses actual files programmatically (not manual work)

---

## Step-by-Step Report Assembly Workflow

### Step 1: Organize All Inputs and Verify Files

**Verify all input files exist:**

Use Claude's file operations to check:
- `[Company]_Research_Document_[Date].md` (Task 1)
- `[Company]_Historical_Financials_[Date].xlsx` (Task 1)
- `[Company]_Financial_Model_[Date].xlsx` (Task 2 with Task 3 tabs)
- `[Company]_Valuation_Analysis_[Date].md` (Task 3)
- `[Company]_Charts_[Date].zip` (Task 4) - **Extract this first**

**Step 1a: Extract Charts from Zip File**

Before proceeding, extract all chart files from the Task 4 zip:
- Locate `[Company]_Charts_[Date].zip`
- Extract all contents to a working directory (e.g., `task4_charts/`)
- Verify all available, source-supported chart files were extracted; do not require a fixed count
- Verify chart_index.txt is present

**Expected folder structure after extraction:**
```
[Company]_Report_Working/
├── [Company]_Research_Document_[Date].md
├── [Company]_Historical_Financials_[Date].xlsx
├── [Company]_Financial_Model_[Date].xlsx (includes Task 3 valuation tabs)
│   ├── [Task 2 tabs: Revenue Model, Income Statement, Scenarios, etc.]
│   └── [Task 3 tabs: DCF, Sensitivity, Comps, Valuation Summary]
├── [Company]_Valuation_Analysis_[Date].md
├── [Company]_Charts_[Date].zip
├── task4_charts/ (extracted from zip)
│   ├── chart_01_stock_price.png
│   ├── chart_02_revenue_growth.png
│   ├── chart_03_revenue_by_product.png ⭐
│   ├── chart_04_revenue_by_geography.png ⭐
│   ├── ... (21-31 more charts)
│   ├── chart_28_dcf_sensitivity.png ⭐
│   ├── chart_32_valuation_football_field.png ⭐
│   └── chart_index.txt
└── sources_and_provenance.md
```

**Open and inspect files using Claude skills:**

1. **Read Task 1 markdown file** - Use Read tool to view content
2. **Open Task 2/3 Excel file** - Use XLSX skill to inspect tabs:
   - Verify required tabs exist: Revenue Model, Income Statement, Scenarios, DCF, Sensitivity Analysis, Comparable Companies
3. **Read Task 3 markdown file** - Use Read tool to view valuation analysis
4. **Check chart files** - Verify included charts are source-supported; no minimum count

**Note**: Task 2's financial model file now contains both the original modeling tabs (from Task 2) AND the valuation tabs (added by Task 3). This single Excel file contains all quantitative data needed for report assembly.

### Step 2: Extract Tables from Excel Using XLSX Skill

**Use Claude's XLSX skill to extract data from Excel files:**

#### Table 1: Page 1 Summary Financials

Use XLSX skill to:
1. Open `[Company]_Financial_Model_[Date].xlsx`
2. Read from `Income Statement` tab
3. Extract key rows: Revenue, Gross Profit, EBITDA, Net Income, EPS, FCF
4. Extract years: 2022A, 2023A, 2024A, 2025E, 2026E, 2027E
5. Create summary table with growth rates and margins

#### Table 2: Full Income Statement (40-50 line items)

Use XLSX skill to:
1. Open `[Company]_Financial_Model_[Date].xlsx`
2. Read entire `Income Statement` tab
3. Extract all line items (40-50 rows)
4. Extract columns for historical (2020A-2024A) + projected years (2025E-2029E)
5. Include all margins and growth rates

#### Table 3: Revenue by Product (20-30 rows)

Use XLSX skill to:
1. Open `[Company]_Financial_Model_[Date].xlsx`
2. Read from `Revenue Model` tab
3. Navigate to product section (typically starts ~row 5)
4. Extract 20-30 rows showing each product category
5. Include columns: Product name, historical years, projected years, % of Total, YoY Growth

#### Table 4: Revenue by Geography (15-20 rows)

Use XLSX skill to:
1. Open `[Company]_Financial_Model_[Date].xlsx`
2. Read from `Revenue Model` tab
3. Navigate to geography section (typically starts ~row 40)
4. Extract 15-20 rows showing each geographic region
5. Include columns: Region, historical years, projected years, % of Total, YoY Growth

#### Table 5: Comparable Companies
**Extract from:** Task 3 valuation tabs in Task 2's financial model (`Comparable Companies` tab)

Use XLSX skill to:
1. Open `[Company]_Financial_Model_[Date].xlsx`
2. Read from `Comparable Companies` tab (added by Task 3)
3. Extract full table with company names as row headers
4. **CRITICAL**: Verify statistical summary rows are present at bottom:
   - Maximum
   - 75th Percentile
   - Median
   - 25th Percentile
   - Minimum
5. If statistical summary is missing, report ERROR

**Expected format:**
```
Company      Ticker  Mkt Cap  EV/Rev  EV/Rev  EV/EBITDA  EV/EBITDA  P/E   Rev     EBITDA
                     ([source currency] B)     LTM     NTM     LTM        NTM        NTM   Growth  Margin
[5-10 peers plus target, then statistical summary]
```

#### Additional Tables (7-15 more)
**Extract from Task 2 financial model (with Task 3 tabs):**

Use XLSX skill to extract these tables:

**DCF Assumptions Table** (Task 3 `DCF` tab)
- Open `[Company]_Financial_Model_[Date].xlsx`
- Read from DCF tab
- Extract columns A-C (Assumption, Value, Source)
- Extract first 20 rows

**DCF Sensitivity Matrix** (Task 3 `Sensitivity Analysis` tab)
- Read from Sensitivity Analysis tab
- Extract full sensitivity matrix
- WACC values as row headers
- Terminal growth rates as column headers

**Scenario Comparison Table** (Task 2 `Scenarios` tab)
- Read from Scenarios tab
- Extract full scenario table
- Metrics as row headers (Revenue, EBITDA, Margins, etc.)
- Columns: Bull, Base, Bear

**Other supporting tables to extract:**
- Cash flow statement
- Balance sheet highlights
- Key metrics dashboard
- Margin bridge
- Working capital schedule
- TAM sizing table
- Market share table

**Create all source-supported tables with proper formatting.**

### Step 3: Write Quantitative Sections

These sections interpret the financial model.

**Write in this order:**

#### A. Financial Analysis (1,200-1,800 words)
- Analyze historical performance from model
- Discuss trends in revenue, margins, cash flow
- Reference specific charts and tables
- Lead with numbers

#### B. Projection Assumptions (source-supported scope) ⭐ CRITICAL
- Follow detailed structure from Report Structure section above
- Must be product-by-product (8-12 points per product)
- Must be region-by-region (6-8 points per region)
- Must include margin, opex, capex, working capital assumptions
- **This section separates amateur from professional analysis**

#### C. Scenario Analysis (source-supported scope) ⭐ CRITICAL
- Follow detailed structure from Report Structure section above
- Bull case: specific parameters, catalysts, probability, valuation
- Base case: most likely scenario with rationale
- Bear case: downside triggers and parameters
- Comparison table and analysis
- **Must have specific quantified parameters for each scenario**

#### D. Growth Drivers (800-1,200 words)
- 3-5 key drivers with quantified opportunities
- Timeline and milestones
- Evidence from model

#### E. Valuation Methodology (800-1,200 words)
- DCF explanation with assumptions
- Comparables rationale
- Precedent transactions (if applicable)
- Reconciliation and weighting
- Price target derivation

### Step 4: Write Synthesis Sections

**Write in this order:**

#### A. Investment Thesis (800-1,200 words)
- 3-5 key pillars
- Each pillar: 200-300 words
- Lead with key statistic
- Quantify financial impact
- Include timeline

#### B. Risk Assessment (600-900 words)
- Pull from Task 1 research document
- Organize into 4 categories
- material risks supported by sources; no count minimum
- Each risk: 50-100 words

#### C. Price Target & Recommendation (300-500 words)
- Final recommendation
- Price target with upside %
- Key catalysts with timeframes
- Key risks to target

#### D. Investment Summary (500-700 words) - WRITE LAST
- Page 1 content
- 3-4 detailed bullets with bold headers
- Complete synthesis of all findings
- **Write this section LAST after full analysis complete**

### Step 5: Integrate Company Content from Task 1

**CRITICAL INSTRUCTION**: Use Task 1 research document almost verbatim. DO NOT rewrite.

**The company research from Task 1 (source-supported research content) is already professional, substantive analysis. Objective:**
1. **Reformat for Word** - Convert markdown to DOCX formatting
2. **Insert charts inline** - Add relevant charts from Task 4 throughout the text
3. **Minor style adjustments** - Ensure consistent formatting with rest of report

**Extract these sections from Task 1 research document:**
- Company description (800-1,200 words) → **Use verbatim, insert company overview charts**
- Company history (800-1,200 words) → **Use verbatim, insert timeline chart**
- Management bios (1,000-1,400 words) → **Use verbatim, insert org chart if available**
- Products & services (700-1,000 words) → **Use verbatim, insert product portfolio charts**
- Customers & GTM (500-700 words) → **Use verbatim, insert customer segmentation charts**
- Industry overview (800-1,200 words) → **Use verbatim, insert market size evolution charts**
- Competitive landscape (700-1,000 words) → **Use verbatim, insert competitive positioning charts**
- TAM analysis (500-700 words) → **Use verbatim, insert TAM sizing charts**
- Risk assessment (600-900 words) → **Use verbatim, format as Investment Thesis & Risks section**

**Chart Integration Strategy:**
- Every 200-300 words of text → Insert 1 chart
- Company 101 section may include source-supported charts interspersed; no fixed chart count when source inputs are unavailable
- Place charts immediately after the paragraph that discusses the topic
- **Result**: Readable layout with no fixed page-density target

### Step 6: Assemble DOCX Report

**CRITICAL**: Create actual DOCX file, NOT markdown.

**Assembly Order (Most Efficient):**

#### Phase A: Create Structure & Add Page 1
1. Create DOCX document
2. Set up professional styling (fonts, headers, footers)
3. Create Page 1 - Investment Summary (write this LAST after all analysis complete)
4. Add Table of Contents placeholder

#### Phase B: Copy Task 1 Content + Insert Charts
**This is 40-50% of the report - mostly copy/paste + chart insertion**

Use Claude's DOCX skill to:

1. **Initialize new DOCX document**
   - Create new Word document
   - Set professional styling (fonts, margins)

2. **Read Task 1 markdown file**
   - Use Read tool: `[Company]_Research_Document_[Date].md`
   - Identify sections by markdown headers (## Section Title)

3. **Extract and convert each section from Task 1 to Word format:**

**SECTION 1: Investment Thesis & Risks**
- Add heading: 'Investment Thesis & Risks' (level 1)
- Extract 'Risk Assessment' section from Task 1 markdown
- Convert markdown formatting to Word formatting (remove ##, **, etc.)
- Add paragraphs to Word document (split by blank lines)
- Add new 'Investment Thesis' heading (level 2)
- Write new investment thesis content (800-1,200 words based on all analysis)

**SECTION 2: Company 101 (Pages 6-17)**
Copy each section from Task 1 verbatim with formatting conversion:

- **Company Overview**
  - Add heading: 'Company Overview' (level 1)
  - Extract 'Company Overview' section from Task 1
  - Convert to Word paragraphs
  - Insert chart: `task4_charts/chart_05_company_overview.png` (6 inches wide)

- **Company History**
  - Add heading: 'Company History' (level 1)
  - Extract 'Company History' section from Task 1
  - Convert to Word paragraphs
  - Insert chart: `task4_charts/chart_06_company_timeline.png` (6 inches wide)

- **Management Team**
  - Add heading: 'Management Team' (level 1)
  - Extract 'Management Team' section from Task 1
  - Convert to Word paragraphs
  - Insert chart: `task4_charts/chart_07_org_structure.png` (5 inches wide)

- **Products & Services**
  - Add heading: 'Products & Services' (level 1)
  - Extract 'Products & Services' section from Task 1
  - Add first paragraph
  - Insert chart: `task4_charts/chart_08_product_portfolio.png` (6 inches wide)
  - Add remaining paragraphs

- **Customers & Go-to-Market**
  - Add heading: 'Customers & Go-to-Market' (level 1)
  - Extract section from Task 1
  - Convert to Word paragraphs
  - Insert chart: `task4_charts/chart_09_customer_segments.png` (6 inches wide)

- **Industry Overview**
  - Add heading: 'Industry Overview' (level 1)
  - Extract section from Task 1
  - Add first paragraph
  - Insert chart: `task4_charts/chart_10_market_size_evolution.png` (6 inches wide)
  - Add remaining paragraphs
  - Insert chart: `task4_charts/chart_11_industry_trends.png` (6 inches wide)

- **Competitive Landscape**
  - Add heading: 'Competitive Landscape' (level 1)
  - Extract section from Task 1
  - Add first paragraph
  - Insert chart: `task4_charts/chart_16_competitive_positioning.png` (6 inches wide)
  - Add remaining paragraphs
  - Insert chart: `task4_charts/chart_17_market_share.png` (5 inches wide)

- **Market Opportunity**
  - Add heading: 'Market Opportunity' (level 1)
  - Extract 'Market Opportunity' section from Task 1
  - Convert to Word paragraphs
  - Insert chart: `task4_charts/chart_15_TAM_sizing.png` (6 inches wide)

**Result after Phase B**: Pages 6-17 complete (~12 pages, source-supported research content, 8-12 charts embedded)

**Key Point**: Use DOCX skill to READ from Task 1's .md file and INSERT actual image files. No manual copy/paste required.

#### Phase C: Add Financial Analysis with Data from Task 2
**This requires NEW WRITING interpreting quantitative data**

Use Claude's DOCX and XLSX skills to:

**SECTION 3: Financial Analysis (Pages 18-30)**

1. **Add section heading: 'Financial Analysis' (level 1)**

2. **Historical Financial Analysis (1,200-1,800 words) - NEW WRITING**
   - Add heading: 'Historical Performance' (level 2)
   - Use XLSX skill to open `[Company]_Financial_Model_[Date].xlsx`
   - Read `Income Statement` tab to extract historical data
   - Read `Revenue Model` tab to extract revenue trends
   - Calculate key metrics (e.g., Revenue CAGR from 2020-2024)
   - Write analytical paragraphs interpreting the trends (1,200-1,800 words)
   - Lead with specific numbers: "Revenue grew from [source currency] XXM in 2020 to [source currency] XXM in 2024, representing a XX% CAGR. This growth was driven by..."
   - Insert chart: `task4_charts/chart_02_revenue_growth_trajectory.png` (6 inches wide)

3. **Create Table: Full Income Statement**
   - Add heading: 'Historical Income Statement' (level 3)
   - Use XLSX skill to extract entire Income Statement tab (40-50 rows)
   - Create Word table with all columns (historical years 2020A-2024A + projected 2025E-2029E)
   - Include all line items: Revenue, COGS, Gross Profit, Operating Expenses, EBITDA, Net Income, etc.

4. **Add source-supported charts and tables for revenue breakdown only where data exists:**
   - Insert chart: `task4_charts/chart_03_revenue_by_product.png` (6.5 inches wide) ⭐ MANDATORY
   - **Create Table: Revenue by Product (20-30 rows)**
     - Use XLSX skill to extract from Revenue Model tab (product section, typically rows 5-35)
     - Create Word table showing each product category with historical and projected years
     - Include columns: Product name, historical years, projected years, % of Total, YoY Growth

   - Insert chart: `task4_charts/chart_04_revenue_by_geography.png` (6.5 inches wide) ⭐ MANDATORY
   - **Create Table: Revenue by Geography (15-20 rows)**
     - Use XLSX skill to extract from Revenue Model tab (geography section, typically rows 40-60)
     - Create Word table showing each geographic region with historical and projected years

5. **Add additional financial charts:**
   - Insert chart: `task4_charts/chart_10_gross_margin_evolution.png` (6 inches wide)
   - Insert chart: `task4_charts/chart_11_ebitda_margin_progression.png` (6 inches wide)
   - Insert chart: `task4_charts/chart_12_free_cash_flow_trend.png` (6 inches wide)

6. **Projection Assumptions (source-supported scope) ⭐ CRITICAL - NEW WRITING**
   - Add heading: 'Projection Assumptions' (level 2)
   - Use XLSX skill to read Scenarios tab to inform assumptions
   - Use XLSX skill to read Revenue Model tab for specific product/geography projections
   - Add heading: 'Revenue Assumptions by Product' (level 3)
   - Write detailed product-by-product assumptions (8-12 points per major product)
   - Write detailed region-by-region assumptions (6-8 points per major region)
   - Include margin, opex, capex, working capital assumptions
   - **Total: source-supported detail of specific, quantified assumptions**

7. **Scenario Analysis (source-supported scope) ⭐ CRITICAL - NEW WRITING**
   - Add heading: 'Scenario Analysis' (level 2)
   - Use XLSX skill to extract scenario data from Scenarios tab
   - Extract Bull/Base/Bear parameters for key metrics (2029E Revenue, EBITDA Margin, etc.)
   - Write Bull Case (500-700 words): specific parameters, catalysts, probability, valuation
   - Write Base Case (300-500 words): most likely scenario with rationale
   - Write Bear Case (500-700 words): downside triggers, parameters, probability, valuation
   - Write Scenario Comparison (200-300 words)
   - Insert chart: `task4_charts/chart_14_scenario_comparison.png` (6 inches wide)
   - **Create Table: Scenario Comparison**
     - Use XLSX skill to extract from Scenarios tab
     - Create Word table with Bull/Base/Bear columns and key metrics as rows

8. **Growth Drivers (800-1,200 words) - NEW WRITING**
   - Add heading: 'Key Growth Drivers' (level 2)
   - Write 3-5 key drivers with specific quantified opportunities
   - Include timelines and milestones
   - Reference specific data from financial model

**Result after Phase C**: Pages 18-30 complete (~13 pages, 5-7K words, 7-8 charts, 6-8 tables)

**Key Point**: Use XLSX skill to READ data from Task 2's Excel file, use the data to inform NEW analytical writing, and use DOCX skill to create Word tables from Excel data.

#### Phase D: Add Valuation Analysis from Task 3
**Mix of copying Task 3 analysis + inserting data from Excel**

Use Claude's DOCX and XLSX skills to:

**SECTION 4: Valuation Analysis (Pages 31-40)**

1. **Add section heading: 'Valuation Analysis' (level 1)**

2. **Read Task 3 markdown file**
   - Use Read tool: `[Company]_Valuation_Analysis_[Date].md`
   - Identify sections by markdown headers: DCF Analysis, Comparable Companies, Price Target

3. **DCF Analysis section**
   - Add heading: 'DCF Analysis' (level 2)
   - Extract 'DCF Analysis' section from Task 3 markdown
   - Convert markdown to Word paragraphs
   - Insert chart: `task4_charts/chart_28_dcf_sensitivity_heatmap.png` (6 inches wide) ⭐ MANDATORY

   - **Create Table: DCF Key Assumptions**
     - Add heading: 'DCF Key Assumptions' (level 3)
     - Use XLSX skill to open `[Company]_Financial_Model_[Date].xlsx`
     - Read DCF tab (columns A-C, first 20 rows: Assumption, Value, Source)
     - Create Word table from extracted data

   - **Create Table: DCF Sensitivity Matrix**
     - Use XLSX skill to read Sensitivity Analysis tab
     - Extract full sensitivity matrix (WACC values as rows, terminal growth as columns)
     - Create Word table showing valuation at different parameter combinations

   - Insert chart: `task4_charts/chart_29_dcf_waterfall.png` (6 inches wide)

4. **Comparable Companies section**
   - Add heading: 'Comparable Companies Analysis' (level 2)
   - Extract 'Comparable Companies' section from Task 3 markdown
   - Convert markdown to Word paragraphs

   - **Create Table: Comparable Companies ⭐ CRITICAL**
     - Add heading: 'Comparable Companies' (level 3)
     - Use XLSX skill to read Comparable Companies tab
     - Extract full table including:
       - 5-10 peer companies plus target company
       - Statistical summary rows (Maximum, 75th Percentile, Median, 25th Percentile, Minimum)
     - Create Word table with all columns: Ticker, Market Cap, EV/Revenue (LTM & NTM), EV/EBITDA (LTM & NTM), P/E (NTM), Revenue Growth, EBITDA Margin
     - **Verify statistical summary is included in table**

   - Insert chart: `task4_charts/chart_31_peer_multiples_comparison.png` (6 inches wide)

5. **Valuation Summary**
   - Insert chart: `task4_charts/chart_32_valuation_football_field.png` (6.5 inches wide) ⭐ MANDATORY

   - **Create Table: Valuation Summary**
     - Use XLSX skill to read Valuation Summary tab
     - Extract valuation methods (DCF, Comps, Precedent Transactions if applicable)
     - Create Word table showing: Method, Low Case, Base Case, High Case, Weight, Weighted Value

6. **Price Target & Recommendation**
   - Add heading: 'Price Target and Recommendation' (level 2)
   - Extract 'Price Target' section from Task 3 markdown
   - Convert markdown to Word paragraphs
   - Should include: Final recommendation (BUY/HOLD/SELL), price target with % upside, key catalysts, key risks

**Result after Phase D**: Pages 31-40 complete (~10 pages, 3-4K words, 5-6 charts, 4-5 tables)

**Key Point**: Use Read tool for Task 3's .md file to get written analysis, and use XLSX skill to READ from Task 3's Excel tabs (which were added to Task 2's model file) to create quantitative tables.

#### Phase E: Add Appendices & Finalize

Use Claude's DOCX skill to:

**SECTION 5: Appendices (Pages 41-50)**

1. **Data Sources & References**
   - Add heading: 'Data Sources & References' (level 1)
   - List only sources actually used: authorized query results and user-provided issuer/industry files
   - Record source/file name, document/query date, reporting period, currency/unit, and provenance
   - Mark missing external data `UNSOURCED` / `NOT_CONFIGURED`
   - Do not browse, create external links, or infer source availability

2. **Additional Tables**
   - Add heading: 'Additional Tables' (level 1)
   - Add extended financial projections
   - Add detailed assumptions tables
   - Add any supporting tables that didn't fit in main sections

#### Phase F: Write Page 1 Investment Summary
**NOW write Page 1 - after all analysis complete**
- INITIATING COVERAGE header
- Rating box
- 3-4 detailed bullets synthesizing entire report
- Financial summary table
- Stock price chart

#### Phase G: Add Table of Contents & Page Numbers
- Auto-generate TOC
- Add page numbers to all pages

**Key formatting requirements:**
- Professional fonts (Calibri, Arial, or similar)
- Proper headers and footers with page numbers
- Section breaks between major sections
- Embed all available source-supported charts inline; do not fabricate charts or enforce a minimum count
- Insert all source-supported tables inline with text
- Preserve available source/date/period/currency-unit/provenance notes; no external hyperlinks are required or tested
- Readable layout; visual density is determined by available, useful content.

**Visual Density Strategy:**
```
Good page layout example:
┌─────────────────────────────┐
│ Section Header              │
│ Text paragraph (200 words)  │
│ [Chart embedded]            │
│ Text paragraph (200 words)  │
│ [Table embedded]            │
│ Text paragraph (200 words)  │
│ [Chart embedded]            │
└─────────────────────────────┘

BAD - Avoid:
- Full page with only one chart
- Multiple pages of pure text
- Charts grouped at end of sections
```

**Result**: source-grounded internal research draft with useful, supported visuals

---

## File Operations Summary

**Throughout the entire assembly process, use Claude's DOCX and XLSX skills with actual file operations:**

**Reading Input Files:**
- ✓ Use Read tool: `[Company]_Research_Document_[Date].md` - Read Task 1 research
- ✓ Use XLSX skill: Open `[Company]_Financial_Model_[Date].xlsx` and read tabs - Extract tables from Task 2/3
- ✓ Use Read tool: `[Company]_Valuation_Analysis_[Date].md` - Read Task 3 analysis
- ✓ Use DOCX skill: Insert images from `task4_charts/chart_XX.png` files

**Writing Output File:**
- ✓ Use DOCX skill: Create new Word document
- ✓ Use DOCX skill: Add paragraphs (text from input .md files)
- ✓ Use DOCX skill: Create tables (data from Excel files read via XLSX skill)
- ✓ Use DOCX skill: Insert images (chart .png files)
- ✓ Use DOCX skill: Save final file as `[Company]_Initiation_Report_[Date].docx`

**Do NOT manually copy/paste. Use Claude's built-in skills to:**
1. Read from .md files (Task 1, Task 3) using Read tool
2. Read from .xlsx files (Task 2 with Task 3 tabs) using XLSX skill
3. Read from .png files (Task 4) as image files
4. Write to .docx file (Task 5 output) using DOCX skill

This approach is efficient, reproducible, and ensures all data flows correctly from source files to final report.

### Step 7: Quality Check

**Run comprehensive verification:**

```
═══════════════════════════════════════════════════════════
REPORT QUALITY CHECKLIST
═══════════════════════════════════════════════════════════

LENGTH REQUIREMENTS:
- [ ] Report is source-driven length (count: ____ pages)
- [ ] Word count follows requested scope and available evidence; no minimum applies.
- [ ] All source-supported charts embedded (count: ____; no minimum)
- [ ] source-supported tables included (count: ____ tables)

PAGE 1 FORMAT:
- [ ] "INITIATING COVERAGE" header present
- [ ] Thesis-focused title (not generic)
- [ ] Rating box complete with all elements
- [ ] Stock price chart (Figure 1) embedded
- [ ] 3-4 detailed bullets with ■ character
- [ ] Each bullet has **bold header** + 3-5 sentences
- [ ] Financial summary table included
- [ ] Years noted as "A" (actual) and "E" (estimate)

SECTION WORD COUNTS:
- [ ] Investment Thesis: 800-1,200 words ✓
- [ ] Risk Assessment: 600-900 words ✓
- [ ] Company Description: 800-1,200 words ✓
- [ ] Management Bios: 1,000-1,400 words (source-documented management facts only; no minimum biography count or length) ✓
- [ ] Products & Services: 700-1,000 words ✓
- [ ] Financial Analysis: 1,200-1,800 words ✓
- [ ] **Projection Assumptions: source-supported detail ✓** ⭐ CRITICAL
- [ ] **Scenario Analysis: source-supported detail ✓** ⭐ CRITICAL
- [ ] Growth Drivers: 800-1,200 words ✓
- [ ] Valuation Methodology: 800-1,200 words ✓

PRIORITY CHART DESIGNS (ONLY WHEN INPUTS ARE AVAILABLE):
- [ ] Revenue by Product (stacked area) embedded ⭐
- [ ] Revenue by Geography (stacked bar) embedded ⭐
- [ ] DCF Sensitivity (heatmap) embedded ⭐
- [ ] Valuation Football Field embedded ⭐

MANDATORY TABLES:
- [ ] Page 1 financial summary table
- [ ] Full income statement (40-50 line items)
- [ ] Revenue by product table (20-30 rows)
- [ ] Revenue by geography table (15-20 rows)
- [ ] Comparable companies table with statistical summary ⭐
- [ ] DCF assumptions table
- [ ] Scenario comparison table
- [ ] Additional 5-13 tables

SOURCE & PROVENANCE:
- [ ] All figures and tables have source/provenance notes
- [ ] Notes include date, period, currency/unit, and source/file where available
- [ ] Missing external inputs marked `UNSOURCED` / `NOT_CONFIGURED`
- [ ] Data Sources & References page included
- [ ] No external URLs or hyperlinks required or tested

DATA ACCURACY:
- [ ] All numbers match financial model exactly
- [ ] Revenue figures consistent across all tables/text
- [ ] Price target matches valuation analysis
- [ ] All growth rates calculated correctly
- [ ] All percentages sum to 100% where applicable

CONTENT REUSE (CRITICAL):
- [ ] Task 1 content used almost verbatim (not rewritten)
- [ ] Company 101 sections (pages 6-17) copied from Task 1 with only formatting changes
- [ ] Writing effort focused on quantitative sections (financial analysis, projections, scenarios)

VISUAL DENSITY (CRITICAL):
- [ ] Every page has BOTH text AND visuals (not pure text pages)
- [ ] Charts interspersed throughout (not grouped at end)
- [ ] Charts are source-supported and positioned near relevant analysis; no minimum density is required
- [ ] Charts are placed near relevant discussion when traceable inputs exist
- [ ] Do not force chart density or fill space with unsupported content

FORMATTING:
- [ ] No markdown syntax visible (no #, ##, **, etc.)
- [ ] Professional fonts throughout
- [ ] Headers and footers present
- [ ] Page numbers present
- [ ] Section breaks appropriate
- [ ] Charts embedded (not just file paths)
- [ ] Tables formatted professionally

WRITING QUALITY:
- [ ] Lead with numbers (not generic statements)
- [ ] Use "vs." not "versus"
- [ ] Quantify everything
- [ ] Professional tone throughout
- [ ] No typos or grammatical errors
- [ ] Specific examples (not vague statements)

═══════════════════════════════════════════════════════════
FINAL VERIFICATION
═══════════════════════════════════════════════════════════

IF ALL ITEMS CHECKED: ✓ READY FOR DELIVERY

IF ANY ITEMS UNCHECKED: ✗ FIX BEFORE DELIVERY

═══════════════════════════════════════════════════════════
```

**IF ANY ITEM FAILS, DO NOT DELIVER. Fix before proceeding.**

---

## Writing Style Guidelines

### Lead with Numbers (CRITICAL)

✓ **CORRECT**: "Revenue increased 150% YoY to [source currency] 250M in Q4 2024, driven by..."
✗ **INCORRECT**: "The company saw strong revenue growth this quarter..."

✓ **CORRECT**: "EBITDA margin expanded 500bps to 30% vs. 25% in FY2023"
✗ **INCORRECT**: "EBITDA margin expanded versus the prior year"

✓ **CORRECT**: "Market share increased 3 percentage points to 18% vs. 15% in 2023"
✗ **INCORRECT**: "Market share increased compared to last year"

✓ **CORRECT**: "Management expects 40-50% revenue growth in FY2025E"
✗ **INCORRECT**: "Management expects strong revenue growth"

### Professional Writing Standards

- **Front-load**: Most important information first
- **Data-driven**: Lead with numbers and metrics
- **Specific**: Concrete examples, not generic statements
- **Objective**: Present facts, acknowledge risks
- **Confident**: State views clearly with supporting evidence
- **Active voice**: "We estimate revenue will reach [source currency] 500M"
- **Precise**: Avoid "might", "could", "possibly"

### Number Formatting

**Consistency:**
- Billions: [source currency] X.XB (e.g., "[source currency] 2.5B")
- Millions: [source currency] XXXM (e.g., "[source currency] 250M")
- Always specify: YoY, QoQ, CAGR
- Basis points for small margin changes: "500bps"
- Year format: "2024A" (actual), "2025E" (estimate)

### Use "vs." not "versus"
✓ **CORRECT**: "Gross margin of 65% vs. 60% in prior year"
✗ **INCORRECT**: "Gross margin of 65% versus 60%"

---

## Common Pitfalls to Avoid

**⚠️ MOST COMMON MISTAKE: TAKING SHORTCUTS DUE TO LENGTH**

Many reports fail because they use placeholders like "details would be included here" or "see model for data" instead of actually writing/extracting the content. **DO NOT DO THIS.** Write every section in full. Extract every table. Embed every chart. Use whatever tokens are needed.

1. Preserve source-supported facts but correct inconsistencies and clearly separate analyst interpretation.
2. Do not pad page density, word counts, tables, charts, peers, risks, or assumptions.
3. Embed only useful charts generated from validated data; source lines and units are mandatory.
4. Use the authorized DOCX/XLSX workflow; if it is unavailable, block rather than improvise a binary.
5. Include prices, target, recommendation, market size, biographies, and peer metrics only when supported.
6. Keep actuals, estimates, assumptions, and currencies distinct; cross-check against the validated workbook.
7. Perform the quality checklist and disclose missing inputs. If an essential gate fails during unattended mode, return `BLOCKED` without asking.

---

## Success Criteria and Delivery

A successful final report must:
1. Use only verified Task 1–4 artifacts and maintain cross-file consistency.
2. Preserve source, date, period, currency/unit, actual/estimate status, provenance, and limitations.
3. Include only supported analysis, tables, charts, valuation claims, and management/peer facts; no count or length minimum applies.
4. Open and pass the supported DOCX render/layout check; verify that embedded charts and tables display correctly.
5. Be labeled as an internal research draft. It is not approved for publication, distribution, client use, trading, or compliance purposes.

If any essential source, prior artifact, or authorized Office capability is missing, return `BLOCKED` in unattended full-run mode and do not create a misleading final DOCX. In single-task mode, explain the missing prerequisite and ask whether the user wants to continue after it is supplied.

**Primary deliverable**: `[Company]_Initiation_Report_[Date].docx`

The Task 2/3 workbook remains a separate specified deliverable; do not silently bundle or substitute it for the DOCX. Do not provide a completion claim unless all required stage gates passed.
