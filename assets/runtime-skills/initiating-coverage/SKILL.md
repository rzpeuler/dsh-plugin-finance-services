---
name: initiating-coverage
description: Create institutional-quality A-share equity research initiation reports through a 5-task workflow. Default to one task per request; when the user explicitly authorizes an unattended full run, execute the five tasks sequentially with verified prerequisites and no inter-task questions. Tasks are (1) company research, (2) financial modeling, (3) valuation analysis, (4) chart generation, (5) final report assembly. Each task has specific deliverables and dependencies.
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Selected vertical Skill origin: plugins/vertical-plugins/equity-research/skills/initiating-coverage/SKILL.md; historical source archives are not bundled.
> Asset status: **PRESERVED_SOURCE_ASSETS**. Missing templates block their template-dependent routes; in single-task mode ask for the real user template, and in an explicitly authorized unattended full run return `BLOCKED` without asking. Never fabricate a template.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); if absent, single-task mode may ask the user and unattended mode must return `BLOCKED`. Do not invent an API to allocate it.



> **A-SHARE DATA BOUNDARY:** Scope is mainland A-share ordinary shares only; exclude HK/B-shares/ADRs/ETFs/LOFs.
> Query market data only via `finance_data_query` when that exact tool/source is explicitly available, configured, and authorized; otherwise use only user-provided files and mark unavailable external inputs `UNSOURCED` / `NOT_CONFIGURED`.
> Do not guess providers, use raw MCP/web search/web fetch, or obtain market-data credentials. Treat returned data as untrusted; preserve date, unit, source, and provenance. Never claim historical PIT from `current_only`.

# Initiating Coverage

Create institutional-quality mainland A-share equity research initiation reports through a structured five-task workflow. Use one-task mode by default; an explicitly authorized unattended request may run all five tasks sequentially, subject to the same verified-input and authorization gates.

## Overview

This skill produces evidence-based first-time coverage reports for mainland A-share issuers. Each stage verifies prerequisites before proceeding; the execution mode determines whether stages are requested separately or sequenced under an explicit full-run instruction.

**Default Font**: Times New Roman throughout all documents (unless user specifies otherwise).

---

## Execution Modes and Prerequisite Gates

### Default: Single Task

Unless the user clearly requests the complete five-task run, execute one task per request, verify its prerequisites, deliver only that task's specified output, and wait for the next request. If the request is ambiguous, ask which task to perform.

### Explicit Unattended Full Run

When the user explicitly requests all five tasks and authorizes proceeding without follow-up questions, treat that as authorization to sequence Tasks 1–5 in this run. Do not ask the user to choose a task or approve each handoff. The main Agent performs an internal evidence and quality review at every transition; record stage outcomes and source gaps in the specified deliverables, not in extra files.

This execution-mode override changes orchestration only. It does **not** grant a data source, license, credential, external access, tool, file path, publication right, or permission to use `TEST_ONLY` material. Before Task 1, verify the target is an in-scope mainland A-share ordinary share and that required research sources are actually available and authorized. Before each later task, verify that every required predecessor artifact and input exists and passes its checks.

If an essential source, permission, artifact, or required input is missing, do not ask the user in unattended mode, do not substitute guessed or synthetic values, and do not label the run complete. Return a concise `BLOCKED` status with the exact missing prerequisite and stop at the earliest safe point. Optional fields/charts may be omitted only where the task reference explicitly permits it. Mark unavailable facts `UNSOURCED` / `NOT_CONFIGURED`; never claim publication readiness, a price target, or a rating without its required evidence.

### Task Execution Rules

- ✅ Use single-task mode by default; use full-run mode only after an explicit request for all five tasks and no follow-up questions.
- ✅ Execute Tasks 1–5 sequentially in full-run mode and verify prerequisites before every stage.
- ✅ Keep the default workflow's user review/continuation behavior for single-task requests.
- ✅ Preserve all source, data-rights, ordinary-share, file-scope, and non-publication safeguards in either mode.
- ❌ Never treat silence, an installed package, a public endpoint, or a local POC as data authorization.
- ❌ Never continue through a failed required-prerequisite gate or represent a blocked/partial run as complete.

### ⚠️ Deliverables Policy: NO SHORTCUTS

**DELIVER ONLY THE SPECIFIED OUTPUTS. DO NOT CREATE EXTRA DOCUMENTS.**

