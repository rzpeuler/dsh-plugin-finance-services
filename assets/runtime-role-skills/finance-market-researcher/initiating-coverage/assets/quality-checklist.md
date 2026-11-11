# Initiating Coverage Quality Gate

Use this checklist at stage transitions and before final delivery. In an explicitly authorized unattended full run, a failed required gate returns `BLOCKED` without a follow-up question. Do not call a partial run complete.

## Global Source and Permission Gate

- [ ] Issuer identity, exchange, and ordinary-share status are confirmed by an authorized source; a ticker pattern alone is insufficient.
- [ ] Every data source used is explicitly selected and authorized for the relevant fields, market, history, local caching, model processing, and session logging.
- [ ] No `TEST_ONLY` adapter, POC sample, synthetic value, raw MCP, web search/fetch, guessed provider, or external credential is used.
- [ ] Source, retrieval date, reporting period, currency/unit, accounting basis, provenance, and available PIT/revision evidence are retained.
- [ ] Missing fields are marked `UNSOURCED` / `NOT_CONFIGURED`; no unsupported content is added to hit page, word, chart, table, peer, or risk-count targets.
- [ ] Unsupported history is not presented as point-in-time; `current_only` is never labeled historical PIT.

## Task 1 — Company Research

- [ ] Research document exists and uses only user-provided or explicitly authorized source material.
- [ ] Business, management/governance, industry, competitors, market sizing, and risks are included only to the depth supported by sources.
- [ ] Facts, issuer statements, and analyst interpretations are distinguishable and cited.
- [ ] No biographies, peer counts, TAM, market share, or risk quantities are inferred to satisfy a template.

## Task 2 — Financial Model

- [ ] Workbook opens and contains the six core tabs: Revenue Model, Income Statement, Cash Flow Statement, Balance Sheet, Scenarios, and DCF Inputs.
- [ ] Historical statements use reported values, periods, units, accounting basis, and scope; available history matches the source (target 3–5 years where available).
- [ ] Forecast horizon and scenario assumptions are explicit, formula-linked, and auditable (target five years when the required inputs support it).
- [ ] Revenue categories are only those disclosed; no fabricated product, geography, or channel rows.
- [ ] Formula links, balance checks, units, signs, and source references are validated; unsupported cells are not populated with placeholders.

## Task 3 — Valuation

- [ ] Valuation uses the validated Task 2 model and authorized, dated market/peer inputs.
- [ ] A complete valuation includes both DCF and trading comps; if either method cannot be supported, mark the stage incomplete and block a full-run claim.
- [ ] Peer rationale, definitions, currency/unit, date, and source provenance are recorded; no fixed peer count or unreliable statistics are forced.
- [ ] Discount-rate components, terminal assumptions, weighting, and scenario ranges are documented; no generic WACC, risk-free-rate, or premium is assumed.
- [ ] Price target, recommendation, and upside appear only when current price, shares, debt/cash, and all valuation inputs are verified.
- [ ] Precedent transactions are included only when authorized transaction data is available.

## Task 4 — Charts

- [ ] Every included chart is an actual image generated from validated, traceable input data.
- [ ] Each chart has a clear title, units, period, and source/provenance note.
- [ ] Missing chart inputs are marked and dependent charts omitted; no minimum chart count applies.
- [ ] Chart files open correctly and the package index matches its contents.

## Task 5 — Final DOCX

- [ ] All required Task 1–4 deliverables exist and pass their checks.
- [ ] An authorized DOCX/XLSX workflow is available; no generic shell or unsupported file-generation path was used.
- [ ] DOCX opens and passes the available render/layout validation; spreadsheet formulas are recalculated/checked where supported.
- [ ] All tables/charts are source-supported, correctly labeled, and consistent with the workbook and prior-stage materials.
- [ ] The report states its as-of date, scope, assumptions, provenance, and limitations; no fabricated rating or target is shown.
- [ ] Report is labeled an internal research draft. Publication, distribution, client communication, trading, and compliance approval remain outside this workflow.

## Cross-Stage Consistency and Deliverables

- [ ] Entity, periods, currencies, units, and actual/estimate labels are consistent across all artifacts.
- [ ] Key reported and projected values match between DOCX, valuation analysis, and model.
- [ ] Exactly the specified task outputs are delivered: Task 1 research `.md`; Task 2 model `.xlsx`; Task 3 valuation `.md` plus updated model; Task 4 chart `.zip`; Task 5 final `.docx`.
- [ ] No blocked, partial, or source-limited run is described as a complete initiation report.
