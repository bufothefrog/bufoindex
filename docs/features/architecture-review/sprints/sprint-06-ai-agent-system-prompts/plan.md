# Sprint 6: AI Agent System Prompts - AI Agent Implementation Plan

## Overview
**Priority:** HIGH (Critical for maintaining quality)  
**Agent Types:** prompt-architect-agent, pattern-enforcement-agent, calculation-guard-agent, typescript-guardian-agent, security-sentinel-agent  
**Execution Mode:** Sequential design, parallel prompt creation and testing  
**Focus:** DISCOVERY & ANALYSIS - Investigate development quality patterns, assess common issues, and explore AI-assisted development approaches (READ-ONLY ASSESSMENT)

## Discovery Questions to Answer
- What quality issues most commonly occur during BufoIndex development?
- Where do developers spend the most time on repetitive quality enforcement?
- What patterns from previous sprints could be automated or assisted?
- How could AI agents best support the established development workflow?
- What are the most effective ways to communicate architectural standards?
- Where do current quality processes create development friction?
- What validation approaches would catch issues earliest in development?

## AI Agent System Design

### Agent Specializations
1. **Pattern Consistency Agent:** Enforces architectural patterns from Sprint 2
2. **Calculation Accuracy Agent:** Validates financial calculations from Sprint 1
3. **TypeScript Enforcement Agent:** Maintains type safety from Sprint 3
4. **Security & Privacy Agent:** Protects client-side-only architecture from Sprint 4

## AI Agent Execution Plan

### Phase 1: Prompt Architecture & Standards (Sequential)

**Agent A (prompt-architect-agent):** ARCH-044, ARCH-045, ARCH-046, ARCH-047  
**Dependencies:** Must analyze all previous sprint learnings first

#### Agent A: AI Agent Prompt Architecture
**Tasks:** ARCH-044, ARCH-045, ARCH-046, ARCH-047
**Agent Prompt:**
```
You are an AI agent prompt architect for BufoIndex. Design specialized AI agent prompts that enforce architectural standards and prevent regression.

PROMPT DESIGN REQUIREMENTS:
1. Analyze previous sprint outcomes:
   - Sprint 1: Calculation accuracy patterns and common errors
   - Sprint 2: Pattern consistency requirements and refactoring learnings
   - Sprint 3: TypeScript enforcement needs and common violations
   - Sprint 4: Security requirements and privacy protection needs

2. Design prompt structure for maximum effectiveness:
   - Clear, actionable instructions
   - Specific examples of correct vs incorrect patterns
   - Common failure modes to watch for
   - Validation checkpoints and success criteria

3. Create four specialized agent prompts:
   - Pattern Consistency Agent (ARCH-044)
   - Calculation Accuracy Agent (ARCH-045)  
   - TypeScript Enforcement Agent (ARCH-046)
   - Security & Privacy Agent (ARCH-047)

PROMPT EFFECTIVENESS CRITERIA:
- Prevent regression to previous architectural issues
- Catch violations before they reach production
- Guide agents toward BufoIndex-specific solutions
- Provide clear escalation paths for edge cases
- Include validation methods for prompt success

DELIVERABLES:
- Four complete AI agent prompts
- Prompt usage guidelines
- Integration workflow documentation
- Testing methodology for prompt effectiveness
```

### Phase 2: Specialized Prompt Creation & Testing (Parallel)

**Agent B (pattern-enforcer-agent):** Pattern Consistency Agent development  
**Agent C (calculation-guardian-agent):** Calculation Accuracy Agent development  
**Agent D (typescript-enforcer-agent):** TypeScript Enforcement Agent development  
**Agent E (security-guardian-agent):** Security & Privacy Agent development

#### Agent B: Pattern Consistency Agent Development
**Task:** ARCH-044
**Dependencies:** Agent A's architecture and Sprint 2 patterns
**Agent Prompt:**
```
You are developing the Pattern Consistency Agent prompt for BufoIndex. This agent must enforce architectural patterns established in Sprint 2.

PATTERN CONSISTENCY AGENT REQUIREMENTS:
Create a prompt that enforces:

1. Reference Implementation Standard:
   - /app/tools/paycheck-allocator/ as the gold standard
   - File structure matching: components/, hooks/, lib/, types.ts
   - Component naming: XxxInput, XxxResults, XxxChart patterns
   - Hook naming: useXxxCalculation, useXxxState patterns

2. Shared Component Enforcement:
   - Always use /components/calculators/shared/ components
   - MoneyInput for all currency inputs
   - PercentageInput for all percentage inputs
   - ResultCard for all result displays
   - CalculatorLayout as wrapper for all tools

3. Anti-patterns to prevent:
   - Creating custom input components when shared ones exist
   - Inconsistent file structures across calculators
   - Direct style application instead of using shared components
   - React imports in calculation functions (lib/ should be pure)

4. URL Hash Profile Requirements:
   - Never store profile data in localStorage or database
   - Always use ProfileManager.toHash() and fromHash()
   - Validate with ProfileSchema.parse()
   - Handle malformed data gracefully

PROMPT VALIDATION:
- Test prompt with common pattern violations
- Verify it catches file structure deviations
- Ensure it promotes shared component usage
- Validate it prevents localStorage usage for profiles

DELIVERABLE:
- Complete Pattern Consistency Agent prompt with examples
- Testing scenarios and expected responses
- Integration guidelines for development workflow
```

