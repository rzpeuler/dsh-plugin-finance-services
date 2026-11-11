# Equity Research Initiation Report Template

This is an optional structure guide for an internal A-share initiation report. It does not authorize data, sources, tools, file access, or publication.

**Precedence and safety:** The `initiating-coverage/SKILL.md`, current A-share source permissions, and the quality checklist override this template. A full run requires all essential inputs and a validated Office workflow. If either is missing, return `BLOCKED` rather than create a placeholder report.

**Template rules:**
1. All bracketed fields and examples are placeholders only; never reuse their example values as company facts.
2. Include rating, prices, valuation multiples, analyst credentials/contact, market share, and charts only when supported by authorized inputs.
3. No fixed page, word, table, or chart count or page density applies.
4. Create DOCX only through an explicitly available, validated Office export workflow; if unavailable, stop and report the capability gap.
5. Label any delivered report as an internal research draft; publication and distribution are outside scope.

Use readable formatting, source lines, and real embedded charts only when available, with no invented placeholders.

---

## Opening Summary (Optional First Page)

Use a concise investment summary when the Task 1–4 evidence supports one. This is a neutral report structure, not an investment recommendation or a named firm's format.

- Identify the issuer/ticker, exchange, scope, and as-of date using verified sources.
- Include a rating box, price/target, return, or valuation metrics only when all supporting inputs are authorized and verified; otherwise omit them and state the limitation.
- Include a price chart only if authorized, traceable price history is available.
- Use as many evidence-backed thesis bullets as the source set supports; no fixed bullet or sentence count applies.
- Number and cite actual charts/tables consistently.

### Layout Structure

**OPTIONAL INVESTMENT/VALUATION SUMMARY:**

Include current price, target, rating, market capitalization, enterprise value, or historical range only if each field is verified from authorized data with a stated as-of date and source. Otherwise omit the field; do not use placeholders in the delivered report. Do not invent analyst credentials, contact information, or endorsements.

**OPTIONAL MARKET CHART:**

Embed a price-performance chart only if authorized price history and any benchmark data are available, properly dated, and traceable. Otherwise omit it and note the data limitation if material.

**MAIN CONTENT - GRAY HEADER BAR:**
```
[OUTPERFORM / NEUTRAL / etc.] RECOMMENDATION / COMPANY UPDATE
```

**MAIN CONTENT - DETAILED BULLETS (3-4 bullets):**

Use ■ character for bullets. Each bullet follows this format:
```
■ **[Bold Topic Header capturing main point].** Regular text explanation providing 3-5 sentences of detail with specific numbers, comparisons, and analysis. Lead with numbers and quantification where possible. Use "vs." not "versus". Be specific and concrete.

■ **[Second Topic Header].** [3-5 sentences of detailed explanation...]

■ **[Third Topic Header].** [3-5 sentences of detailed explanation...]

■ **[Fourth Topic Header - Optional].** [3-5 sentences of detailed explanation...]
```

**EXAMPLE BULLET FORMAT:**
```
■ **[Source-supported A-share issuer thesis and market opportunity].**
Use only issuer, industry, and market facts present in user-provided files or an explicitly configured and authorized `finance_data_query` result. State the source, date, period, unit, and methodology. If market size or growth is unavailable, mark it `UNSOURCED` / `NOT_CONFIGURED` and do not invent a TAM.
[No illustrative company-specific claims or numeric values are supplied. Populate only from authorized sources.]
```

**BOTTOM SECTION - FINANCIAL AND VALUATION METRICS TABLE:**
```
                            [Year-3]A   [Year-2]A   [Year-1]A   [Year]E    [Year+1]E
Revenue ([source currency] M)                [X]         [X]         [X]         [X]        [X]
Revenue Growth (%)          X.X%        X.X%        X.X%        X.X%       X.X%
Gross Margin (%)           X.X%        X.X%        X.X%        X.X%       X.X%
EBITDA ([source currency] M)                [X]         [X]         [X]         [X]        [X]
EBITDA Margin (%)          X.X%        X.X%        X.X%        X.X%       X.X%
EPS ([source currency] )                    X.XX        X.XX        X.XX        X.XX       X.XX
P/E (x)                    XX.Xx       XX.Xx       XX.Xx       XX.Xx      XX.Xx
EV/Revenue (x)             X.Xx        X.Xx        X.Xx        X.Xx       X.Xx
EV/EBITDA (x)              XX.Xx       XX.Xx       XX.Xx       XX.Xx      XX.Xx

Note: Use "A" suffix for actual/historical years, "E" suffix for estimated/projected years
Source: [user-provided file or explicitly authorized finance_data_query result]; record date, period, currency/unit, and provenance.
```

