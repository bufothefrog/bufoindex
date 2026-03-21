# BufoIndex AI Agent Development Guide

## FOR AI PROJECT MANAGER
This guide is for Claude Code acting as a project manager spawning child agents. **Always use parallel agents when possible.** Only use sequential execution when dependencies absolutely require it.

### Project Manager Workflow
1. **EVALUATE** - Read all documentation and assess current state
2. **PLAN** - Identify parallel execution opportunities
3. **DEFINE** - Create clear task boundaries and contracts
4. **SPAWN** - Launch multiple agents simultaneously
5. **MONITOR** - Track progress via `/agent-communication/`
6. **INTEGRATE** - Coordinate handoffs and resolve conflicts
7. **DOCUMENT** - Update feature backlog with completion status

### Initial Project Evaluation (DO THIS FIRST - NEVER SKIP)
**CRITICAL:** Based on Sprint 1-7 analysis, many quality issues stem from skipping this evaluation. This is now MANDATORY.

**Run:** `source docs/agents/quality-scripts.sh && project_evaluation`

### Planning Questions to Answer
- [ ] Which tasks are truly independent? (Most are!)
- [ ] What's partially built that needs completion? (Highest priority!)
- [ ] What's the current blocker preventing progress?
- [ ] Which features can be built entirely in parallel?
- [ ] Where are the integration points between agents?
- [ ] What contracts/interfaces need pre-definition?
- [ ] Are there any failing builds or broken links to fix first?

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

**Run:** `source docs/agents/quality-scripts.sh && quick_health_check` (quick pre-agent check)  
**Run:** `source docs/agents/quality-scripts.sh && verify_environment` (environment verification)

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
**Run:** `source docs/agents/quality-scripts.sh && article_workflow` or `tool_workflow`

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
**Run:** `source docs/agents/quality-scripts.sh && validate_handoff`

## MULTI-AGENT COORDINATION (AI PROJECT MANAGER) 

### Complete Workflow
```
1. EVALUATE (15-30 min)
   ├─ Read all documentation
   ├─ Run quality assessment
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
   ├─ Update feature-backlog.md status
   └─ Create completion summary
```

### Special Message: "EVALUATE -> PRIORITIZE -> PARALLELIZE -> EXECUTE -> REVIEW & DOCUMENT"

## AGENT SUCCESS CRITERIA TEMPLATES

**All agents must use appropriate templates for task completion validation:**

- **Financial Calculation Agents:** See `docs/agents/templates/financial-agent-template.md`
- **React Component Agents:** See `docs/agents/templates/component-agent-template.md`
- **Testing Agents:** See `docs/agents/templates/testing-agent-template.md`

## CRITICAL: QUALITY ENFORCEMENT (SPRINT 8 REQUIREMENTS)

### Mandatory Quality Verification Checklist

**EVERY AGENT MUST COMPLETE THIS CHECKLIST BEFORE AND AFTER TASK COMPLETION**

Based on Sprint 1-7 analysis, these quality checks are now MANDATORY to prevent recurrence of critical issues:

#### Quick Health Check (REQUIRED BEFORE STARTING)
**Streamlined pre-agent validation - scan for critical blockers only:**

- [ ] **TypeScript Compiles:** No critical compilation errors blocking development
- [ ] **Build Succeeds:** Basic build process completes successfully
- [ ] **Philosophy Compliance:** No conventional wisdom language in codebase
- [ ] **Dependencies Present:** Critical project files exist (package.json, tsconfig.json, vitest.config.ts)

**Run:** `source docs/agents/quality-scripts.sh && quick_health_check`

**If ANY critical blocker found, agent MUST NOT proceed until resolved.**

*Note: Comprehensive testing (full test suite, linting, coverage, performance) will be enforced at pre-commit time.*

#### Post-Task Validation (REQUIRED BEFORE COMPLETION)
**Quick validation to ensure no regressions introduced:**