#### Agent C: Calculation Accuracy Agent Development
**Task:** ARCH-045  
**Dependencies:** Agent A's architecture and Sprint 1 accuracy standards
**Agent Prompt:**
```
You are developing the Calculation Accuracy Agent prompt for BufoIndex. This agent must ensure financial calculation accuracy and BufoIndex philosophy compliance.

CALCULATION ACCURACY AGENT REQUIREMENTS:
Create a prompt that enforces:

1. Calculation Precision Standards:
   - All money calculations in cents (number type)
   - Display formatting only at presentation layer
   - Banker's rounding (round-half-even) for currency
   - 4 decimal places for intermediate calculations
   - 2 decimal places for display only

2. Required Test Coverage:
   - Every calculation needs IRS-verified test cases
   - Edge cases: 0, negative, maximum values
   - Cross-validation with known results
   - All 50 states for state-specific calculations

3. BufoIndex Philosophy Validation:
   - Emergency fund: MAX 3 months (not 6-12 months)
   - Debt threshold: 7% interest rate decision point
   - Investment fees: <0.1% acceptable, >0.5% flagged
   - Tax-advantaged priority: Before emergency fund
   - Conservative portfolio: Always show opportunity cost

4. Calculation Source Documentation:
   - Link to IRS publications for tax formulas
   - State revenue department sources for state taxes
   - Financial literature citations for investment formulas
   - Document any assumptions or limitations

ANTI-PATTERNS TO PREVENT:
- Changing calculation logic without test verification
- Using conventional financial wisdom (6-month emergency fund)
- Implementing calculations without source documentation
- Floating-point precision errors in money calculations

DELIVERABLE:
- Complete Calculation Accuracy Agent prompt
- Test case requirements and validation methods
- Philosophy compliance checklist
- Source documentation standards
```

#### Agent D: TypeScript Enforcement Agent Development
**Task:** ARCH-046
**Dependencies:** Agent A's architecture and Sprint 3 type safety standards  
**Agent Prompt:**
```
You are developing the TypeScript Enforcement Agent prompt for BufoIndex. This agent must maintain strict TypeScript standards established in Sprint 3.

TYPESCRIPT ENFORCEMENT AGENT REQUIREMENTS:
Create a prompt that enforces:

1. Strict TypeScript Rules:
   - NO `any` types (use `unknown` with type guards instead)
   - NO `ts-ignore` comments (fix the underlying issue)
   - ALL functions need explicit return types
   - ALL React components need Props interfaces

2. Naming Conventions:
   - Interfaces: PascalCase with descriptive suffixes (Props, State, Config)
   - Types: PascalCase for objects, camelCase for primitives  
   - Enums: PascalCase for enum name, SCREAMING_SNAKE for values
   - Generic types: Single capital letters (T, U, K, V)

3. URL Hash Type Safety:
   - All URL hash data must implement URLHashable interface
   - toHash(): string method for encoding
   - fromHash(hash: string): this | null for decoding
   - Zod schema validation for all profile data

4. Component Type Safety:
   - Props interfaces for all React components
   - Event handler types explicitly defined
   - State interfaces for complex component state
   - Hook return types explicitly defined

ANTI-PATTERNS TO PREVENT:
- Using `any` type to bypass TypeScript checking
- Implicit return types on functions
- Missing Props interfaces on components
- Type assertions without runtime validation

DELIVERABLE:
- Complete TypeScript Enforcement Agent prompt
- Type safety validation checklist
- Common violation examples and fixes
- Integration with development workflow
```

#### Agent E: Security & Privacy Agent Development
**Task:** ARCH-047
**Dependencies:** Agent A's architecture and Sprint 4 security standards
**Agent Prompt:**
```
You are developing the Security & Privacy Agent prompt for BufoIndex. This agent must ensure client-side-only security and privacy protection.

SECURITY & PRIVACY AGENT REQUIREMENTS:
Create a prompt that enforces:

1. Client-Side-Only Architecture:
   - NEVER send financial data to servers
   - NEVER use localStorage for sensitive data
   - ALWAYS use URL hash for profile persistence
   - NO analytics that include financial amounts

2. URL Hash Security:
   - Compress data to obscure contents in URL
   - Validate all decoded data with Zod schemas
   - Handle malformed hashes gracefully (no crashes)
   - Limit hash size to prevent DoS attacks

3. Input Validation Security:
   - Sanitize all financial inputs
   - Prevent XSS in calculated results
   - Validate ranges (age 18-100, percentages 0-100)
   - Handle Infinity and NaN explicitly

4. Privacy Protection:
   - No accidental logging of financial data
   - No server-side persistence of any kind
   - Profile data never leaves user's browser
   - Graceful handling of invalid/malicious data

SECURITY TESTING REQUIREMENTS:
- Test with malicious URL hashes
- Test with oversized profile data
- Validate XSS prevention in results
- Verify no server communication for profile data

ANTI-PATTERNS TO PREVENT:
- localStorage usage for profile data
- Sending financial data to analytics
- Logging sensitive information
- Server-side profile persistence

DELIVERABLE:
- Complete Security & Privacy Agent prompt
- Security validation checklist
- Penetration testing scenarios
- Privacy compliance verification methods
```

