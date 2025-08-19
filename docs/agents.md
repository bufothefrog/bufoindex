# BufoIndex AI Agent Development Guide

## FOR AI PROJECT MANAGER
This guide is for Claude Code acting as a project manager spawning child agents. **Always use parallel agents when possible.** Only use sequential execution when dependencies absolutely require it.

### Project Manager Workflow
1. **EVALUATE** - Read all documentation and assess current state
   - Pay special attention to previous agent communication files
   - Look for patterns of what has failed before
   - Identify recurring issues that need different approaches
2. **PLAN** - Identify parallel execution opportunities
3. **DEFINE** - Create clear task boundaries and contracts
4. **SPAWN** - Launch multiple agents simultaneously
5. **MONITOR** - Track progress via `/agent-communication/`
6. **INTEGRATE** - Coordinate handoffs and resolve conflicts
7. **DOCUMENT** - Update feature backlog with completion status

### Initial Project Evaluation (DO THIS FIRST - NEVER SKIP)
Before spawning any agents, thoroughly assess the project. This prevents duplicate work, identifies critical issues, and enables effective parallelization.

```bash
# 1. Check project structure and health
ls -la
hugo version
cat hugo.toml || cat config.toml  # Check Hugo config

# 2. Read current project status  
cat docs/prd.md                    # Project vision and requirements
cat docs/feature-backlog.md        # Feature statuses (NOT STARTED/IN PROGRESS/COMPLETED)
ls -la docs/agents/agent-communication/  # Ongoing work

# 3. Evaluate codebase state
find content -type f -name "*.md" | wc -l        # Article count
find static/js -type f -name "*.js" | wc -l      # Tool count
find layouts -type f -name "*.html" | wc -l      # Template count
grep -r "TODO\|FIXME\|XXX" --include="*.md" --include="*.js" --include="*.html" | wc -l  # Tech debt

# 4. Check build status
hugo --gc --minify                # See if site builds
ls -la public/                     # Check generated files

# 5. Identify integration gaps
# - Which articles are written but lack tools?
# - Which tools are built but not linked from articles?  
# - Which features are in backlog but partially started?
# - What's in navigation but not implemented?
```

### Planning Questions to Answer
- [ ] Which tasks are truly independent? (Most are!)
- [ ] What's partially built that needs completion? (Highest priority!)
- [ ] What's the current blocker preventing progress?
- [ ] Which features can be built entirely in parallel?
- [ ] Where are the integration points between agents?
- [ ] What contracts/interfaces need pre-definition?
- [ ] Are there any failing builds or broken links to fix first?

### Example: Post-Evaluation Parallel Plan
```markdown
# After evaluating project state:

## Current Status
- Site Foundation: NOT STARTED
- Article Template: NOT STARTED
- Opportunity Cost Article: NOT STARTED
- Credit Card Tool: NOT STARTED

## Priority Order (Fix broken before building new)
1. CRITICAL - Fix any build failures FIRST
2. IN PROGRESS - Complete partially built features  
3. NOT STARTED - Start new features in parallel

## Parallel Execution Plan (4 agents)
1. Frontend Agent A: Setup Hugo site and Tailwind (BUFO-001, BUFO-002)
2. Frontend Agent B: Create article template with KaTeX (BUFO-005)
3. Content Agent C: Write first article draft (BUFO-008)
4. DevOps Agent D: Setup GitHub Actions deployment (BUFO-003)

## Pre-defined Contracts
- Article frontmatter format (defined in PRD)
- Tailwind color palette (sage green #7FB069)
- All agents use docs/feature-backlog.md task IDs
```

### Task Prioritization Rules
1. **CRITICAL** - Broken builds, non-rendering pages, deployment failures
2. **IN PROGRESS - HIGH** - Partially complete features (articles without tools, etc.)
3. **NOT STARTED - NORMAL** - New features that can be built in parallel
4. **COMPLETED - LOW** - Enhancements to completed features

**Always complete higher priority work first, but use parallel agents within each priority level.**

## CRITICAL CONTEXT

**Project:** BufoIndex - Personal Finance Education Platform  
**Stack:** Hugo Static Site + Tailwind CSS + Vanilla JS + GitHub Pages  
**Current Release:** Check `docs/feature-backlog.md` for latest status

### Non-Negotiable Requirements
- [ ] Static site only - no backend servers
- [ ] Performance: <2s page load on 3G
- [ ] Terminal aesthetics for data/calculations  
- [ ] All tools work without JavaScript frameworks
- [ ] Test all calculations manually
- [ ] Mobile responsive design
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] No monetization or tracking

## HUGO ARCHITECTURE PRINCIPLES

**MANDATORY:** This is a Hugo static site. All agents must understand Hugo's structure:

### Directory Structure
```
content/                    # Markdown articles
├── concepts/              # Foundational articles
├── strategies/            # Intermediate articles  
└── advanced/              # Advanced articles

layouts/                   # Hugo templates
├── _default/             # Default layouts
├── partials/             # Reusable components
└── shortcodes/           # Content embeds

static/                    # Static assets
├── css/                  # Compiled CSS
├── js/                   # JavaScript tools
└── data/                 # JSON data files

assets/                    # Source files
└── css/                  # Tailwind source

data/                      # Hugo data files
└── tools/                # Tool configurations
```

### Content Creation Rules
1. **Articles** go in `content/` as Markdown with frontmatter
2. **Templates** go in `layouts/` as HTML with Go templating
3. **Tools** go in `static/js/` as vanilla JavaScript
4. **Styles** use Tailwind classes only, no custom CSS
5. **Data** updates via GitHub Actions to `static/data/`

## BEFORE YOU START - MANDATORY CHECKS

### Read First
- [ ] `docs/prd.md` - Understand project vision and requirements
- [ ] `docs/feature-backlog.md` - See what's already planned
- [ ] `docs/agents/agent-communication/` - Check ongoing agent work
- [ ] Check existing code in `content/`, `layouts/`, `static/` - Don't recreate

### Verify Environment
```bash
hugo version  # Ensure Hugo is available
ls -la content/  # Check existing content
ls -la layouts/  # Check existing templates
cat hugo.toml || cat config.toml  # Review configuration
```

### Common Failures to Avoid
- ✗ Hardcoded colors → Use Tailwind classes from config
- ✗ Complex JavaScript → Keep tools simple and vanilla
- ✗ Missing frontmatter → All articles need proper metadata
- ✗ Forgetting mobile → Test responsive design
- ✗ Not linking → Update navigation and cross-links

## DEVELOPMENT WORKFLOW

### Step 1: UNDERSTAND THE TASK
- [ ] What specific feature am I building? (Check BUFO-XXX in backlog)
- [ ] What similar code already exists? (Check existing files)
- [ ] What are the acceptance criteria from feature-backlog.md?
- [ ] Do I need to coordinate with other agents?

### Step 2: BUILD INCREMENTALLY WITH TESTING
```bash
# Article Development
1. Create content file: content/{section}/{slug}.md
2. Add frontmatter with title, date, description
3. Write content with KaTeX math where needed
4. Test locally: hugo server -D
5. Verify rendering and math formulas

# Tool Development  
1. Create tool file: static/js/{tool-name}.js
2. Write vanilla JavaScript (no frameworks)
3. Create test page to verify calculations
4. Add URL hash persistence
5. Test on mobile devices
```

### Step 3: CONNECT TO APPLICATION (CRITICAL)
Article Integration:
- [ ] Add to appropriate section in `content/`
- [ ] Update navigation menu if needed
- [ ] Cross-link from related articles
- [ ] Verify in `hugo server` output

Tool Integration:
- [ ] Link from relevant articles
- [ ] Add to tools index page
- [ ] Include usage instructions
- [ ] Test state persistence via URL hash

### Step 4: VALIDATE BEFORE HANDOFF
```bash
# Automated Checks
hugo --gc --minify  # Build should succeed
ls -la public/  # Verify output generated

# Manual Verification
- [ ] Content renders correctly
- [ ] Math formulas display properly
- [ ] Tools calculate accurately
- [ ] Mobile layout works
- [ ] Links are not broken
```

## MULTI-AGENT COORDINATION (AI PROJECT MANAGER)

### Complete Workflow
```
1. EVALUATE (15-30 min)
   ├─ Read all documentation
   ├─ Check Hugo build
   ├─ Identify incomplete work
   └─ Document assessment

2. PRIORITIZE (5-10 min)
   ├─ CRITICAL - Fix broken builds first
   ├─ IN PROGRESS - Complete partial features
   └─ NOT STARTED - Plan new features

3. PARALLELIZE (5 min)
   ├─ Define task boundaries
   ├─ Create file ownership
   └─ Assign agent roles

4. EXECUTE (Parallel)
   ├─ Spawn 3-4 agents
   ├─ Monitor via docs
   └─ Coordinate integration

5. REVIEW & DOCUMENT (10-15 min)
   ├─ Verify all agent deliverables
   ├─ Test full site build
   ├─ Update feature-backlog.md with NOT STARTED/IN PROGRESS/COMPLETED status
   └─ Create completion summary
```

### Post-Execution Documentation (REQUIRED)
After all agents complete their tasks and you've verified the work:

**Why This Matters:** The feature backlog is the single source of truth for project progress. Future agents and project managers rely on accurate status updates to avoid duplicate work and understand what's available to build upon.

