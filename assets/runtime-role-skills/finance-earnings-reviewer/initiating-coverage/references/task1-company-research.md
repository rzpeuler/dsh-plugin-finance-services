# Task 1: Company Research - Detailed Workflow

This document provides step-by-step instructions for executing Task 1 (Company Research) of the initiating-coverage skill.

## Task Overview

**Purpose**: Research company's business, management, competitive position, industry, and risks.

**Prerequisites**: Confirmed in-scope issuer identity plus user-provided or explicitly configured and authorized research sources. Ticker shape alone does not confirm ordinary-share status or source rights. If the unattended full-run preflight finds no authorized sources, return `BLOCKED` without asking.

**Output**: Source-supported company research document. Section lengths are planning guidance, not minimums; do not add unsupported material to hit a word count.

---

## Data Sources to Gather

Use only user-provided files or `finance_data_query` when the exact tool/source and relevant capability are explicitly available, configured, and authorized. Do not use raw MCP, web search/fetch, outside websites, or guessed research providers. The tool name does not guarantee it returns filings, transcripts, biographies, industry data, or market share. If a fact is unavailable, mark it `UNSOURCED` / `NOT_CONFIGURED` and omit dependent claims.

### Primary Issuer Materials (when supplied or authorized)
- Annual/interim reports, issuer announcements, and financial statements
- Investor presentations, earnings transcripts, press releases, and product materials
- Governance/management information only as explicitly provided in the source

### Competitive and Industry Materials (when supplied or authorized)
- User-provided competitor reports, issuer materials, and industry research
- User-provided market studies and data
- No external news, profile, or research-site lookups

For every item, record source/file, document or query date, relevant period, currency/unit, and provenance. Do not infer source coverage, audit status, accounting basis, or data rights.

### Key Information to Extract

**Key Information:**
- Company founding date, headquarters, employee count
- Revenue size and growth trajectory (if available)
- Product portfolio and pricing
- Customer segments and case studies
- Management backgrounds and track records
- Competitive landscape and market share
- Industry trends and growth drivers
- Regulatory considerations
- High-level financial metrics (only from supplied/authorized issuer materials; otherwise `UNSOURCED` / `NOT_CONFIGURED`)

---

## Step-by-Step Research Workflow

### Step 1: Initial Data Collection

1. **Review provided or authorized issuer materials**
   - Use only user-provided files or results from an explicitly configured and authorized `finance_data_query` capability
   - Record issuer, reporting period, source/document date, currency/unit, and provenance
   - Do not browse issuer websites or external databases

2. **Review available earnings/governance materials**
   - Use an earnings transcript, presentation, announcement, or governance document only if user-provided or actually returned by an authorized query
   - Do not assume filing type, required document, or history length

3. **Document basic facts**
   - Founding date and story
   - Headquarters location
   - Employee count
   - Products/services
   - Key customers

### Step 2: Business Model Analysis

1. **Map revenue streams**
   - What does the company sell?
   - How is it priced? (subscription, transaction, license, etc.)
   - Who pays?
   - What are typical deal sizes?

2. **Understand customer segments**
   - Enterprise vs. SMB vs. consumer
   - Industries served
   - Geographic distribution
   - Customer concentration (top 10 customers)

3. **Document go-to-market**
   - Direct sales vs. channel partners
   - Sales cycle length
   - Customer acquisition strategy
   - Distribution model

4. **Identify unit economics**
   - LTV/CAC if available
   - Gross margins
   - Net revenue retention
   - Payback periods

### Step 3: Management and Governance

1. Identify senior leaders and directors only from authorized issuer filings, governance documents, or user-provided sources.
2. Summarize current role, tenure, prior roles, education, and disclosed accomplishments only when explicitly stated in those sources; do not use LinkedIn, foreign-filing workflows, press searches, or inferred biographies.
3. Assess board composition, independence, ownership, and compensation only to the extent documented. Label unavailable details `UNSOURCED` / `NOT_CONFIGURED`.
4. Use the number and depth of biographies supported by the source set; do not force an executive count or word count.

### Step 4: Competitive and Industry Position

1. Identify direct/indirect competitors only when they are explicitly named or supported by user-provided or authorized issuer/regulator/industry sources. Do not browse competitor websites or infer market share.
2. Compare only supported dimensions (products, disclosed scale, geography, pricing, or market share) and cite the source for each material comparison.
3. Use only the number of peers supported by those sources; if evidence is insufficient, state that a comparative ranking is unavailable.
4. Distinguish issuer claims from independent evidence and analyst interpretation.

### Step 5: Industry Analysis

1. Define the issuer's industry using its disclosed classification and, where available, the relevant CSRC or National Bureau of Statistics classification; record the source and code.
2. Include TAM/SAM/SOM, market penetration, and growth rates only when a cited, authorized source provides the scope, date, and methodology. Do not create top-down estimates from unrelated figures.
3. Summarize growth drivers, technology changes, industry structure, barriers, bargaining power, substitutes, and regulation only where the source set supports the claim.
4. Mark unsupported market sizing or forward growth as `UNSOURCED` / `NOT_CONFIGURED` and explain the impact.