### Phase 3: Integration & Validation (Sequential)

**Agent F (integration-agent):** Workflow integration and testing

#### Agent F: AI Agent Workflow Integration
**Dependencies:** All specialized agent prompts completed
**Agent Prompt:**
```
You are an AI agent workflow integration specialist. Integrate the four specialized agent prompts into the BufoIndex development workflow.

INTEGRATION REQUIREMENTS:
1. Development Workflow Integration:
   - Define when each specialized agent should be used
   - Create escalation paths for conflicts between agents
   - Establish coordination protocols for multi-agent tasks
   - Document usage guidelines for development teams

2. Prompt Validation Testing:
   - Create test scenarios for each agent prompt
   - Validate prompt effectiveness with real-world examples
   - Test edge cases and prompt failure modes
   - Document prompt success criteria and metrics

3. Quality Assurance Integration:
   - Integrate agents into code review process
   - Create automated prompt testing in CI/CD
   - Establish prompt versioning and update procedures
   - Monitor prompt effectiveness over time

4. Documentation and Training:
   - Create prompt usage documentation
   - Establish prompt maintenance procedures
   - Document common prompt failure modes and solutions
   - Create troubleshooting guide for prompt issues

DELIVERABLES:
- Complete AI agent workflow documentation
- Prompt testing and validation framework
- Integration with development processes
- Maintenance and monitoring procedures
```

## Agent Coordination Plan

### Pre-Work Analysis (Agent A)
```bash
# Analyze previous sprint outcomes
find docs/agents/agent-communication/ -name "*sprint-0[1-4]*" | head -10
grep -r "pattern\|calculation\|typescript\|security" docs/agents/agent-communication/
cat docs/features/architecture-review/sprints/*/plan.md | grep -A 5 "Success Criteria"
```

### Agent Communication Protocol
- `/docs/agents/agent-communication/sprint-06-prompt-architecture-report.md` (Agent A)
- `/docs/agents/agent-communication/sprint-06-pattern-consistency-prompt-report.md` (Agent B)
- `/docs/agents/agent-communication/sprint-06-calculation-accuracy-prompt-report.md` (Agent C)
- `/docs/agents/agent-communication/sprint-06-typescript-enforcement-prompt-report.md` (Agent D)
- `/docs/agents/agent-communication/sprint-06-security-privacy-prompt-report.md` (Agent E)
- `/docs/agents/agent-communication/sprint-06-integration-workflow-report.md` (Agent F)

### Execution Phases
1. **Phase 1:** Agent A designs prompt architecture (sequential)
2. **Phase 2:** Agents B, C, D, E create specialized prompts (parallel)
3. **Phase 3:** Agent F integrates and tests workflow (sequential)

## Project Manager Coordination

### Spawn Commands
```markdown
# Phase 1 (Sequential)
Agent A: "Design AI agent prompt architecture for BufoIndex quality enforcement based on all previous sprint learnings"

# Phase 2 (Parallel - after A completes)
Agent B: "Create Pattern Consistency Agent prompt enforcing Sprint 2 architectural patterns"
Agent C: "Create Calculation Accuracy Agent prompt enforcing Sprint 1 calculation standards and BufoIndex philosophy"
Agent D: "Create TypeScript Enforcement Agent prompt enforcing Sprint 3 type safety standards"
Agent E: "Create Security & Privacy Agent prompt enforcing Sprint 4 client-side-only architecture"

# Phase 3 (Sequential - after B, C, D, E complete)
Agent F: "Integrate all AI agent prompts into development workflow and create validation framework"
```

### Success Gate Validation
- All four specialized agent prompts completed and tested
- Prompts effectively catch common violations
- Integration workflow documented and validated
- Prompt maintenance procedures established
- Quality metrics for prompt effectiveness defined

## Deliverables

### AI Agent Prompts
1. **Pattern Consistency Agent:** `/docs/ai-agents/pattern-consistency-agent.md`
2. **Calculation Accuracy Agent:** `/docs/ai-agents/calculation-accuracy-agent.md`
3. **TypeScript Enforcement Agent:** `/docs/ai-agents/typescript-enforcement-agent.md`
4. **Security & Privacy Agent:** `/docs/ai-agents/security-privacy-agent.md`

### Workflow Documentation
- AI agent usage guidelines
- Prompt testing and validation framework
- Integration with development processes
- Maintenance and update procedures

### Quality Assurance
- Prompt effectiveness metrics
- Validation test scenarios
- Common failure modes and solutions
- Troubleshooting and escalation procedures