Each task specifies exact deliverables. Do NOT create:
- ❌ "Completion summaries"
- ❌ "Executive summaries"
- ❌ "Quick reference guides"
- ❌ "Next steps documents"
- ❌ "Task completion reports"
- ❌ Any other "helpful" documentation not explicitly specified

**Why**: These extras waste context and are not part of the professional workflow.

**What TO deliver**:
- ✅ Task 1: Research document (.md) — **NOTHING ELSE**
- ✅ Task 2: Financial model (.xlsx) — **NOTHING ELSE**
- ✅ Task 3: Valuation analysis (.md) + Excel tabs added to Task 2 file — **NOTHING ELSE**
- ✅ Task 4: Charts zip file (.zip) — **NOTHING ELSE**
- ✅ Task 5: Final report (.docx) — **NOTHING ELSE**

**If a deliverable is not listed above, DO NOT CREATE IT.**

---

## Task Selection

Select which task to execute:

| Task | Name | Prerequisites | Output |
|------|------|--------------|--------|
| **1** | Company Research | In-scope issuer and authorized research sources | Source-supported research document; length follows evidence |
| **2** | Financial Modeling | Authorized statements or user-provided financial files | Auditable Excel model with the six required core tabs |
| **3** | Valuation Analysis | Validated Task 2 model and sourced valuation inputs | Valuation analysis; target/rating only when required inputs are supported |
| **4** | Chart Generation | Tasks 1–3 and available sourced data | Source-supported charts only; no minimum count |
| **5** | Report Assembly | Required artifacts from Tasks 1–4 | Source-grounded DOCX; scope follows evidence, not arbitrary page count |

---

## How to Use This Skill

- **Single-task request:** Execute only the specified task, verify its prerequisites, and retain the ordinary review/continuation behavior.
- **Ambiguous request:** Ask which task the user wants.
- **Explicit unattended full run:** When the user clearly requests all five tasks and says to proceed without follow-up, run Task 1 → Task 2 → Task 3 → Task 4 → Task 5 in order. Do not ask which task to start or ask for per-stage approval. Perform internal review at each gate and stop with `BLOCKED` if an essential prerequisite or permission is absent.

Example full-run instruction: `Complete all five initiating-coverage tasks for [mainland A-share issuer] autonomously, without follow-up questions.` This is workflow authorization only; it does not grant source, data, licensing, credential, publication, or execution permissions.

Task 1 and Task 2 are independently executable, but the unattended full-run order is fixed as above so later stages have their required artifacts. Task 3 requires Task 2; Task 4 requires Tasks 1–3; Task 5 requires all prior required artifacts. Missing optional data may only remove the dependent chart/section where the task reference permits it; missing required data blocks that stage. Never claim a full run or publication-ready report after a blocked stage.

---

## Task 1: Company Research

**Purpose**: Research company's business, management, competitive position, industry, and risks.

**Prerequisites**: Confirmed in-scope issuer identity and actual authorized research sources. A ticker alone does not verify ordinary-share status, source coverage, or data rights. If required sources are not configured/authorized and no user-provided files exist, block the unattended run.

**Process**:
1. Verify company name/ticker provided
2. Load detailed instructions from references/task1-company-research.md
3. Execute qualitative research workflow
4. Deliver research document

**Output**: Source-supported company research document. The upstream word-count and section sizes are guidance, not minimums.
- Company overview/history, products, customers/channels, management and governance where disclosed
- Industry/competitor context and market sizing only when supported by authorized issuer, regulator, exchange, industry-association, or user-provided sources
- Risk assessment with evidence and clear separation of sourced facts from analysis
- Record unavailable biographies, market shares, TAM, and other unsupported facts as `UNSOURCED` / `NOT_CONFIGURED`; do not fill gaps with web searches, inference, or invented detail

**File name**: `[Company]_Research_Document_[Date].md`

**⚠️ DELIVER ONLY THIS 1 FILE. NO completion summaries, no extra documents.**

**Quality requirements**:
- Cover each relevant section to the depth supported by its sources.
- Use only management and competitor facts actually present in authorized sources.
- Avoid minimum biography, competitor, TAM, risk-count, or word-count targets when sources do not support them.
- Preserve balanced analysis and document the limitations.

**Verification before proceeding**: None required for this task.

---

## Task 2: Financial Modeling