- [ ] **Functionality Verified:** Manual testing of implemented features completed
- [ ] **Build Still Passes:** `npm run build` still succeeds after changes
- [ ] **TypeScript Clean:** No new compilation errors introduced  
- [ ] **Philosophy Consistent:** All new content follows BufoIndex contrarian principles
- [ ] **Documentation Updated:** Changes documented appropriately

**Run:** `source docs/agents/quality-scripts.sh && quick_health_check` (post-implementation)

*Note: Comprehensive validation (full tests, linting, coverage, performance) happens at pre-commit.*

#### Pre-Commit Comprehensive Validation (AUTOMATIC)
**Full quality suite enforced before code enters repository:**

- **Complete Test Suite:** All tests must pass with coverage targets
- **Code Quality:** Linting with zero errors, warnings allowed within limits
- **Performance:** Benchmark validation for calculation speed
- **TypeScript:** Strict compilation with zero errors
- **Philosophy:** Complete scan for conventional wisdom violations
- **Security:** No hardcoded secrets or vulnerabilities

**Enforced by:** Pre-commit hooks (`scripts/quality-gates.sh all`)

*Agents focus on functionality - quality gates catch issues automatically.*

#### Integration Validation (REQUIRED FOR MULTI-AGENT SESSIONS)
- [ ] **File Ownership Respected:** Only modified files within claimed ownership
- [ ] **Import/Export Integrity:** All module imports resolve correctly
- [ ] **Cross-Agent Integration:** Changes integrate properly with other agent outputs
- [ ] **Shared Component Compatibility:** No breaking changes to shared components
- [ ] **API Contract Compliance:** All interfaces remain compatible

### Common Failure Patterns & Prevention (Sprint 1-7 Lessons)

#### Pattern 1: TypeScript Compilation Failures
**Historical Issue:** Test pattern files with invalid syntax blocking all development  
**Prevention:**
- ALWAYS run `npm run type-check` before and after any file modifications
- Validate generated code templates before using them
- Use TypeScript-aware editors with real-time error checking
- Test import statements immediately after creating them

#### Pattern 2: Philosophy Compliance Violations  
**Historical Issue:** Conventional wisdom language ("Money Guys recommend 6 months") in contrarian platform  
**Prevention:**
- Scan all user-facing text for prohibited phrases: "Money Guys", "Dave Ramsey", "conventional wisdom", "6 months emergency"
- Always emphasize opportunity cost in financial recommendations
- Enforce 3-month emergency fund maximum (not 6-12 months)
- Use 7% debt threshold consistently
- Replace conventional advice with BufoIndex contrarian philosophy

#### Pattern 3: Test Infrastructure Breakage
**Historical Issue:** Test utilities with syntax errors preventing quality assurance  
**Prevention:**
- Test all test utilities before using them: `npm run test:dry-run`
- Validate custom matchers work correctly
- Ensure mock data includes all required fields
- Run tests frequently during development

#### Pattern 4: Module Integration Failures
**Historical Issue:** Empty exports and incomplete implementations causing import failures  
**Prevention:**
- Complete all declared functions and classes before committing
- Test import chains: attempt to import and use exported functions
- Avoid declaring interfaces without implementations
- Validate that all exports are actually implemented

#### Pattern 5: Performance Regressions
**Historical Issue:** No automated performance monitoring allowing degradation  
**Prevention:**
- Benchmark calculation performance before and after changes
- Maintain <50ms for basic calculations, <500ms for complex calculations
- Monitor memory usage for calculation-heavy operations
- Use performance.now() to measure critical operations

#### Pattern 6: Agent Coordination Failures
**Historical Issue:** Agents creating conflicting files without coordination  
**Prevention:**
- Claim file ownership explicitly before making changes
- Communicate with other agents about shared dependencies
- Test integration after completing multi-agent sessions
- Validate that changes don't break other agents' work

### Testing Requirements for All Agent-Generated Code