1. **Update Feature Backlog Status**
```markdown
# In docs/feature-backlog.md, update each completed feature:
s
### BUFO-001: Initialize Hugo Site
**Priority:** P0  
**Effort:** Small  
**Status:** COMPLETED (was NOT STARTED)
**Completed:** 2025-01-26
**Acceptance Criteria:**
- [x] Hugo installed and configured
- [x] Custom theme scaffolding created
- [x] GitHub repository structured properly
- [x] Basic .gitignore configured
**Implementation Notes:** Hugo site initialized with custom theme, Tailwind configured

# Status Key:
# NOT STARTED
# IN PROGRESS  
# COMPLETED
```

2. **Create Completion Summary**
```markdown
# In docs/agents/agent-communication/completion-summary-[date].md

## Release Session Summary - [Date]

### Features Completed
- Hugo Site Setup: COMPLETED (BUFO-001, BUFO-002)
- Article Template: COMPLETED (BUFO-005)
- First Article Draft: IN PROGRESS (BUFO-008 - needs review)

### Technical Achievements
- Hugo builds successfully
- Tailwind configured with custom colors
- GitHub Actions ready for deployment
- KaTeX integrated for math rendering

### Outstanding Items
- Article needs final review and images
- Navigation menu needs updating
- Credit card tool pending

### Metrics
- Agents spawned: 4
- Parallel execution time: 2 hours
- Sequential time saved: ~5 hours
- Features completed: 2.5 (out of 3 attempted)
```

### Parallel Execution Strategy
As an AI project manager, your primary goal is to maximize parallel execution:
1. **Analyze tasks** for independence - most features can be split into parallel work
2. **Define clear boundaries** - each agent owns specific files/directories  
3. **Establish contracts early** - frontmatter format, file naming, data schemas
4. **Launch agents simultaneously** - don't wait unless dependencies require it
5. **Monitor via documentation** - agents update `/agent-communication/` asynchronously

### Communication Directory Setup
```bash
mkdir -p docs/agents/agent-communication/

# Project Manager creates initial files:
echo "# Coordination Plan" > docs/agents/agent-communication/coordination.md
echo "# Project State Assessment" > docs/agents/agent-communication/assessment.md
```

### Project State Assessment Template
```markdown
# Project State Assessment - [Date]

## Build Health
- Hugo build: [PASS] Passing / [FAIL] Failing
- Generated files: X pages, Y assets
- Known build issues: [List]

## Feature Completion Status
| Feature | Content | Template | Tool | Integration |
|---------|---------|----------|------|-------------|
| Foundation | NOT STARTED | NOT STARTED | N/A | NOT STARTED |
| Opportunity Cost | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| Credit Cards | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |

## Identified Blockers
- [Blocker 1: No Hugo site initialized yet]
- [Blocker 2: No article template created]

## Parallel Opportunities
- Hugo setup + Tailwind config (no dependencies)
- Article template + First article draft (can use placeholder template)
- GitHub Actions + Tool development (independent)

## Integration Requirements
- Articles need the article template
- Tools need to be linked from articles
- Navigation needs all content pages
```

### PARALLEL EXECUTION IS DEFAULT
**Always run agents in parallel unless dependencies prevent it.**

Good Parallel Division Examples:
- **Foundation + Content:** Setup while writing articles
- **Articles + Tools:** Different agents for content and calculators  
- **Multiple Articles:** Independent articles by separate agents
- **Templates + Styling:** Layout and CSS work simultaneously

Smart Task Splitting for Maximum Parallelization:
```
Feature: Credit Card Optimizer
Instead of: 1 agent builds everything sequentially
Do this: 
- Agent 1: Article content (content/strategies/credit-optimization.md)
- Agent 2: JavaScript tool (static/js/credit-card-optimizer.js)
- Agent 3: Tool styling and layout (Tailwind classes)
- Agent 4: Data pipeline (GitHub Action for card data)
All run SIMULTANEOUSLY with pre-defined interfaces
```

### Agent Communication Template
```markdown
# Agent: [Content|Frontend|Tool|DevOps]
# Task: [BUFO-XXX]
# Session: [Timestamp]

## Claimed Files
- content/concepts/opportunity-cost.md
- static/js/calculators/opportunity-cost.js

## Dependencies
- Needs: Article template from BUFO-005
- Provides: Opportunity cost calculator for other articles

## Integration Points
- Calculator embedded via shortcode: {{< opportunity-cost >}}
- Linked from navigation menu
- Cross-referenced in related articles

## Status
- [x] Article draft complete
- [x] Math formulas verified
- [ ] Calculator implemented
- [ ] Mobile testing done
```

### Parallel vs Sequential Decision Examples