**Purpose**: Extract historical financials and build comprehensive Excel financial model with projections and scenarios.

**Prerequisites**: ⚠️ Verify before starting
- **Required**: Financial data for an in-scope mainland A-share ordinary-share issuer from user-provided files or an explicitly available, configured, and authorized `finance_data_query` capability.
  - Do not use SEC/other foreign filing workflows, raw MCP, guessed providers, or web search/fetch.
  - If the required data is unavailable, mark it `UNSOURCED` / `NOT_CONFIGURED` and stop the affected data-dependent step.
- **Optional**: Company research (Task 1) for business context

**Input Verification**:
```
BEFORE STARTING - Select approach:

Option A: Extract financials (most common)
- [ ] Are user-provided financial files available, or is the exact `finance_data_query` source/capability explicitly available, configured, and authorized?
- [ ] Which historical periods are actually present in those sources? Do not invent missing years.

Option B: User provided pre-extracted financials
- [ ] Historical financials file received?
- [ ] Contains income statement, cash flow, balance sheet (3-5 years)?

Optional:
- [ ] Company research (Task 1) complete for context?
```

**Process**:
1. Verify access to financial data
2. Load detailed instructions from references/task2-financial-modeling.md
3. **Step 1**: Extract historical financials (if needed)
4. **Step 2+**: Build projection model with 6 essential tabs
5. Deliver Excel model

**Output**: Auditable Excel Financial Model (.xlsx) with six core tabs:
1. **Revenue Model** — issuer-disclosed product, geography, and channel categories only
2. **Income Statement** — reported historical lines and formula-linked forecasts
3. **Cash Flow Statement** — reported historical lines and formula-linked forecasts
4. **Balance Sheet** — reported historical lines and formula-linked forecasts
5. **Scenarios** — Bull/Base/Bear assumptions, clearly labeled and traceable
6. **DCF Inputs** — sourced or explicitly documented inputs for Task 3

**File name**: `[Company]_Financial_Model_[Date].xlsx`

**⚠️ DELIVER ONLY THIS 1 FILE. NO completion summaries, no extra documents.**

**Quality requirements**:
- Preserve the 3–5 historical-year and five-year forecast scope only when the authorized source coverage supports it; if a required period/statement is absent, stop the affected model and mark it `UNSOURCED` / `NOT_CONFIGURED`.
- Use only disclosed revenue categories; do not invent product/geography rows or force minimum statement line counts.
- Link projections to explicit, auditable assumptions; keep input, formula, and cross-sheet values distinguishable.
- Include all six core tabs, but never fill unsupported cells with placeholder financial data.

**Verification before proceeding to Task 3**:
- [ ] Historical financials extracted (if needed) or provided
- [ ] Excel file created and can be opened
- [ ] Model has all 6 essential tabs (Revenue Model, Income Statement, Cash Flow, Balance Sheet, Scenarios, DCF Inputs)
- [ ] Historical data (3-5 years) incorporated
- [ ] Projections complete (5 years forward)
- [ ] Scenarios complete (Bull/Base/Bear)

---

## Task 3: Valuation Analysis

**Purpose**: Perform comprehensive valuation using DCF, comparables, and precedent transactions.

**Prerequisites**: ⚠️ Verify before starting
- **Required**: Financial model from Task 2
  - Projected income statements
  - Projected cash flows
  - Revenue and EBITDA forecasts
  - DCF inputs (unlevered FCF)

**⚠️ CRITICAL: DO NOT START THIS TASK UNLESS TASK 2 IS COMPLETE**

This task requires the financial model from Task 2. Starting without it will result in incomplete work.

**If Task 2 is incomplete**: Do not proceed or create placeholder valuations. In single-task mode, explain the missing Task 2 artifact and ask whether to complete it first. In an explicitly authorized unattended full run, report `BLOCKED` and stop without asking.

**Input Verification**:
```
BEFORE STARTING:
- [ ] Task 2 complete? (Financial model exists)
- [ ] Model file path/location known?
- [ ] Can access projected financials from model?

Required from model:
- [ ] Projected FCF (5 years)
- [ ] Revenue projections
- [ ] EBITDA projections
- [ ] Terminal year metrics
```

**Process**:
1. Verify financial model is accessible
2. Load detailed instructions from references/task3-valuation.md
3. Execute valuation workflow
4. Deliver valuation analysis

