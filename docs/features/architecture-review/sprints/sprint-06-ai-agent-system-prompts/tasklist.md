# BufoIndex Sprint 6: AI Agent System Prompts - AI ANALYSIS Tasklist

## READ-ONLY ANALYSIS STRATEGY
**Sequential Phase 1 → Parallel Phase 2 → Sequential Phase 3 (ALL ANALYSIS ONLY - NO CODE CHANGES)**

---

## AI AGENT SPECIALIZATIONS
1. **Pattern Consistency Agent:** Enforces architectural patterns from Sprint 2
2. **Calculation Accuracy Agent:** Validates financial calculations from Sprint 1
3. **TypeScript Enforcement Agent:** Maintains type safety from Sprint 3
4. **Security & Privacy Agent:** Protects client-side-only architecture from Sprint 4

---

## PHASE 1: PROMPT ARCHITECTURE & STANDARDS (Sequential - 1 Agent)

### Agent A: AI Agent Prompt Architecture Specialist
**Priority:** CRITICAL | **Agent Type:** prompt-architect-agent

#### Tasks:
- **TASK-A1:** Analyze previous sprint outcomes (ARCH-044, ARCH-045, ARCH-046, ARCH-047)
  - Sprint 1: Calculation accuracy patterns and common errors
  - Sprint 2: Pattern consistency requirements and refactoring learnings
  - Sprint 3: TypeScript enforcement needs and common violations
  - Sprint 4: Security requirements and privacy protection needs
  - Sprint 5: Performance optimization patterns and constraints

- **TASK-A2:** Design prompt structure for maximum effectiveness
  - Clear, actionable instructions with specific examples
  - Specific examples of correct vs incorrect patterns
  - Common failure modes to watch for and prevent
  - Validation checkpoints and success criteria
  - Integration with development workflow

- **TASK-A3:** Create four specialized agent prompt frameworks
  - Pattern Consistency Agent (ARCH-044)
  - Calculation Accuracy Agent (ARCH-045)
  - TypeScript Enforcement Agent (ARCH-046)
  - Security & Privacy Agent (ARCH-047)

**Prompt Effectiveness Criteria:**
- Prevent regression to previous architectural issues
- Catch violations before they reach production
- Guide agents toward BufoIndex-specific solutions
- Provide clear escalation paths for edge cases
- Include validation methods for prompt success

**Deliverables:**
- Four complete AI agent prompt frameworks
- Prompt usage guidelines and best practices
- Integration workflow documentation
- Testing methodology for prompt effectiveness
- Common failure mode prevention strategies

**Success Criteria:**
- [ ] All previous sprint learnings incorporated into prompt design
- [ ] Prompt structure optimized for AI agent effectiveness
- [ ] Four specialized agent frameworks created
- [ ] Validation methods established
- [ ] Integration workflow designed

---

## PHASE 2: SPECIALIZED PROMPT CREATION & TESTING (Parallel - 4 Agents)

### Agent B: Pattern Consistency Agent Development Specialist
**Priority:** CRITICAL | **Agent Type:** pattern-enforcer-agent

#### Tasks:
- **TASK-B1:** Create Pattern Consistency Agent prompt
  - Reference Implementation Standard: `/app/tools/paycheck-allocator/` as gold standard
  - File structure matching: components/, hooks/, lib/, types.ts
  - Component naming: XxxInput, XxxResults, XxxChart patterns
  - Hook naming: useXxxCalculation, useXxxState patterns

- **TASK-B2:** Shared Component Enforcement patterns
  - Always use `/components/calculators/shared/` components
  - MoneyInput for all currency inputs
  - PercentageInput for all percentage inputs
  - ResultCard for all result displays
  - CalculatorLayout as wrapper for all tools

- **TASK-B3:** Anti-patterns to prevent
  - Creating custom input components when shared ones exist
  - Inconsistent file structures across calculators
  - Direct style application instead of using shared components
  - React imports in calculation functions (lib/ should be pure)

