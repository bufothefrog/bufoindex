# BufoIndex Design System
## Financial Terminal for Everyone

### Brand Identity
**Mission**: Bridge the gap between basic financial advice and sophisticated strategies used by wealthy individuals through transparent documentation and interactive tools.

**Target Audience**: Young professionals (25-35) with $80k-200k income who are already saving 20-50% and seeking strategies beyond "index and chill" for aggressive wealth accumulation.

---

## Visual Identity

### Color Palette (From PRD)

```css
/* Core Brand Colors */
--sage-green: #7FB069;      /* Primary - subtle Bufo reference */
--terminal-black: #0A0E1A;  /* Tool backgrounds */
--terminal-green: #00FF41;  /* Positive values, data highlights */
--monospace-accent: #FFB86C; /* Highlighted data */

/* Light Theme */
--bg-light: #FAFAF9;        /* Article background */
--text-light: #1A202C;      /* Primary text */
--border-light: #E5E7EB;    /* Subtle borders */

/* Dark Theme */
--bg-dark: #0A0E1A;         /* Terminal black */
--text-dark: #E4E4E7;       /* Light gray text */
--border-dark: #374151;     /* Subtle borders */
```

### Typography System (From PRD)

#### Articles - Academic Paper Aesthetic
```css
/* Body Text */
font-family: 'Charter', 'Crimson Pro', 'Georgia', serif;
font-size: 1.125rem;
line-height: 1.75;
max-width: 65ch;  /* Comfortable reading */

/* Headers */
h1 { font-size: 2.5rem; font-weight: 700; }
h2 { font-size: 2rem; font-weight: 600; }
h3 { font-size: 1.5rem; font-weight: 600; }
```

#### Tools & Data - Terminal Style
```css
/* Data Display */
font-family: 'IBM Plex Mono', 'Fira Code', monospace;
font-size: 0.875rem;
letter-spacing: -0.025em;

/* Terminal Headers with Prefixes */
.terminal-title::before { content: "> "; color: var(--terminal-green); }
.terminal-desc::before { content: "\\ "; color: var(--sage-green); }
```

### LaTeX-Style Mathematical Formulas
```
/* KaTeX Integration for Articles */
.katex-display {
  margin: 2rem 0;
  overflow-x: auto;
}

/* Inline math */
.katex {
  font-size: 1.1em;
}
```

---

## UI Components

### Navigation (Fixed Header)
```
BUFO >>> CONCEPTS  STRATEGIES  ADVANCED  TOOLS  ABOUT
```

### Homepage Layout
```
+--------------------------------------------------+
|  Bridging Basic Advice & Wealth Strategies       |
|                                                  |
|  > TRANSPARENT DOCUMENTATION                     |
|  \\ Real portfolio decisions with percentages   |
|                                                  |
|  > INTERACTIVE CALCULATORS                       |
|  \\ Model leveraged strategies & optimization   |
|                                                  |
|  [EXPLORE CONCEPTS]    [VIEW TOOLS]             |
+--------------------------------------------------+
```

### Article Components

#### Terminal-Style Callout Boxes
```
╔═══ KEY CONCEPT ════════════════════════════════╗
║ > OPPORTUNITY COST                             ║
║ \\ Every dollar has alternative uses          ║
║                                                ║
║ Formula: OC = Return_best - Return_chosen     ║
╚════════════════════════════════════════════════╝
```

#### Python Calculation Display
```python
# PAYCHECK ALLOCATION CALCULATOR
def allocate_paycheck(gross_income, fixed_costs):
    """Calculate optimal allocation percentages"""
    disposable = gross_income - fixed_costs
    savings_rate = disposable / gross_income
    return {
        'fixed': (fixed_costs / gross_income) * 100,
        'savings': savings_rate * 100,
        'flex': 100 - ((fixed_costs / gross_income) * 100) - (savings_rate * 100)
    }

# Example with $8,000 monthly income
>>> allocate_paycheck(8000, 3200)
{'fixed': 40.0, 'savings': 50.0, 'flex': 10.0}
```

#### Data Tables (Bloomberg Terminal Style)
```
┌─ SGOV vs HIGH-YIELD SAVINGS ──────────────────┐
│ METRIC          │ SGOV    │ HYSA    │ DELTA  │
│ ────────────────┼─────────┼─────────┼─────── │
│ Pre-Tax Yield   │ 5.25%   │ 4.50%   │ +0.75  │
│ Tax Rate (32%)  │ 15.00%  │ 32.00%  │ -17.00 │
│ After-Tax       │ 4.46%   │ 3.06%   │ +1.40  │
│ Liquidity       │ T+1     │ Instant │ -1 day │
└────────────────────────────────────────────────┘
```

---

## Tool Specifications

### Credit Card Optimizer
```
╔═══ CREDIT CARD OPTIMIZER ══════════════════════╗
║ > OPTIMIZE YOUR WALLET                         ║
║ \\ Find the perfect card combination           ║
║                                                ║
║ MONTHLY SPENDING                               ║
║ ├─ Groceries:    $ [500    ]                  ║
║ ├─ Dining:       $ [300    ]                  ║
║ ├─ Travel:       $ [200    ]                  ║
║ ├─ Gas:          $ [150    ]                  ║
║ └─ Other:        $ [1000   ]                  ║
║                                                ║
║ Annual Fee Tolerance: [●──────] $95           ║
║ Preference: [Cash Back] [Travel]              ║
║                                                ║
║ [CALCULATE OPTIMAL CARDS]                      ║
║                                                ║
║ >> RECOMMENDATIONS:                            ║
║ 1. Chase Freedom Unlimited (1.5% base)        ║
║ 2. Citi Custom Cash (5% on groceries)        ║
║ Annual Value: $486 | Fees: $0 | Net: $486    ║
╚════════════════════════════════════════════════╝
```