**Output**: Valuation analysis (.md) and supported valuation tabs added to the Task 2 workbook.
- DCF and sensitivity analysis only when model and discount-rate inputs are supported
- Comparable-company analysis using an explicitly justified, source-supported peer set; do not force a peer count
- Precedent transactions or a valuation football field only if authorized inputs are available
- State any price target, recommendation, or upside in CNY and only when share count, current price, and valuation inputs are verified; otherwise mark them `UNSOURCED` / `NOT_CONFIGURED` and block a complete valuation claim
- Key catalysts only when supported by issuer disclosures

**Files**:
- `[Company]_Valuation_Analysis_[Date].md` (written analysis document)
- Excel tabs added to `[Company]_Financial_Model_[Date].xlsx` (from Task 2)
  - DCF tab with calculations
  - Sensitivity analysis tab
  - Comparable companies tab
  - Valuation summary tab

**⚠️ DELIVER ONLY: 1 markdown file + 4 tabs added to existing Excel. NO completion summaries, no extra documents.**

**Quality requirements**:
- Use DCF and sensitivity analysis only when all required model and market inputs are supported.
- Use a justified peer set and show source-backed peer metrics; if comparable inputs are unavailable, say so rather than inventing them.
- Make each assumption, currency, date, and valuation method explicit; do not hardcode a default risk-free rate or WACC.
- Keep the analysis length proportional to the supported evidence; no fixed page minimum.
- Do not state an unsupported price target, recommendation, or upside.

**Verification before proceeding to Task 4**:
- [ ] Price target determined
- [ ] Valuation uses multiple methods (DCF + Comps minimum)
- [ ] DCF sensitivity table complete
- [ ] Comparable companies table includes statistical summary

---

## Task 4: Chart Generation

**Purpose**: Generate financial charts only from available, provenance-traceable source inputs; no fixed count is required.

**Prerequisites**: Verify that Task 1–3 artifacts exist and pass their checks. The individual fields below are required only for the chart that uses them; do not block supported charts because an unrelated optional field is missing.
- Company history, management, products, customers, competitors, and market sizing only where an authorized source supports the corresponding chart.
- Revenue breakdowns, margins, scenarios, DCF sensitivity, comparable-company metrics, and valuation ranges only where the validated Task 2/3 workbook contains supported data.
- Historical market inputs only from user-provided files or an explicitly available, configured, and authorized `finance_data_query` capability. If unavailable, mark `UNSOURCED` / `NOT_CONFIGURED` and omit the dependent chart; do not use another provider or web search/fetch.

**⚠️ CRITICAL: DO NOT START THIS TASK UNLESS TASKS 1, 2, AND 3 ARE COMPLETE**

This task requires outputs from all three previous tasks. Starting without them will result in incomplete charts.

If any required Task 1–3 artifact is missing or invalid, do not generate dependent charts. In single-task mode, explain the missing prerequisite and ask whether to complete it first. In an explicitly authorized unattended full run, return `BLOCKED` and stop without asking. Missing optional market inputs only omit their dependent charts and are marked `UNSOURCED` / `NOT_CONFIGURED`.

Do not fabricate chart inputs. Mark unavailable market fields `UNSOURCED` / `NOT_CONFIGURED`, omit the dependent charts, and explain the resulting scope limitation.

**Input Verification**:
```
BEFORE STARTING:
- [ ] Task 1 complete? (Company research exists)
- [ ] Task 2 complete? (Financial model exists)
- [ ] Task 3 complete? (Valuation analysis exists)
- [ ] Are requested historical market fields present in user files or an authorized `finance_data_query` result? If not, mark them `UNSOURCED` / `NOT_CONFIGURED`.

Required from Task 1:
- [ ] Company history and milestones (for charts 05, 06)
- [ ] Management team structure (for chart 07)
- [ ] Product portfolio details (for chart 08)
- [ ] Customer segmentation data (for chart 09)
- [ ] Competitive landscape analysis (for charts 16, 17, 18)
- [ ] TAM sizing and market data (for chart 15)

Required from Task 2:
- [ ] Revenue by product (historical + projected) - for chart 03 ⭐
- [ ] Revenue by geography (historical + projected) - for chart 04 ⭐
- [ ] Income statement with margins (for charts 02, 10, 11)
- [ ] Cash flow statement (for chart 12)
- [ ] Scenario comparison data (for chart 14)

Required from Task 3:
- [ ] DCF sensitivity matrix - for chart 28 ⭐
- [ ] DCF components (for chart 29)
- [ ] Comparable companies data (for charts 30, 31)
- [ ] Valuation ranges - for chart 32 ⭐

Required market inputs (only if available):
- [ ] Historical stock prices from user files or an authorized query result (for chart 01); otherwise mark `UNSOURCED` / `NOT_CONFIGURED` and omit the dependent chart.
- [ ] Historical valuation multiples from user files or an authorized query result (for chart 34); otherwise mark `UNSOURCED` / `NOT_CONFIGURED` and omit the dependent chart.
```