- **TASK-B4:** URL Hash Profile Requirements
  - Never store profile data in localStorage or database
  - Always use ProfileManager.toHash() and fromHash()
  - Validate with ProfileSchema.parse()
  - Handle malformed data gracefully

**Deliverables:**
- Complete Pattern Consistency Agent prompt with examples
- Testing scenarios and expected responses
- Integration guidelines for development workflow
- Anti-pattern detection mechanisms

---

### Agent C: Calculation Accuracy Agent Development Specialist
**Priority:** CRITICAL | **Agent Type:** calculation-guardian-agent

#### Tasks:
- **TASK-C1:** Calculation Precision Standards enforcement
  - All money calculations in cents (number type)
  - Display formatting only at presentation layer
  - Banker's rounding (round-half-even) for currency
  - 4 decimal places for intermediate calculations
  - 2 decimal places for display only

- **TASK-C2:** Required Test Coverage patterns
  - Every calculation needs IRS-verified test cases
  - Edge cases: 0, negative, maximum values
  - Cross-validation with known results
  - All 50 states for state-specific calculations

- **TASK-C3:** BufoIndex Philosophy Validation
  - Emergency fund: MAX 3 months (not 6-12 months)
  - Debt threshold: 7% interest rate decision point
  - Investment fees: <0.1% acceptable, >0.5% flagged
  - Tax-advantaged priority: Before emergency fund
  - Conservative portfolio: Always show opportunity cost

- **TASK-C4:** Calculation Source Documentation
  - Link to IRS publications for tax formulas
  - State revenue department sources for state taxes
  - Financial literature citations for investment formulas
  - Document any assumptions or limitations

**Deliverables:**
- Complete Calculation Accuracy Agent prompt
- Test case requirements and validation methods
- Philosophy compliance checklist
- Source documentation standards

---

### Agent D: TypeScript Enforcement Agent Development Specialist
**Priority:** CRITICAL | **Agent Type:** typescript-enforcer-agent

#### Tasks:
- **TASK-D1:** Strict TypeScript Rules enforcement
  - NO `any` types (use `unknown` with type guards instead)
  - NO `ts-ignore` comments (fix the underlying issue)
  - ALL functions need explicit return types
  - ALL React components need Props interfaces

- **TASK-D2:** Naming Conventions enforcement
  - Interfaces: PascalCase with descriptive suffixes (Props, State, Config)
  - Types: PascalCase for objects, camelCase for primitives
  - Enums: PascalCase for enum name, SCREAMING_SNAKE for values
  - Generic types: Single capital letters (T, U, K, V)

- **TASK-D3:** URL Hash Type Safety enforcement
  - All URL hash data must implement URLHashable interface
  - toHash(): string method for encoding
  - fromHash(hash: string): this | null for decoding
  - Zod schema validation for all profile data

- **TASK-D4:** Component Type Safety enforcement
  - Props interfaces for all React components
  - Event handler types explicitly defined
  - State interfaces for complex component state
  - Hook return types explicitly defined

**Deliverables:**
- Complete TypeScript Enforcement Agent prompt
- Type safety validation checklist
- Common violation examples and fixes
- Integration with development workflow

---

### Agent E: Security & Privacy Agent Development Specialist
**Priority:** CRITICAL | **Agent Type:** security-guardian-agent

#### Tasks:
- **TASK-E1:** Client-Side-Only Architecture enforcement
  - NEVER send financial data to servers
  - NEVER use localStorage for sensitive data
  - ALWAYS use URL hash for profile persistence
  - NO analytics that include financial amounts

- **TASK-E2:** URL Hash Security enforcement
  - Compress data to obscure contents in URL
  - Validate all decoded data with Zod schemas
  - Handle malformed hashes gracefully (no crashes)
  - Limit hash size to prevent DoS attacks

- **TASK-E3:** Input Validation Security enforcement
  - Sanitize all financial inputs
  - Prevent XSS in calculated results
  - Validate ranges (age 18-100, percentages 0-100)
  - Handle Infinity and NaN explicitly