### Step 6: Risk Assessment

Identify material risks disclosed by the issuer or supported by authorized sources; organize them by company, industry/regulatory, financial, or macroeconomic category where useful. Do not force a fixed count or severity score.

For each risk, distinguish the documented fact from analyst interpretation, describe the possible impact, and include mitigants only when supported. Quantify only when source data permits; otherwise state the uncertainty.

### Step 7: Synthesis and Writing

**Write document following this structure:**

1. **Company Overview** (800-1,200 words)
   - What does the company do? (plain English)
   - How do they make money? (business model)
   - Where do they operate? (geographic presence)
   - How large are they? (revenue, employees, customers)
   - Key metrics and scale indicators

2. **Company History** (800-1,200 words)
   - Founding story (who, when, why, where)
   - Timeline of major milestones
   - Strategic pivots or transformations
   - Key acquisitions
   - Recent developments (last 1-2 years)

3. **Management Team** (1,000-1,400 words)
   - source-supported management facts; no biography count or length minimum
   - Board composition and governance
   - Insider ownership
   - Management track record assessment

4. **Products & Services** (700-1,000 words)
   - Detailed product portfolio
   - Key features and capabilities
   - Product differentiation
   - Target customers and use cases
   - Pricing models and typical deal sizes

5. **Customers & Go-to-Market** (500-700 words)
   - Customer segments and profiles
   - Distribution channels
   - Sales strategy and cycle
   - Key partnerships
   - Customer case studies

6. **Industry Overview** (800-1,200 words)
   - Industry definition and scope
   - Market size and structure
   - Growth rates (historical and projected)
   - Key trends and drivers
   - Regulatory environment
   - Industry dynamics

7. **Competitive Landscape** (700-1,000 words)
   - Analysis of 5-10 key competitors
   - Market positioning framework
   - Company's competitive advantages
   - Competitive vulnerabilities
   - Market share analysis

8. **Market Opportunity** (500-700 words)
   - TAM sizing and methodology
   - Market growth projections
   - Company's serviceable market
   - Market share opportunity
   - Penetration strategy

9. **Risk Assessment** (600-900 words)
   - Company-specific risks (4-6)
   - Industry/market risks (3-4)
   - Financial risks (2-3)
   - Macroeconomic risks (2-3)
   - Each risk: 50-100 word description

**Data Sources Section**
- List source or user-file name, document/query date, reporting period, currency/unit, and provenance
- Include URLs only when present in user-provided material or an authorized query result; do not browse or create external links
- Organize by source type and flag missing inputs `UNSOURCED` / `NOT_CONFIGURED`

---

## Quality Standards

### Content Depth
- Cover the relevant sections to the depth supported by authorized sources; word-count targets are not minimums.
- Separate reported facts, company statements, and analyst interpretation.
- Cite material facts with source, date, period, unit, and provenance; maintain objectivity and balance.

### Management and Governance
- Include only disclosed leadership, tenure, experience, governance, and ownership facts.
- Do not infer biographies, credentials, board independence, or compensation details.

### Competitive and Market Analysis
- Use only explicitly supported peers, positioning, market size, and growth metrics.
- Do not force a peer count or invent TAM/SAM/SOM calculations.

### Risk Assessment
- Identify material risks supported by disclosures and source context; no fixed count or word minimum.
- Distinguish risk facts from analysis and quantify impact only when data permits.

### Writing Quality
- Professional analytical tone, concrete examples where supported, concise citations, and explicit limitations.

---

## Output Format

```text
COMPANY RESEARCH: [Issuer name / ticker]
As-of date: [date]
Scope: Mainland A-share issuer; internal research draft

1. Company overview and business model
2. History and material developments
3. Management and governance (only documented facts)
4. Products, customers, and go-to-market (as disclosed)
5. Industry context and regulatory environment (sourced)
6. Competitive position (supported peers only)
7. Market opportunity (only if methodology and inputs are sourced)
8. Material risks (evidence and analysis separated)
9. Data gaps and limitations
10. Sources and provenance
```

Include only sections supported by the source set. Mark unavailable required facts `UNSOURCED` / `NOT_CONFIGURED`; do not create empty prose or unsupported quantitative estimates.

---

## Success Criteria

A successful Task 1 document must:
1. Use only authorized source material and distinguish facts from analysis.
2. Cite material claims with available source/date/period/unit/provenance.
3. Cover the business, management, industry, competition, and risks to the depth supported by evidence.
4. Mark missing data explicitly; do not force a word count, peer count, TAM estimate, or risk count.
5. Avoid unsupported historical, current, or forward-looking claims.

---

## File Naming Convention

Save the output as:

`[Company]_Research_Document_[Date].md`

Example: `[A-share issuer]_Research_Document_2024-10-27.md`

---

## Next Steps

After completing Task 1, the research document will be used:

- As standalone company analysis
- As input for Task 2 (Financial Modeling) - provides business context for projections
- As input for Task 4 (Chart Generation) - provides data for company/competitive charts
- As foundation for Task 5 (Report Assembly) - Company 101 sections copied verbatim