---

## FIGURE NUMBERING AND FORMATTING STANDARDS

**CRITICAL**: All charts, graphs, and tables must follow strict figure numbering conventions used in professional equity research.

### Figure Numbering Format

**Every chart/table must have:**
1. **Sequential numbering**: Figure 1, Figure 2, Figure 3, etc. (continue sequentially throughout entire report)
2. **Descriptive title**: "Figure X - [Company] [Specific Metric] [Type of Chart/Analysis]"
3. **Source line** (always at bottom): "Source: [user-provided file or explicitly authorized finance_data_query result]; record date, period, currency/unit, and provenance."

**Examples:**
- Figure 1 - [Company] Stock Price Performance
- Figure 2 - [Company] Historical and Projected Revenue Mix by Product
- Figure 3 - [Company] Revenue by Geographic Region
- Figure 4 - [Product Name] Revenue and Price per Patient per Year
- Figure 5 - [Company] Gross Margin Evolution
- Figure 6 - DCF Sensitivity Analysis ([source currency] /share)
- Figure 7 - Valuation Football Field

### Caption Format

```
Figure X - [Descriptive Title]
[Chart/Table/Graph content]
Source: [user-provided file or explicitly authorized finance_data_query result]; record date, period, currency/unit, and provenance.
```

For tables with multiple data sources:
```
Figure X - [Descriptive Title]
[Table content]
Source: [user-provided file or explicitly authorized finance_data_query result]; record date, period, currency/unit, and provenance.
```

### Placement Guidelines

- Figures should be numbered in order of appearance in the report
- First figure (Figure 1) is typically the stock price chart or revenue growth trajectory on Page 1
- Each figure must have its caption directly below the visual
- Source line should be in smaller font, italicized, at the very bottom of the figure

---

## PAGE 2: TABLE OF CONTENTS

```
Executive Summary....................................................1
Investment Thesis & Risks..........................................3
Company Overview.......................................................6
  Business Description & History................................6
  Management & Ownership..........................................8
  Products & Technology...........................................9
  Customers & Go-to-Market......................................11
Growth Outlook & Drivers...........................................13
Financial Analysis & Performance.................................16
  Historical Performance........................................16
  Financial Projections.........................................19
Industry Overview & Competitive Landscape.....................21
  Market Size & TAM..............................................21
  Competitive Analysis..........................................23
  Industry Trends................................................25
Valuation Analysis..................................................27
Appendices & Disclosures...........................................31
```

---

## PAGES 3-5: INVESTMENT THESIS & RISKS

**LAYOUT PRINCIPLE**: Interleave source-supported charts with analysis when available. Do not fabricate charts or require visuals on every page.

### Investment Thesis

**[Thesis Pillar 1]: [Title - e.g., "Large and Growing TAM"]**

[Opening sentence with key statistic]

[Paragraph 1: Market opportunity quantification]
- Current market size
- Growth drivers
- Company's positioning

[Paragraph 2: Why company will capture share]
- Competitive advantages
- Go-to-market strategy
- Early traction/proof points

[Paragraph 3: Financial impact]
- Revenue opportunity
- Margin profile
- Timeline

**[EMBED CHART: TAM Growth Chart]** - Stacked area chart showing market size evolution and company's opportunity

**[Thesis Pillar 2]: [Title - e.g., "Differentiated Technology/Product"]**

[Similar structure - 3 paragraphs covering the opportunity, competitive positioning, and financial impact]

**[EMBED CHART: Competitive Positioning Matrix]** - 2×2 chart showing company vs. competitors on key dimensions

**[Thesis Pillar 3]: [Title - e.g., "Strong Execution and Management"]**