- **TASK-E4:** Privacy Protection enforcement
  - No accidental logging of financial data
  - No server-side persistence of any kind
  - Profile data never leaves user's browser
  - Graceful handling of invalid/malicious data

**Security Testing Requirements:**
- Test with malicious URL hashes
- Test with oversized profile data
- Validate XSS prevention in results
- Verify no server communication for profile data

**Deliverables:**
- Complete Security & Privacy Agent prompt
- Security validation checklist
- Penetration testing scenarios
- Privacy compliance verification methods

---

## PHASE 3: INTEGRATION & VALIDATION (Sequential - 1 Agent)

### Agent F: AI Agent Workflow Integration Specialist
**Priority:** HIGH | **Agent Type:** integration-agent
**Dependencies:** All specialized agent prompts completed

#### Tasks:
- **TASK-F1:** Development Workflow Integration
  - Define when each specialized agent should be used
  - Create escalation paths for conflicts between agents
  - Establish coordination protocols for multi-agent tasks
  - Document usage guidelines for development teams

- **TASK-F2:** Prompt Validation Testing
  - Create test scenarios for each agent prompt
  - Validate prompt effectiveness with real-world examples
  - Test edge cases and prompt failure modes
  - Document prompt success criteria and metrics

- **TASK-F3:** Quality Assurance Integration
  - Integrate agents into code review process
  - Create automated prompt testing in CI/CD
  - Establish prompt versioning and update procedures
  - Monitor prompt effectiveness over time

- **TASK-F4:** Documentation and Training
  - Create prompt usage documentation
  - Establish prompt maintenance procedures
  - Document common prompt failure modes and solutions
  - Create troubleshooting guide for prompt issues

- **TASK-F5:** Create comprehensive sprint report
  - Document AI agent prompt effectiveness and validation results
  - Highlight most successful prompt patterns for quality enforcement
  - Document prompt integration workflow and best practices
  - Create recommendations for evolving and maintaining AI agent systems

**Deliverables:**
- Complete AI agent workflow documentation
- Prompt testing and validation framework
- Integration with development processes
- Maintenance and monitoring procedures
- **`/docs/features/architecture-review/sprints/sprint-06-ai-agent-system-prompts/report.md`** (comprehensive findings)

---

## AGENT COORDINATION PROTOCOL

### Pre-Work Analysis (Agent A):
```bash
# Analyze previous sprint outcomes
find docs/agents/agent-communication/ -name "*sprint-0[1-5]*" | head -15
grep -r "pattern\|calculation\|typescript\|security\|performance" docs/agents/agent-communication/
cat docs/features/architecture-review/sprints/*/plan.md | grep -A 5 "Success Criteria"
```

### Communication Files:
- `/docs/agents/agent-communication/sprint-06-prompt-architecture-report.md` (Agent A)
- `/docs/agents/agent-communication/sprint-06-pattern-consistency-prompt-report.md` (Agent B)
- `/docs/agents/agent-communication/sprint-06-calculation-accuracy-prompt-report.md` (Agent C)
- `/docs/agents/agent-communication/sprint-06-typescript-enforcement-prompt-report.md` (Agent D)
- `/docs/agents/agent-communication/sprint-06-security-privacy-prompt-report.md` (Agent E)
- `/docs/agents/agent-communication/sprint-06-integration-workflow-report.md` (Agent F)

### Execution Phases:
1. **Phase 1:** Agent A designs prompt architecture (sequential)
2. **Phase 2:** Agents B, C, D, E create specialized prompts (parallel)
3. **Phase 3:** Agent F integrates and tests workflow (sequential)

---

## PROJECT MANAGER SPAWN COMMANDS

