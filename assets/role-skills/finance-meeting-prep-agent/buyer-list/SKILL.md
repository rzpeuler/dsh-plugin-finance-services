---
name: buyer-list
description: Build and organize a universe of potential acquirers for sell-side M&A processes. Identifies strategic and financial buyers, assesses fit, and prioritizes outreach. Use when preparing for a sell-side mandate, building a buyer universe, or evaluating potential partners. Triggers on "buyer list", "buyer universe", "potential acquirers", "who would buy this", "strategic buyers", or "financial sponsors".
---

> **DSH FINANCIAL SERVICES ADAPTATION — LOW-PRIVILEGE / P2**
> Original SKILL.md SHA-256: `df6875147c70fc987f500c04d3743302a29ec6d97beead3c85f1b09bd8677b96`; complete source directory archived under `source-archive/plugins/vertical-plugins/investment-banking/skills/buyer-list`.
> Asset status: **PRESERVED_SOURCE_ASSETS**. Missing templates BLOCK only their original template-dependent routes; ask for the real user template, never fabricate it.
> No generic shell, CMA/Claude Managed Agents API, Office JS/live-document API, arbitrary MCP tool, package installation, publication, client communication, formal ledger posting, trading, funds movement, or compliance sign-off is authorized by this text. Skill access never grants tools or data permissions. Runtime capability availability overrides upstream examples. Commercial data is NOT_CONFIGURED until P3 registers and authorizes an appropriate adapter; never fabricate a provider response or treat public web search as equivalent to KYC/NAV/consensus. Office/script execution and external /mnt paths, recalc.py and other platform runtimes require P4 adaptation; do not execute bundled source scripts from a role. Preserve all business checks and review requests; P2 carries prompt-level reviews only, NOT a P5 deterministic enforced Gate. Workers return review requests to their main/Host, never ask users directly. Inputs and installed assets are read-only; designated writers alone may write new files within the runtime-assigned financial artifact directory, never replace user originals. Do not assume ./out or an open Office document. The runtime assigns the financial artifact directory for each session/run (normally <workspace>/financial-services/artifacts/<session-id>/); request it if absent. Do not invent an API to allocate it.



# Buyer List

## Workflow

### Step 1: Understand the Target

- Company description, sector, and business model
- Revenue, EBITDA, and growth profile
- Key assets and capabilities (IP, customer relationships, geographic footprint, team)
- Expected valuation range
- Seller preferences (strategic vs. financial, management continuity, timeline)

### Step 2: Strategic Buyers

Identify strategic acquirers across categories:

**Direct Competitors**
- Companies in the same space that would gain market share
- Rationale: Revenue synergies, eliminate competitor, scale

**Adjacent Players**
- Companies in adjacent markets that could expand into the target's space
- Rationale: Product extension, cross-sell, new market entry

**Vertical Integrators**
- Customers or suppliers that could integrate vertically
- Rationale: Supply chain control, margin capture, strategic lock-in

**Platform Builders**
- Large companies building a platform in the space through M&A
- Rationale: Tuck-in acquisition, fill capability gap

For each strategic buyer, assess:

| Buyer | Sector | Revenue | Strategic Fit | Financial Capacity | M&A Track Record | Likelihood | Priority |
|-------|--------|---------|--------------|-------------------|------------------|------------|----------|
| | | | High/Med/Low | | Active/Moderate/None | | A/B/C |

### Step 3: Financial Sponsors

Identify PE/financial buyers:

**Platform Investors**
- Sponsors looking for a new platform in this sector
- Criteria: Fund size, sector focus, deal size range

**Add-on Buyers**
- Sponsors with existing portfolio companies that could acquire the target as a bolt-on
- Identify the specific portfolio company and synergy rationale

**Growth Equity**
- For earlier-stage or high-growth targets
- Minority vs. majority preference

For each sponsor:

| Sponsor | Fund Size | Sector Focus | Portfolio Overlap | Recent Activity | Priority |
|---------|-----------|-------------|-------------------|-----------------|----------|
| | | | | | A/B/C |

### Step 4: Prioritization

Tier the buyer list:

- **Tier 1 (5-10)**: Highest strategic fit, proven acquirers, clear rationale — contact first
- **Tier 2 (10-15)**: Good fit but less obvious — contact in second wave
- **Tier 3 (10-20)**: Possible but lower probability — contact if process needs broadening

### Step 5: Contact Mapping

For each Tier 1 buyer:
- Key decision maker (CEO, Corp Dev head, Partner)
- Relationship status (existing relationship, cold outreach, need introduction)
- Known preferences or constraints (size, geography, structure)
- Best approach channel

### Step 6: Output

- Excel workbook with:
  - Strategic buyers tab (sorted by tier)
  - Financial sponsors tab (sorted by tier)
  - Contact mapping for Tier 1
  - Summary statistics (total buyers by tier, by type)
- One-page buyer universe summary for the engagement letter or pitch

## Important Notes

- Quality over quantity — a focused list of 30-40 well-researched buyers beats a list of 200 names
- Research recent M&A activity — buyers who just did a deal in the space are either hungry for more or tapped out
- Check for antitrust concerns with direct competitors — flag any that might face regulatory issues
- Financial sponsors: check fund vintage and deployment pace — a fund nearing end of investment period may be more motivated
- Always ask the seller if there are buyers they want included or excluded
- Update the list as the process progresses — move buyers between tiers based on feedback
