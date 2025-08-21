# Agent Coordination Plan - Content Implementation Session
**Session Date:** 2025-07-26  
**Session Goal:** Implement Epics 3, 4, and 5 (10 content articles) in parallel

## Project State Assessment
- **Hugo Foundation:** COMPLETE ✅ (builds in 23ms, templates ready)
- **Article Infrastructure:** COMPLETE ✅ (KaTeX, shortcodes, navigation)
- **Content Status:** EMPTY (need all 10 articles)
- **Tools Status:** NONE (future implementation)

## Parallel Execution Strategy

### Phase 1: P0 Articles (High Priority)
**Agent A - Content Specialist (Concepts)**
- BUFO-008: Understanding Opportunity Cost (2,000+ words, calculator)
- BUFO-009: Paycheck Allocation Strategies (flowchart, examples)

**Agent B - Content Specialist (Strategies)**  
- BUFO-011: Why SGOV Beats Your HYSA (tax calcs, yield calculator)

### Phase 2: P1 Articles (Normal Priority)
**Agent C - Content Specialist (Mixed)**
- BUFO-010: Why Tracking Wealth Matters (tool comparison)
- BUFO-012: The CD Myth (opportunity cost analysis)

**Agent D - Content Specialist (Optimization)**
- BUFO-013: Credit Card Optimization Guide (category analysis)

### Phase 3: P2/P3 Articles (Low Priority)
**Agent E - Content Specialist (Advanced)**
- BUFO-014: Portfolio Lines of Credit (securities lending)
- BUFO-015: Leveraged ETF Strategies (volatility drag math)

**Agent F - Content Specialist (Advanced)**
- BUFO-016: Roth vs HSA vs 401(k) Prioritization (decision flowchart)
- BUFO-017: Margin Leverage Explained (portfolio margin vs Reg T)

## File Ownership Boundaries

### Agent A (Concepts)
- `content/articles/concepts/opportunity-cost.md`
- `content/articles/concepts/paycheck-allocation.md`

### Agent B (Strategies - SGOV)
- `content/articles/strategies/sgov-vs-hysa.md`

### Agent C (Mixed Topics)
- `content/articles/concepts/tracking-wealth.md`
- `content/articles/strategies/cd-myths.md`

### Agent D (Optimization)
- `content/articles/strategies/credit-optimization.md`

### Agent E (Advanced 1)
- `content/articles/advanced/portfolio-loans.md`
- `content/articles/advanced/leveraged-etfs.md`

### Agent F (Advanced 2)
- `content/articles/advanced/account-prioritization.md`
- `content/articles/advanced/margin-strategies.md`

## Content Standards & Interfaces

### Article Frontmatter Template
```yaml
---
title: "Article Title"
date: 2025-07-26
draft: false
categories: ["Concepts"|"Strategies"|"Advanced"]
tags: ["tag1", "tag2"]
math: true
summary: "Brief description for listings"
weight: 10
---
```

### Required Elements
1. **Word Count**: 1,500-3,000 words per article
2. **Math Formulas**: Use KaTeX syntax `$$formula$$` for display, `$formula$` inline
3. **Terminal Displays**: Use shortcodes:
   - `{{< terminal >}}` for command-line style
   - `{{< formula >}}` for highlighted equations
   - `{{< calculation >}}` for worked examples
   - `{{< note >}}` for important callouts
4. **Examples**: Use percentages, not dollar amounts
5. **Cross-linking**: Link to related articles when relevant

### No External Dependencies
- All content self-contained
- No API calls or external data
- Interactive calculators to be added later
- Use static examples for now

## Quality Gates
- Hugo builds without errors
- All math formulas render correctly
- Links work (internal only for now)
- Mobile responsive (handled by existing CSS)
- All acceptance criteria from feature backlog met

## Communication Protocol
- Each agent updates their individual progress file
- Report completion status and any blockers
- Final integration will be coordinated by project manager

## Success Criteria
- All 10 articles written and published
- Feature backlog updated with completion status
- Hugo builds successfully with all content
- Next phase ready (tool development)