**PARALLEL (Default):**
```
# These can ALL run simultaneously:
- Agent 1: Setup Hugo site structure (Frontend)
- Agent 2: Configure Tailwind with custom colors (Frontend)
- Agent 3: Write opportunity cost article (Content)
- Agent 4: Build credit card data pipeline (DevOps)
```

**SEQUENTIAL (Only when required):**
```
# These MUST run in order:
1. Agent 1: Create Hugo site structure
2. Agent 2: Create article template (needs Hugo)
3. Agent 3: Write articles using template
4. Agent 4: Build navigation with all articles
```

## QUICK REFERENCE

### Project Structure
```
bufoindex/
├── content/           # Markdown articles
├── layouts/          # Hugo templates
├── static/           # JS, CSS, data
├── assets/           # Source files
├── data/             # Hugo data
├── docs/             # Documentation
│   ├── prd.md       # Requirements
│   ├── feature-backlog.md
│   └── agents/      # Agent coordination
└── public/           # Generated site
```

### Essential Commands
```bash
# Hugo
hugo server -D        # Local development
hugo --gc --minify   # Production build
hugo new content/concepts/article.md

# Git
git add .
git commit -m "message"
git push origin main

# Testing
# Manual testing - no test framework yet
# Verify calculations by hand
# Check responsive design
# Test URL hash persistence
```

### Component Creation Checklist
Article:
- [ ] Frontmatter complete
- [ ] KaTeX math renders
- [ ] Images optimized
- [ ] Cross-links added
- [ ] Mobile friendly

Tool:
- [ ] Vanilla JavaScript only
- [ ] Calculations verified
- [ ] URL hash persistence
- [ ] Error handling
- [ ] Mobile interface

## TESTING & TROUBLESHOOTING

### Testing Requirements
- Manual calculation verification
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile responsiveness check
- URL hash persistence test
- Accessibility validation

### Common Issues & Solutions

**Build Failures**
- Missing frontmatter → Add required fields
- Invalid markdown → Check syntax
- Hugo version → Update if needed

**Content Issues**
- Math not rendering → Check KaTeX shortcodes
- Links broken → Use Hugo's ref/relref
- Images missing → Put in static/images/

**Tool Problems**
- Calculations wrong → Verify formulas
- State not persisting → Check URL hash encoding
- Mobile issues → Test touch events

## BUILD SYSTEM COORDINATION

### Hugo Build Coordination
Since Hugo is simpler than the original system, coordination is easier:

1. **Content agents** can work independently on articles
2. **Template agents** establish patterns others follow
3. **Tool agents** build JavaScript independently
4. **DevOps agents** setup GitHub Actions in parallel

### Pre-Work Coordination
```bash
# Check current state
hugo version
ls -la content/
ls -la layouts/
hugo --gc --minify  # Test build
```

### Model Ownership (Simplified for Hugo)
```markdown
## File Ownership Matrix

### Content (content/)
- concepts/opportunity-cost.md: Agent-Content-A
- strategies/credit-optimization.md: Agent-Content-B
- advanced/leveraged-etfs.md: Agent-Content-C

### Templates (layouts/)
- _default/baseof.html: Agent-Frontend-A ONLY
- _default/single.html: Agent-Frontend-A ONLY
- partials/: Agent-Frontend-B can add

### Tools (static/js/)
- credit-card-optimizer.js: Agent-Tool-A
- leverage-profiler.js: Agent-Tool-B
- shared/utils.js: Coordinate if needed
```

## HANDOFF PROTOCOL

### Update Documentation
1. **Update agent communication file:**
```markdown
# In docs/agents/agent-communication/{agent-role}-{timestamp}.md
## Session Complete
- Task IDs completed: [BUFO-001, BUFO-002]
- Files delivered: [list all created/modified files]
- Integration ready: Yes/No
- Blockers for other agents: None
```

2. **Update feature backlog:**
- Change status from NOT STARTED to IN PROGRESS or COMPLETED
- Add completion date
- Check off acceptance criteria
- Add implementation notes

### Final Checklist
- [ ] Agent communication file updated
- [ ] Feature backlog status updated
- [ ] Hugo build successful
- [ ] Content renders correctly
- [ ] Tools calculate accurately
- [ ] Mobile layout verified
- [ ] No broken links
- [ ] Documentation complete

## REMEMBER
- **Evaluate project state thoroughly before spawning any agents**
- **Fix broken builds before adding new features**
- **Complete partial work before starting new work**
- **Document completion in feature-backlog.md after reviewing all agent work**
- **Parallel execution is the default** - Only go sequential if dependencies require it
- Always check what exists before creating new code
- Test continuously with `hugo server -D`
- Every feature must be accessible from navigation
- Use Tailwind classes for ALL styling
- Update task status immediately when complete
- Document in `/agent-communication/` for other agents
- When in doubt, look at the PRD and feature backlog