### Phase Execution:
```bash
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

---

## SUCCESS CRITERIA VALIDATION

### Sprint Gate Requirements:
- [ ] All four specialized agent prompts completed and tested
- [ ] Prompts effectively catch common violations from previous sprints
- [ ] Integration workflow documented and validated
- [ ] Prompt maintenance procedures established
- [ ] Quality metrics for prompt effectiveness defined
- [ ] Testing framework validates prompt reliability
- [ ] Development workflow integration seamless

### Deliverable Structure:
**AI Agent Prompts:**
1. **Pattern Consistency Agent:** `/docs/ai-agents/pattern-consistency-agent.md`
2. **Calculation Accuracy Agent:** `/docs/ai-agents/calculation-accuracy-agent.md`
3. **TypeScript Enforcement Agent:** `/docs/ai-agents/typescript-enforcement-agent.md`
4. **Security & Privacy Agent:** `/docs/ai-agents/security-privacy-agent.md`

**Workflow Documentation:**
- AI agent usage guidelines
- Prompt testing and validation framework
- Integration with development processes
- Maintenance and update procedures

### Quality Assurance:
- Prompt effectiveness metrics
- Validation test scenarios
- Common failure modes and solutions
- Troubleshooting and escalation procedures

---

## NOTES FOR AI DEVELOPMENT

**Optimization for Prompt Development:**
- Phase 1 establishes framework for all subsequent prompt creation
- Phase 2 allows parallel development of specialized prompts
- Phase 3 integrates and validates complete system

**Critical Dependencies:**
- All previous sprint learnings must inform prompt design
- Each specialized agent must prevent regressions from its focus area
- Integration must support multi-agent coordination scenarios

**Prompt Ownership Matrix:**
- Agent A: Overall prompt architecture and frameworks
- Agent B: Pattern consistency enforcement prompt
- Agent C: Calculation accuracy enforcement prompt
- Agent D: TypeScript enforcement prompt
- Agent E: Security & privacy enforcement prompt
- Agent F: Integration workflow and validation systems

**Quality Assurance Focus:**
- Prompts must prevent known failure patterns from previous sprints
- Testing scenarios must cover real-world development situations
- Integration must support complex multi-agent coordination tasks

## SPRINT REPORT REQUIREMENTS

### Report Structure (Agent F):
```markdown
# Sprint 6: AI Agent System Prompts - Architecture Report

## Executive Summary
- AI agent prompt system implementation and effectiveness
- Quality enforcement automation achievements
- Development workflow integration success

## AI Agent Prompt Effectiveness Analysis
- Pattern Consistency Agent: Architectural standard enforcement success rate
- Calculation Accuracy Agent: Financial calculation validation effectiveness
- TypeScript Enforcement Agent: Type safety violation detection accuracy
- Security & Privacy Agent: Security compliance validation results

## Quality Enforcement Automation Success
- Prompt-driven quality control implementation results
- Automated violation detection and prevention effectiveness
- Developer productivity impact from AI agent assistance
- Quality standard consistency improvements

## Prompt Engineering Patterns That Work
- Most effective prompt structures for different domains
- Successful examples vs anti-examples patterns
- Validation checkpoint designs that catch issues early
- Escalation and fallback mechanisms that work reliably

## Development Workflow Integration
- AI agent integration points in development process
- Multi-agent coordination protocols effectiveness
- Developer adoption and usage patterns
- Workflow efficiency improvements measured

## Technical Implementation Success
- Prompt validation framework effectiveness
- Automated testing of AI agent responses
- Prompt versioning and maintenance procedures
- CI/CD integration success and reliability

## Issues Discovered and Resolved
- Prompt failure modes identified and mitigated
- Agent coordination conflicts and resolution strategies
- Performance impacts of AI agent integration
- False positive/negative tuning and optimization

## Standards Established for AI-Assisted Development
- AI agent usage guidelines and best practices
- Quality enforcement criteria and thresholds
- Prompt maintenance and evolution procedures
- Developer training and onboarding requirements

## Recommendations for Future AI Agent Evolution
- Prompt improvement strategies based on usage patterns
- New AI agent specializations to consider
- Advanced coordination patterns for complex scenarios
- Long-term maintenance and scaling strategies
```