### Rent vs Buy Calculator (Completed)
```
┌─ RENT VS BUY ANALYZER ────────────────────────┐
│ > COMPARE LONG-TERM WEALTH OUTCOMES           │
│ \\ Based on PWL Capital's 5% Rule             │
│                                                │
│ PROPERTY DETAILS                              │
│ Purchase Price:  $ [500,000]                  │
│ Monthly Rent:    $ [2,500  ]                  │
│ Down Payment:    [20]% = $100,000             │
│                                                │
│ ASSUMPTIONS                                   │
│ Mortgage Rate:   [6.5  ]%                     │
│ Stock Returns:   [8.0  ]%                     │
│ Property Tax:    [1.2  ]%                     │
│ Time Horizon:    [10   ] years                │
│                                                │
│ [ANALYZE SCENARIOS]                           │
│                                                │
│ >> NET WORTH AFTER 10 YEARS:                  │
│ Renting + Investing: $287,432                 │
│ Buying Property:     $251,893                 │
│ \\ Renting wins by $35,539 (+14.1%)          │
└────────────────────────────────────────────────┘
```

### Retirement Planning Dashboard (In Progress)
```
╔═══ RETIREMENT PLANNING DASHBOARD ══════════════╗
║ > MODEL YOUR FINANCIAL INDEPENDENCE            ║
║ \\ Compare 3 scenarios with Monte Carlo        ║
║                                                ║
║ SCENARIO A │ SCENARIO B │ SCENARIO C          ║
║ ───────────┼────────────┼───────────          ║
║ Retire: 45 │ Retire: 55 │ Retire: 65          ║
║ Income: 80k│ Income: 80k│ Income: 80k         ║
║ Success:92%│ Success:98%│ Success:99%         ║
║                                                ║
║ [CONFIGURE DETAILS] [RUN SIMULATION]          ║
╚════════════════════════════════════════════════╝
```

---

## Article Categories & Navigation

### Category Structure (From Information Architecture)
```
/concepts/
  ├── opportunity-cost/
  ├── paycheck-allocation/
  └── tracking-wealth/

/strategies/
  ├── sgov-vs-hysa/
  ├── credit-optimization/
  └── cd-myths/

/advanced/
  ├── portfolio-loans/
  ├── leveraged-etfs/
  ├── margin-strategies/
  └── roth-vs-hsa-vs-401k/
```

### Article Navigation Components
```
← Back to Concepts | Reading Time: 12 min

[1 of 3] ●──○──○ in Foundational Concepts

NEXT: Paycheck Allocation Strategies →
```

---

## Mobile Adaptations

### Responsive Breakpoints
- Desktop: 1024px+ (full terminal displays)
- Tablet: 768px-1023px (simplified tables)
- Mobile: <768px (stacked layouts)

### Mobile Tool Interface
```
┌─────────────────┐
│ > QUICK CALC    │
│ \\ Opportunity  │
│                 │
│ Option A Return │
│ [7.5]%          │
│                 │
│ Option B Return │
│ [5.0]%          │
│                 │
│ [CALCULATE]     │
│                 │
│ Cost: 2.5%/year │
└─────────────────┘
```

---

## Implementation Guidelines

### CSS Architecture
```scss
// Tailwind config extension
module.exports = {
  theme: {
    extend: {
      colors: {
        'bufo-sage': '#7FB069',
        'terminal': {
          'black': '#0A0E1A',
          'green': '#00FF41',
          'accent': '#FFB86C'
        }
      },
      fontFamily: {
        'article': ['Charter', 'Crimson Pro', 'serif'],
        'mono': ['IBM Plex Mono', 'Fira Code', 'monospace']
      }
    }
  }
}
```

### Component Patterns
```html
<!-- Article Callout -->
<div class="terminal-box">
  <h3 class="terminal-title">Key Formula</h3>
  <p class="terminal-desc">Understanding compound growth</p>
  <div class="formula">
    FV = PV × (1 + r)^n
  </div>
</div>

<!-- Tool Input -->
<div class="tool-input-group">
  <label class="terminal-title">Monthly Investment</label>
  <span class="terminal-desc">Amount to invest each month</span>
  <input type="number" class="terminal-input" value="500">
</div>
```

### Print Styles
```css
@media print {
  .terminal-box {
    border: 1px solid #000;
    background: white;
  }
  
  .no-print {
    display: none;
  }
  
  article {
    max-width: 100%;
    font-size: 11pt;
  }
}
```

---

## Content Voice & Style

### Writing Principles
- **Sophisticated but accessible**: Explain complex strategies clearly
- **Data-driven**: Support all claims with calculations
- **Percentage-based**: Never use personal dollar amounts
- **Action-oriented**: Focus on what readers can implement

### Example Transformations
❌ "Save 20% of your income"
✅ "> OPTIMIZE YOUR SAVINGS RATE
   \\ Why 20% is just the starting point"

❌ "Index funds are good investments"
✅ "> EXPENSE RATIOS COMPOUND NEGATIVELY
   \\ 0.75% fees cost you 24.5% over 30 years"

---

## Performance Requirements

### Static Site Goals
- Page load: <2s on 3G
- Tool calculations: <50ms response
- PageSpeed score: 95+
- No external API calls for tools
- Weekly data updates via GitHub Actions

### Accessibility Standards
- WCAG 2.1 AA compliance
- Keyboard navigation for all tools
- Screen reader optimized
- High contrast terminal theme works for accessibility

---

This design system fully aligns with your PRD specifications while maintaining the sophisticated "Financial Terminal for Everyone" aesthetic that appeals to your target audience of optimization-focused young professionals.