**Process**:
1. Verify model and valuation outputs are accessible
2. Load detailed instructions from references/task4-chart-generation.md
3. Execute chart generation workflow
4. Package all charts into a zip file
5. Deliver zip file

**Output**: Available source-supported chart files (PNG/JPG) packaged in a zip; no minimum count when source inputs are unavailable.

**Priority chart designs** (only when full inputs are available) ⭐:
- chart_03: Revenue by product (stacked area)
- chart_04: Revenue by geography (stacked bar)
- chart_28: DCF sensitivity (2-way heatmap)
- chart_32: Valuation football field (horizontal bars)

**Chart designs** (produce only when supported by available inputs):
- Investment Summary: chart_01
- Financial Performance: charts 02, 03⭐, 04⭐, 10, 11, 12, 14
- Company 101: charts 05, 06, 07, 08, 09, 15, 16
- Competitive/Market: charts 17, 18
- Scenario Analysis: chart 13
- Valuation: charts 28⭐, 29, 30, 31, 32⭐, 33, 34

**Optional chart designs** (only when supported by available, traceable source data):
- charts 19-27, 35 (customer acquisition, unit economics, product roadmap, etc.)

**IMPORTANT**: Task 5 may embed supported charts near relevant analysis; do not force a chart count or visual density.

**File naming**: `chart_01_description.png`, `chart_02_description.png`, etc.

**Deliverable**: `[A-share issuer]_Charts_[Date].zip` containing supported charts, if any, and chart_index.txt; disclose omitted charts and missing inputs.

**⚠️ DELIVER ONLY THIS 1 ZIP FILE. NO completion summaries, no separate chart lists, no extra documents.**

**Chart quality requirements:**
- ✅ Create only charts backed by available, traceable inputs; no minimum count
- ✅ Include priority chart designs only when all relevant data is available
- ✅ Mark missing inputs `UNSOURCED` / `NOT_CONFIGURED` and omit dependent charts
- ✅ Generate professional-quality, well-formatted charts from provided data
- ✅ Package available charts in a zip with chart index
- ❌ Do not fabricate values or use unsupported market data

**Verification before proceeding to Task 5**:
- [ ] Every included chart has traceable inputs and provenance
- [ ] Unavailable inputs are explicitly marked `UNSOURCED` / `NOT_CONFIGURED`
- [ ] All included charts open and display correctly
- [ ] Charts saved at 300 DPI (print quality)
- [ ] Chart index created listing all files with categories
- [ ] All charts packaged in zip file
- [ ] File naming follows convention: chart_##_description.png

---

## Task 5: Report Assembly

**Purpose**: Write and assemble the comprehensive final DOCX report.

**Prerequisites**: ⚠️ Verify before starting
- **Required**: Source-supported company research from Task 1, with provenance and limitations
- **Required**: Validated Task 2 workbook with available historicals, forecasts, and scenarios
- **Required**: Task 3 valuation analysis using supported methods; a price target/rating is required only when the underlying model and market inputs are authorized and complete
- **Required**: Task 4 chart package/index for charts supported by available source inputs; an empty chart set is not a valid deliverable unless the task explicitly documents why no supported charts can be produced

**Required gate:** Do not start report assembly until the Task 1–4 artifacts required for the requested scope exist and have passed their checks.

If any required artifact or essential input is missing, do not fabricate placeholders or substitute unsourced data. In single-task mode, explain the missing prerequisites and ask whether the user wants to complete them first. In an explicitly authorized unattended full run, return `BLOCKED` with the missing prerequisite and stop without asking. Optional unsupported material may be omitted only where the task references permit it; never call a partial result a complete initiation report.