**MANDATORY:** All code generated by agents must meet these testing standards:

#### Financial Calculations (100% Coverage Required)
- Every financial calculation must have IRS-verified test cases where applicable
- All calculations must include opportunity cost analysis
- BufoIndex philosophy (3-month emergency fund max, 7% debt threshold) must be validated
- Performance benchmarks required for complex calculations

#### React Components (80% Coverage Target)
- All components must pass WCAG 2.1 AA accessibility tests
- Responsive design must be validated on mobile and desktop
- Error states and edge cases must be tested
- User interaction patterns must be validated

#### Integration Tests (70% Coverage Target)  
- URL hash persistence must be tested
- Cross-calculator data flow must be validated
- End-to-end user workflows must be tested
- Performance under realistic usage must be verified

### Multi-Agent Quality Coordination Requirements

**MANDATORY for multi-agent sessions:**

#### File Ownership Protocol
```markdown
## Claimed Files (Agent: [agent-name])
**Exclusive Ownership:** (Only this agent may modify)
- path/to/file1.ts
- path/to/file2.tsx

**Shared Access:** (Coordinate with other agents)
- path/to/shared-file.ts (with Agent-B)

**Read-Only Dependencies:**
- path/to/dependency.ts (used but not modified)
```

#### Integration Points Declaration
```typescript
// REQUIRED: Document integration contracts
interface IntegrationContract {
  component: string;
  interface: ComponentInterface;
  testingRequired: boolean;
  dependencies: string[];
}
```

#### Cross-Agent Validation
- Test that Agent A's outputs work with Agent B's inputs
- Validate shared component changes don't break existing usage
- Ensure data structure changes are backward compatible
- Run full integration test suite after multi-agent completion

### Quality Gate Compliance Requirements

**NO TASK COMPLETION WITHOUT:**

1. **Pre-Commit Quality Gates:**
   - TypeScript compilation: PASS
   - Test execution: PASS  
   - Linting standards: PASS
   - Philosophy compliance: PASS

2. **Performance Gates:**
   - Basic calculations: <50ms
   - Complex calculations: <500ms
   - Monte Carlo simulations: <5000ms for 10k iterations
   - Memory usage: <10MB increase for calculation operations

3. **Philosophy Gates:**
   - Zero conventional wisdom language
   - Opportunity cost emphasized in financial recommendations
   - BufoIndex contrarian principles consistently applied
   - 3-month emergency fund maximum enforced
   - 7% debt threshold decision point used

**REMEMBER:** Quality gates exist to catch issues early. They are guardrails that enable confident, rapid development.

## MANDATORY PROJECT MANAGER QUALITY ORCHESTRATION

### Project Manager Quality Responsibilities
**CRITICAL:** Project managers are responsible for ensuring ALL agents meet quality standards. This is non-negotiable.

**Pre-Agent-Spawn Quick Check:** `source docs/agents/quality-scripts.sh && quick_health_check`  
**Comprehensive Quality Assessment:** `source docs/agents/quality-scripts.sh && quality_assessment` (pre-commit level)
**Agent Quality Monitoring:** See `docs/agents/conflict-resolution.md` for monitoring templates
**Conflict Resolution:** See `docs/agents/conflict-resolution.md` for complete procedures

## PROJECT MANAGER AGENT SUCCESS VERIFICATION

### Multi-Agent Session Success Criteria
**MANDATORY:** Project manager must verify ALL criteria before session completion.

#### Technical Integration Verification ✅
- [ ] **Build Success:** Full project builds without errors
- [ ] **TypeScript Clean:** Zero compilation errors across all agent changes
- [ ] **Test Suite Health:** All tests pass, coverage targets met
- [ ] **Performance Maintained:** No performance regressions detected
- [ ] **Cross-Agent Integration:** All agent outputs work together correctly