[Similar structure]

**[Add 2-3 more pillars as needed]**

**[EMBED CHART: Margin Expansion Pathway]** - Waterfall or line chart showing path to margin improvement

### Investment Risks

**Company-Specific Risks**

**[Risk 1]: [Title - e.g., "Customer Concentration"]**
[Description of risk, quantification if possible, mitigating factors. 2-3 sentences.]

**[Risk 2]: [Title - e.g., "Execution Risk on Product Roadmap"]**
[Description. 2-3 sentences.]

**[Risk 3-5]: [Additional company-specific risks]**
[Continue with 3-5 total company risks]

**Industry/Market Risks**

**[Risk 1]: [Title - e.g., "Regulatory Uncertainty"]**
[Description. 2-3 sentences.]

**[Risk 2]: [Title - e.g., "Intense Competition"]**
[Description. 2-3 sentences.]

**[Risk 3-4]: [Additional industry/market risks]**
[Continue with 2-4 total industry risks]

---

## PAGES 8-19: COMPANY 101

### Company Description (1 page)

**Overview**
[3-4 paragraphs describing:
- What the company does (in plain English)
- How it makes money
- Who its customers are
- Geographic presence
- Scale/size metrics]

**Business Model Diagram/Visual**
[Insert visual showing how the company creates value]

### Company History (2-3 pages)

**The Early Days: [Founding Story Title]**

[Paragraph on founding: who, when, why, initial vision]

**Timeline of Key Milestones**

```
[Year]: [Founding event, initial funding]
[Year]: [Product launch, key milestone]
[Year]: [Major partnership, funding round]
[Year]: [Geographic expansion, new product]
[Year]: [Recent achievement]
```

**[Major Turning Point or Pivot]**
[If applicable, describe any major strategic shifts]

**[Company Name] Today: [Current State Title]**
[Paragraphs describing current position, recent developments, current strategy]

### Management & Ownership (2 pages)

**Key Executives**

For each executive:
```
[Name] - [Title]
[Bio paragraph including:
- Current role and responsibilities
- Prior experience and track record
- Key accomplishments at company
- Education/credentials]
```

**Corporate Structure & Governance**
- Entity type (C-Corp, PBC, etc.)
- Board composition
- Special governance features
- [Include governance diagram if applicable]

**Ownership Structure** [if disclosed]
- Major shareholders and ownership %
- Strategic investors
- Employee ownership
- Insider ownership trends

### Core Technology/Products (2-3 pages)

**Technology Overview**
[Description of core technology/platform]

**Product Portfolio**

For each major product:
```
[Product Name]

Description:
[What it does, key features]

Target Customers:
[Who uses it, use cases]

Pricing Model:
[How it's priced, typical contract values]

Competitive Positioning:
[How it compares to alternatives]

Traction:
[Customers, revenue, growth metrics]
```

**Product Roadmap**
[Future products/features in development]

### Customers & Distribution (2-3 pages)

**Customer Base**
- Total customers: [number]
- Customer segments (Enterprise, Mid-Market, SMB)
- Geographic breakdown
- Customer case studies/testimonials

**Go-to-Market Strategy**
- Sales channels (direct, partner, etc.)
- Sales cycle and CAC
- Key partnerships for distribution
- Marketing strategy

**Customer Economics**
- LTV/CAC ratio
- Net retention rate
- Churn rates
- Expansion rates

---

## PAGES 20-22: GROWTH OUTLOOK

### Growth Framework Overview

**Short-term Growth Drivers (1-2 years)**
1. [Driver 1]
2. [Driver 2]
3. [Driver 3]

**Medium-term Growth Drivers (3-5 years)**
1. [Driver 1]
2. [Driver 2]

### Detailed Growth Driver Analysis

**[Growth Driver 1]: [Title]**

*Current State:*
[Baseline metrics, current performance]

*Opportunity:*
[Market size, company positioning, growth potential]

*Timeline & Milestones:*
- Near-term (1-2 years): [Expected progress]
- Medium-term (3-5 years): [Expected progress]

*Risks & Challenges:*
[What could prevent realization of this opportunity]

**[Repeat for each major growth driver]**

### Financial Projections