**Input Verification**:
```
BEFORE STARTING - ALL TASKS MUST BE COMPLETE:

Task 1 Verification:
- [ ] Source-supported company research document exists with provenance and limitations?
- [ ] Management/governance, peer, market-sizing, and risk claims are included only where documented?

Task 2 Verification:
- [ ] Financial model exists and can be opened?
- [ ] Model has projections (5 years)?
- [ ] Scenarios exist (Bull/Base/Bear)?

Task 3 Verification:
- [ ] Valuation analysis complete?
- [ ] Valuation claims use only validated model and market inputs?
- [ ] Price target/recommendation included only if all supporting inputs exist; otherwise limitation is explicit?
- [ ] DCF/comps methods are supported by available inputs, with unavailable methods omitted and disclosed?

Task 4 Verification:
- [ ] Chart zip file exists?
- [ ] Can extract/access all included, source-supported chart files from zip?
- [ ] Priority chart designs included only where source inputs are available?
  - [ ] Revenue by product (stacked area)
  - [ ] Revenue by geography (stacked bar)
  - [ ] DCF sensitivity (heatmap)
  - [ ] Valuation football field
- [ ] Chart files accessible and can be opened?

IF ANY VERIFICATION FAILS: Stop and complete missing task first.
```

**Process**:
1. Verify every required predecessor artifact and the Host-authorized Office/export capability before starting.
2. Load detailed instructions from references/task5-report-assembly.md.
3. Read prior artifacts through the permitted artifact tools; preserve their provenance, units, and limitations.
4. Use only an explicitly available and validated DOCX/XLSX workflow to assemble the report. If that workflow is unavailable, mark `OFFICE_PIPELINE_NOT_CONFIGURED` and stop; do not substitute hand-written text, CSV, or a fake Office binary.
5. Verify the DOCX opens, render/recalculate where the supported Office pipeline permits, then deliver the DOCX.

**Key Principles**:
- Use the runtime's authorized DOCX/XLSX workflow; do not run bundled scripts or invoke generic shell/Python from a restricted Agent role.
- Read the actual prior-task artifacts and preserve their source references and units.
- Place useful, source-supported charts near the relevant analysis; do not force chart density or page coverage.

**Writing Standard**:
- Complete every section that the verified evidence supports; concision is preferable to unsupported repetition.
- Document projection assumptions and Bull/Base/Bear scenarios in proportion to the underlying disclosures and model.
- Include relevant Task 2/3 tables without inventing categories, rows, or unavailable values.
- Use Task 1 material accurately, editing for consistency and report readability rather than copying errors or unsupported claims.
- Use professional, original institutional-style formatting; do not imitate or imply endorsement by a named research firm.

**Never**:
- ❌ Write placeholder prose such as "this section would include" or "charts would be inserted here."
- ❌ Hide missing sources, unsupported assumptions, or data limitations.
- ❌ Claim that a blocked or partial run is complete or publication-ready.
- ❌ Fill page, word, chart, or table targets with fabricated or redundant content.

The report is an internal research draft. Publication, distribution, client communication, trading, and compliance approval remain outside this workflow.

**Output**: Comprehensive Equity Research Report (.docx)

**Specifications**:
- **Length**: Determined by verified source coverage and requested scope; any upstream page/word ranges are planning guidance, not minimums.
- **Charts/tables**: Include only useful, source-supported visuals and tables; no minimum count and no invented rows.
- **Format**: Professional DOCX with source, date, period, currency/unit, and provenance notes. Preserve Chinese names and source terminology where relevant.

**Structure**:
- Investment summary and thesis/risk section
- Company, industry, and competitive context supported by available sources
- Financial analysis, projections, valuation, and assumptions supported by prior task artifacts
- Appendices with sources, definitions, and explicit limitations
- Page numbers and section depth follow the content; do not force page allocation.

**File name**: `[Company]_Initiation_Report_[Date].docx`

**⚠️ DELIVER ONLY THIS 1 DOCX FILE. NO executive summaries, no "highlights" documents, no extra files.**

**Final Verification**:
- [ ] DOCX opens and passes available render/layout checks
- [ ] Included charts and tables are source-supported; no minimum count is imposed
- [ ] Figures cite source/document, date, period, currency/unit, and provenance; missing inputs are marked `UNSOURCED` / `NOT_CONFIGURED`
- [ ] Numbers match the validated financial model, and actuals are distinguished from estimates
- [ ] Report is labeled as an internal research draft and does not imply publication or distribution approval