#### Quality Compliance Verification ✅  
- [ ] **Philosophy Alignment:** All agent outputs follow BufoIndex principles
- [ ] **Code Quality:** All code meets established standards
- [ ] **Documentation Complete:** All changes properly documented
- [ ] **Accessibility Maintained:** WCAG compliance preserved
- [ ] **Security Standards:** No security vulnerabilities introduced

#### Process Compliance Verification ✅
- [ ] **Agent Communication:** All agents documented their work
- [ ] **Feature Backlog Updated:** All completed features marked
- [ ] **File Ownership Respected:** No unauthorized file modifications
- [ ] **Conflict Resolution:** All conflicts properly resolved and documented
- [ ] **Handoff Documentation:** Complete handoff documentation created

### Post-Execution Documentation (REQUIRED)
After all agents complete their tasks and you've verified the work:

**Why This Matters:** The feature backlog is the single source of truth for project progress. Future agents and project managers rely on accurate status updates to avoid duplicate work and understand what's available to build upon.

1. **Update Feature Backlog Status**
```markdown
# In docs/feature-backlog.md, update each completed feature:

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

**Run:** `source docs/agents/quality-scripts.sh && hugo_coordination`

### File Ownership Matrix
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

## CODE PATTERNS & REFERENCE FILES

**TypeScript Export/Import Patterns:** See `docs/agents/code-patterns.md` for required patterns  
**Conflict Resolution Procedures:** See `docs/agents/conflict-resolution.md` for complete procedures  
**Quality Assessment Scripts:** Use `docs/agents/quality-scripts.sh` functions

## FINAL AGENT QUALITY REQUIREMENTS

### Non-Negotiable Requirements
**EVERY AGENT MUST COMPLY - NO EXCEPTIONS:**

1. **Pre-Task Validation:** All quality gates must pass before starting work
2. **TypeScript Compliance:** Zero compilation errors in all generated code
3. **Test Coverage:** Minimum coverage targets must be met
4. **Philosophy Alignment:** Zero conventional wisdom language allowed
5. **Performance Standards:** All benchmarks must be met or exceeded
6. **Documentation:** All code must be properly documented
7. **Integration Testing:** All components must integrate properly
8. **Accessibility:** WCAG 2.1 AA compliance required
9. **Post-Task Validation:** All quality gates must pass after completion
10. **Handoff Documentation:** Complete handoff documentation required

### Agent Accountability
**CRITICAL:** Agents cannot claim task completion unless ALL requirements are met:

- ✅ **COMPLIANT:** All quality gates pass, documentation complete, integration verified
- ❌ **NON-COMPLIANT:** Any quality gate fails, incomplete documentation, integration issues

### Project Manager Responsibility
**Project managers are accountable for overall quality and must:**
1. Verify all agents meet quality standards before task completion
2. Document any quality issues and ensure resolution
3. Update feature backlog with accurate completion status
4. Ensure all agent work integrates properly
5. Maintain system quality throughout multi-agent sessions

## REMEMBER
- **Evaluate project state thoroughly before spawning any agents**
- **Fix broken builds before adding new features** 
- **Complete partial work before starting new work**
- **ALL AGENTS MUST PASS QUALITY GATES - NO EXCEPTIONS**
- **Document completion in feature-backlog.md after reviewing all agent work**
- **Parallel execution is the default** - Only go sequential if dependencies require it
- **Quality is non-negotiable** - Better to complete fewer features with high quality than many with poor quality
- Always check what exists before creating new code
- Test continuously with appropriate tools
- Every feature must be accessible from navigation
- Use established patterns for ALL styling
- Update task status immediately when complete
- Document in `/agent-communication/` for other agents
- When in doubt, look at the PRD and feature backlog
- **Quality gates exist to enable confident, rapid development**

Action(s) completed with agents.md in context. SPECIAL MESSAGE: "EVALUATE -> PRIORITIZE -> PARALLELIZE -> EXECUTE -> REVIEW & DOCUMENT"