**Revenue Build-up**
[Visual showing how revenue grows from current to projected]

**Scenario Analysis**
[Table or chart showing Bear/Base/Bull case projections]

---

## PAGES 21-24: FINANCIAL ANALYSIS & PERFORMANCE

**LAYOUT PRINCIPLE**: Use available source-supported charts with financial tables; do not force chart counts or unsupported visuals.

### Historical Financial Analysis

**Income Statement Highlights (3-5 Year History)**
```
                    2021    2022    2023    2024    LTM
Revenue ([source currency] M)        [X]     [X]     [X]     [X]     [X]
  Growth %          -       X%      X%      X%      X%
Gross Profit ([source currency] M)   [X]     [X]     [X]     [X]     [X]
  Margin %          X%      X%      X%      X%      X%
EBITDA ([source currency] M)         [X]     [X]     [X]     [X]     [X]
  Margin %          X%      X%      X%      X%      X%
Net Income ([source currency] M)     [X]     [X]     [X]     [X]     [X]
  Margin %          X%      X%      X%      X%      X%
FCF ([source currency] M)            [X]     [X]     [X]     [X]     [X]
```

**[CHART 1: Revenue Growth Trajectory]**
Line chart showing historical revenue with annotations for key milestones. Include growth % labels on chart.

**[CHART 2: REVENUE BY PRODUCT/SEGMENT]** ⭐ CRITICAL
Stacked area chart showing revenue composition by product line or business segment over time. This shows mix shift and which products are driving growth.
```
Example segments:
- Product A Revenue
- Product B Revenue
- Product C Revenue
- Services Revenue
```

**[CHART 3: REVENUE BY GEOGRAPHY]** ⭐ CRITICAL
Stacked bar chart showing revenue breakdown by geographic region over time.
```
Example regions:
- [Geography, as reported in the issuer's available source]
- Europe
- Asia-Pacific
- Rest of World
```

### Financial Performance Analysis

**[CHART 4: Gross Margin Evolution]**
Line chart with annotations explaining margin drivers (scale, pricing, mix, etc.)

**[CHART 5: Operating Margin Progression]**
Waterfall chart showing path from gross margin to operating margin, or line chart showing EBITDA margin trend

**[CHART 6: Free Cash Flow Generation]**
Bar + line combo chart: Bars = FCF, Line = FCF margin %

**[CHART 7: Key Operating Metrics Dashboard]**
Multi-panel chart showing 3-4 key metrics:
- Customer count or user growth
- ARPU (Average Revenue Per User) or ACV (Annual Contract Value)
- Customer cohort retention or net revenue retention
- LTV/CAC or magic number or other unit economic metric

### Forward Projections (3-5 Years)

**Projected Financial Model**
```
                    2025E   2026E   2027E   2028E   2029E
Revenue ([source currency] M)        [X]     [X]     [X]     [X]     [X]
  Growth %          X%      X%      X%      X%      X%
Gross Profit ([source currency] M)   [X]     [X]     [X]     [X]     [X]
  Margin %          X%      X%      X%      X%      X%
EBITDA ([source currency] M)         [X]     [X]     [X]     [X]     [X]
  Margin %          X%      X%      X%      X%      X%
FCF ([source currency] M)            [X]     [X]     [X]     [X]     [X]
  FCF Margin %      X%      X%      X%      X%      X%
```

**Key Assumptions**
- Revenue growth drivers and assumptions
- Margin progression assumptions
- CapEx as % of revenue
- Working capital assumptions

**Charts:**
- Revenue bridge showing growth drivers
- Margin waterfall showing path to profitability/margin expansion
- Free cash flow trajectory

### Fundraising & Valuation [For Private Companies]

**Fundraising History**
```
Round    Date      Amount    Valuation    Lead Investor(s)
Seed     [Date]    [source currency] XM       [source currency] XM          [Investor]
Series A [Date]    [source currency] XM       [source currency] XM          [Investor]
Series B [Date]    [source currency] XM       [source currency] XM          [Investor]
[etc.]
```

**Valuation Evolution Chart**
[Visual showing valuation progression over time]