---

## Input Verification Protocol

### Why Input Verification Matters

Each task has strict prerequisites. Running a task without required inputs will:
- Waste time with incomplete work
- Produce low-quality outputs
- Require rework

**Always verify inputs before starting a task.**

### Verification Checklist by Task

**Task 1**: ✅ No verification needed (independent)

**Task 2**: Check historical financials available

**Task 3**: Check financial model exists and is accessible

**Task 4**: Check both model (Task 2) AND valuation (Task 3) exist

**Task 5**: Check ALL previous tasks complete (1, 2, 3, 4)

### What to Do if Verification Fails

- In single-task mode, explain the missing prerequisite and ask whether the user wants to complete it first.
- In explicit unattended full-run mode, do not ask. Stop at the failed required gate, return `BLOCKED` with the exact missing task/source/permission, and do not create downstream placeholder artifacts.
- Optional unavailable fields may be omitted only where the relevant task reference permits; record those omissions and their impact.

---

## Task Reference Files

Detailed instructions for each task are in separate reference files to keep this skill lean:

- **references/task1-company-research.md** - Company research workflow
- **references/task2-financial-modeling.md** - Financial modeling workflow
- **references/task3-valuation.md** - Valuation methodology
  - Also see: references/valuation-methodologies.md for DCF/comps deep dive
- **references/task4-chart-generation.md** - Chart generation workflow
- **references/task5-report-assembly.md** - Report writing workflow
  - Also see: assets/report-template.md for report structure
  - Also see: assets/quality-checklist.md for quality checks

**When to load reference files**: Load ONLY the reference file associated with the specific task being performed. These files are very large - do not load multiple reference files at once. Read the appropriate task reference file at the start of the task for detailed step-by-step instructions.

---

## Quality Standards

All outputs use professional, original research presentation and meet the requirements supported by the available evidence:

- **Comprehensive**: Cover each required topic or state why it cannot be supported
- **Detailed**: Use specific, sourced facts rather than generic claims
- **Quantified**: Include metrics only with units, period, and provenance
- **Cited**: Record available source/date/period/provenance; missing inputs are explicitly `UNSOURCED` / `NOT_CONFIGURED`
- **Professional**: Clear, consistent, accessible formatting
- **Accurate**: Cross-check key numbers and preserve actual vs. estimate distinctions

---

## Important Notes

### Task Independence

- **Task 1** can run anytime (no dependencies)
- **Task 2** can run anytime (just needs historical data)
- **Tasks 1 & 2** can run in parallel
- **Task 3** requires Task 2
- **Task 4** requires Tasks 2 & 3
- **Task 5** requires Tasks 1, 2, 3, & 4

### Session Management

**Same session**: Outputs automatically available to subsequent tasks

**Different sessions**: Reference previous task outputs explicitly
```
"Use Task 3 with the model from yesterday at [path]"
"Use Task 5 with the research document at [path]"
```

### File Organization

Recommended structure during workflow:
```
ProjectFolder/
├── Task1_Research/
│   └── [Company]_Research_Document.md
├── Task2_Model/
│   └── [Company]_Financial_Model.xlsx
├── Task3_Valuation/
│   └── [Company]_Valuation_Analysis.md
├── Task4_Charts/
│   ├── chart_01.png
│   └── ... (source-supported files)
└── Task5_Report/
    └── [Company]_Initiation_Report.docx
```

### Full-Run Execution

An explicitly authorized unattended full run executes all five tasks in sequence without inter-task questions. It does not bypass input verification, source permissions, internal quality checks, or the blocked-status rule. The default remains one task per request; a full run is not implied by a vague request.

---

## Success Criteria

A successful initiation report workflow should:
1. Complete all five tasks in order without any failed required gate
2. Verify every input and source permission used
3. Produce each required deliverable with source-supported content
4. Cross-check key numbers, units, periods, and assumptions across outputs
5. Explicitly identify optional omissions and limitations
6. Label the result as an internal draft; publication readiness requires separate review and authorization

**Output quality**: Professional, evidence-based, and auditable
**Use case**: First-time coverage research for an in-scope mainland A-share ordinary-share issuer