**Current Valuation Metrics**
- Latest valuation: [source currency] XXbn
- Implied valuation multiple: XX.Xx
- Comparison to public peers

---

## PAGES 26-31: INDUSTRY OVERVIEW

### Industry Definition & Market Size

**Industry Overview**
[2-3 paragraphs on:
- Industry definition and scope
- Current market size
- Historical growth rates
- Key trends and drivers]

**Market Size Chart**
[Visual showing market growth from historical through projected]

### Competitive Landscape

**Competitive Positioning Matrix**
[2x2 chart showing company vs. competitors on key dimensions]

**Competitive Comparison Table**
```
Metric              [Company]  Comp A   Comp B   Comp C   Comp D
Revenue ([source currency] B)        [X]        [X]      [X]      [X]      [X]
Growth %            X%         X%       X%       X%       X%
Market Share        X%         X%       X%       X%       X%
Gross Margin        X%         X%       X%       X%       X%
Key Differentiator  [X]        [X]      [X]      [X]      [X]
```

**Competitive Analysis Narrative**
[2-3 paragraphs analyzing:
- Competitive strengths and weaknesses
- Market positioning
- Share gains/losses
- Competitive moats]

### Total Addressable Market

**TAM Calculation**
```
Current TAM (2025):              [source currency] XXbn
Projected TAM (2030):            [source currency] XXbn
CAGR:                            XX%

Segmentation:
- [Segment A]:                   [source currency] XXbn
- [Segment B]:                   [source currency] XXbn
- [Segment C]:                   [source currency] XXbn
```

**TAM Growth Chart**
[Visual showing TAM expansion over time by segment]

**Company's Market Opportunity**
```
Total TAM (2030):                [source currency] XXbn
Serviceable TAM:                 [source currency] XXbn
Company's Realistic Share:       XX%
Implied Revenue Potential:       [source currency] XXbn
```

### Industry Dynamics

**Porter's Five Forces Analysis**
- Threat of new entrants: [High/Medium/Low] - [Explanation]
- Bargaining power of suppliers: [High/Medium/Low] - [Explanation]
- Bargaining power of buyers: [High/Medium/Low] - [Explanation]
- Threat of substitutes: [High/Medium/Low] - [Explanation]
- Industry rivalry: [High/Medium/Low] - [Explanation]

**Key Industry Trends**
1. [Trend 1]: [Description and impact]
2. [Trend 2]: [Description and impact]
3. [Trend 3]: [Description and impact]

---

## PAGES 32-34: VALUATION ANALYSIS

### Valuation Methodology Summary

```
Valuation Method            Weight    Implied Value    Weighted Value
DCF Analysis                50%       [source currency] XX - [source currency] YY        [source currency] ZZ
Trading Comparables         30%       [source currency] XX - [source currency] YY        [source currency] ZZ
Precedent Transactions      20%       [source currency] XX - [source currency] YY        [source currency] ZZ
                           ────       ─────────────    ─────────
Weighted Average Price Target         [source currency] AA - [source currency] BB        [source currency] CC
```

### DCF Analysis

**Key Assumptions**
```
Revenue Growth (2025-2029):         XX% CAGR
Terminal Growth Rate:               X.X%
WACC:                               X.X%
Terminal Year EBITDA Margin:        XX%
```

**Figure X - DCF Sensitivity Analysis ([source currency] /share)**

CRITICAL FORMAT: DCF sensitivity must be shown as a 2-way heat map table with color coding.

```
                        Terminal Growth Rate
WACC        2.0%      2.5%      3.0%      3.5%      4.0%
8.0%        [source currency] 52       [source currency] 55       [source currency] 58       [source currency] 62       [source currency] 66
9.0%        [source currency] 48       [source currency] 51       [source currency] 54       [source currency] 57       [source currency] 61
10.0%       [source currency] 45       [source currency] 47       [source currency] 50       [source currency] 53       [source currency] 56
11.0%       [source currency] 42       [source currency] 44       [source currency] 47       [source currency] 49       [source currency] 52
12.0%       [source currency] 39       [source currency] 41       [source currency] 44       [source currency] 46       [source currency] 49

Color coding: Green (higher values) → Yellow (mid) → Red (lower values)
Source: [Firm Name] estimates.
```

**Scenario Analysis**
```
Scenario      Enterprise Value    Equity Value    Price/Share
Bear Case     [source currency] XXbn              [source currency] XXbn           [source currency] XX
Base Case     [source currency] XXbn              [source currency] XXbn           [source currency] XX
Bull Case     [source currency] XXbn              [source currency] XXbn           [source currency] XX
```

### Trading Comparables

**Figure X - Comparable Companies Analysis**

CRITICAL FORMAT: Comp table must have two-part structure with statistical summary.

**Part 1: Individual Company Data**
```
Company         Ticker   Market   EV/Rev   EV/Rev   EV/EBITDA  EV/EBITDA  Rev     EBITDA
                         Cap([source currency] B)  2024E    2025E    2024E      2025E      Growth  Margin
Peer A          PERA     XX.X     X.Xx     X.Xx     XX.X       XX.X       XX%     XX%
Peer B          PERB     XX.X     X.Xx     X.Xx     XX.X       XX.X       XX%     XX%
Peer C          PERC     XX.X     X.Xx     X.Xx     XX.X       XX.X       XX%     XX%
Peer D          PERD     XX.X     X.Xx     X.Xx     XX.X       XX.X       XX%     XX%
[Company]       COMP     XX.X     X.Xx     X.Xx     XX.X       XX.X       XX%     XX%
```

**Part 2: Statistical Summary**
```
Max                      XX.X     X.Xx     X.Xx     XX.X       XX.X       XX%     XX%
75th Percentile          XX.X     X.Xx     X.Xx     XX.X       XX.X       XX%     XX%
Median                   XX.X     X.Xx     X.Xx     XX.X       XX.X       XX%     XX%
25th Percentile          XX.X     X.Xx     X.Xx     XX.X       XX.X       XX%     XX%
Min                      XX.X     X.Xx     X.Xx     XX.X       XX.X       XX%     XX%

Source: [user-provided file or explicitly authorized finance_data_query result]; record date, period, currency/unit, and provenance.
```

**Implied Valuation**
[Calculation showing application of peer multiples to company's metrics]

### Precedent Transactions [If Applicable]

**Figure X - Precedent Transaction Analysis**
```
Date        Target       Acquirer      Deal      EV/Rev   EV/EBITDA  Premium
                                      Value([source currency] B)
[MM/YYYY]   [Company A]  [Buyer A]    X.X       X.Xx     XX.X       XX%
[MM/YYYY]   [Company B]  [Buyer B]    X.X       X.Xx     XX.X       XX%
[MM/YYYY]   [Company C]  [Buyer C]    X.X       X.Xx     XX.X       XX%
────────────────────────────────────────────────────────────────────
Median                                          X.Xx     XX.X       XX%

Source: Capital IQ, company filings, [Firm Name] estimates.
```

**Control Premium Analysis**
[Discussion of typical premiums in the industry]

### Valuation Summary

**Figure X - Valuation Football Field**

CRITICAL FORMAT: Football field must be a horizontal bar chart showing all valuation methods.

```
Valuation Method                Low End ────── Range ────── High End

DCF Analysis                    [source currency] 42 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ [source currency] 58

Trading Comps (NTM)             [source currency] 45 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ [source currency] 55

Precedent Trans.                [source currency] 48 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ [source currency] 60
                                                      ↑
                                            Current Price: [source currency] 50
────────────────────────────────────────────────────────────────
Valuation Range:                [source currency] 42                        [source currency] 60

Color coding: Each method should have distinct color bar
Add vertical line showing current stock price
Source: [Firm Name] estimates.
```

**Price Target & Recommendation**
```
Current Price:              [source currency] XX.XX ([Date])
Price Target:               [source currency] YY.YY
Upside/Downside:            ZZ%

Recommendation:             BUY / HOLD / SELL
Time Horizon:               12 months

Catalysts:
• [Near-term catalyst with timeframe]
• [Medium-term catalyst with timeframe]
• [Long-term catalyst with timeframe]
```

---

## PAGES 35+: APPENDICES & DISCLOSURES

### Appendix A: Detailed Financial Model
[Reference to Excel model]

### Appendix B: Management Bios
[Extended bios if not included in main text]

### Appendix C: Product Detail
[Additional product information if needed]

### Appendix D: Industry Data Sources
[List of sources used for industry analysis]

### Required Disclosures
- Analyst certification
- Important disclosures
- Company-specific disclosures
- Legal entity disclosures
- Other regulatory disclosures

---

## GRAPHICS & CHARTS TO INCLUDE

**Use source-supported charts only; no fixed chart-count target.**

**CRITICAL PRINCIPLE**: Embed source-supported charts near their discussion. Do not fabricate visuals or require one on every page when the source inputs are unavailable.

### Page 1 - Executive Summary (3 charts)
1. Revenue/ARR growth trajectory (line chart, historical + projected)
2. Key metrics dashboard (multi-panel chart)
3. Market positioning or margin progression

### Pages 3-5 - Investment Thesis & Risks (3 charts)
4. TAM growth and opportunity (stacked area chart)
5. Competitive positioning matrix (2×2 with bubbles)
6. Margin expansion pathway (waterfall or line)

### Pages 6-17 - Company 101 (6-8 charts)
7. Business model diagram (flow chart)
8. Company timeline (horizontal timeline)
9. Funding history (bar chart with valuation line)
10. Organization chart
11. Product portfolio matrix
12. Customer segmentation (pie or tree map)
13. Geographic revenue breakdown
14. Customer cohort retention

### Pages 18-20 - Growth Outlook (4 charts)
15. Revenue bridge showing drivers (waterfall)
16. Market share evolution (line chart)
17. Product roadmap (timeline)
18. Geographic expansion (map with timeline)

### Financials — include source-supported charts where available ⭐
19. Revenue growth trajectory (line with annotations)
20. **Revenue by product/segment** (stacked area) ⭐ MUST HAVE
21. **Revenue by geography** (stacked bar) ⭐ MUST HAVE
22. Gross margin evolution (line chart)
23. Operating margin progression (waterfall or line)
24. Free cash flow trajectory (bar + line combo)
25. Key operating metrics dashboard (multi-panel)
26. Scenario comparison (grouped bar: Bear/Base/Bull)

### Pages 25-30 - Industry Overview (6 charts)
27. Market size evolution (area chart with CAGR)
28. Competitive landscape map (2×2)
29. Market share pie chart
30. Market share evolution over time (line chart)
31. TAM segmentation
32. Industry trend charts

### Pages 31-34 - Valuation (5 charts)
33. DCF sensitivity analysis (heat map)
34. DCF waterfall (PV of cash flows → equity value)
35. Trading comps scatter plot (growth vs. multiple)
36. Peer valuation multiples (grouped bar)
37. Valuation football field (range chart)
38. Price target scenarios (bar with upside/downside)

**Chart Style Guidelines:**
- **Consistent color scheme** throughout (pick 3-5 brand colors)
- **Professional fonts** (Arial, Calibri, or similar)
- **Clear labels and legends** on every chart
- **Source citations** at bottom of each chart
- **High information density** - use chart space efficiently
- **Mix of chart types** for visual interest
- **Annotations** to highlight key insights
- **Embedded in text** - never standalone pages
- **Sparklines in tables** where appropriate

---

## NOTES ON USING THIS TEMPLATE

1. **Opening summary:** Include verified identity, as-of date, and key supported facts. Omit unavailable price/rating/valuation fields and do not force three charts onto the first page.
2. **Readable layout:** Use appropriate spacing, headings, and page breaks; no page-density or element-count target applies.
3. **Chart/table placement:** Place useful, source-supported visuals near relevant discussion where the document layout permits.
4. **Authorized Office workflow:** Convert this outline only through the runtime's explicitly available and validated DOCX workflow; if absent, return `BLOCKED`.
5. **Consistent formatting:** Use consistent styles for headings, body text, tables, and charts.
6. **References:** Include source, date, period, currency/unit, and provenance for every material data point.
7. **Proofread:** Check names, ticker, dates, calculations, and consistency with the validated model.
8. **Balance:** Present supported positive and negative aspects objectively.
9. **Specific over generic:** Use concrete facts only when supported by the source set.
