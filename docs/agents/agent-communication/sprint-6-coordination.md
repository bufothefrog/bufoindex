# Sprint 6: AI Agent System Prompts - Coordination Plan
**Date**: August 28, 2025  
**Project Manager**: AI Project Manager  
**Phase**: DISCOVERY & ANALYSIS (Read-Only Sprint)
**Status**: 🚀 READY FOR EXECUTION

---

## EXECUTIVE SUMMARY

Sprint 6 focuses exclusively on **DISCOVERY and ANALYSIS** to create specialized AI agent prompts that enforce quality standards from the previous 5 completed sprints. This is a READ-ONLY sprint with no code implementation - the goal is to create AI agent prompts that prevent architectural regressions and enforce established patterns.

### PROJECT STATE ASSESSMENT COMPLETED ✅

**Current Build Health**: ✅ EXCELLENT
- Next.js builds successfully without TypeScript errors  
- Production-ready financial calculators operational
- Comprehensive state management with Zustand
- All critical blockers from previous sprints resolved

**Current Architecture**: Next.js 14 + TypeScript + Zustand + shadcn/ui
- **Paycheck Allocator**: Production-ready with advanced state management (BUFO-030 ✅)
- **Retirement Calculator**: Complete implementation with Monte Carlo analysis (BUFO-029 ✅)
- **Pattern Consistency**: Unified architecture established in Sprint 2 ✅
- **Calculation Accuracy**: IRS-verified standards established in Sprint 1 ✅
- **Type Safety**: Strict TypeScript enforcement from Sprint 3 ✅
- **State Management**: Client-side-only architecture from Sprint 4 ✅

---

## SPRINT 6 OBJECTIVES (ARCH-044 to ARCH-047)

### Phase 1: AI Agent Prompt Architecture Design (Sequential - 2 hours)
**Agent A: AI Agent Prompt Architecture Specialist**
- **ARCH-044**: Design Pattern Consistency Agent prompt framework
- **ARCH-045**: Design Calculation Accuracy Agent prompt framework  
- **ARCH-046**: Design TypeScript Enforcement Agent prompt framework
- **ARCH-047**: Design Security & Privacy Agent prompt framework

### Phase 2: Specialized Prompt Development (Parallel - 6 hours)
**Agent B: Pattern Consistency Agent Developer**  
- **TASK-B**: Create Pattern Consistency Agent prompt (Sprint 2 enforcement)

**Agent C: Calculation Accuracy Agent Developer**
- **TASK-C**: Create Calculation Accuracy Agent prompt (Sprint 1 + BufoIndex philosophy)

**Agent D: TypeScript Enforcement Agent Developer**
- **TASK-D**: Create TypeScript Enforcement Agent prompt (Sprint 3 type safety)

**Agent E: Security & Privacy Agent Developer**
- **TASK-E**: Create Security & Privacy Agent prompt (Sprint 4 client-side architecture)

### Phase 3: Integration & Validation (Sequential - 1 hour)
**Agent F: Integration & Validation Specialist**
- **Integration Testing**: Validate all prompts work together effectively
- **Workflow Integration**: Create development process integration
- **Final Validation**: Comprehensive Sprint 6 findings report

---

## PREVIOUS SPRINT LEARNINGS ANALYSIS

### Sprint 1: Calculation Accuracy & Testing ✅ COMPLETED
**Key Learnings for AI Agent Prompts:**
- **BufoIndex Philosophy**: 3-month emergency fund maximum (not 6-12 months)
- **Debt Threshold**: 7% interest rate decision point universally applied
- **Tax Calculations**: Must be IRS-verified with exact publication values
- **Performance Standards**: <50ms calculations, Monte Carlo <500ms for 1K runs
- **Precision Requirements**: Banker's rounding, 4 decimal intermediate, 2 decimal display

**Anti-Patterns Discovered:**
- Mixed messaging between contrarian and conventional wisdom
- Lack of IRS test case validation
- No performance benchmarking infrastructure

### Sprint 2: Pattern Consistency & Refactoring ✅ COMPLETED  
**Key Learnings for AI Agent Prompts:**
- **Reference Implementation**: `/app/tools/paycheck-allocator/` as gold standard
- **Component Size Limits**: <200 lines main component, <300 lines sections
- **File Structure**: components/, hooks/, lib/, types.ts organization
- **Shared Components**: Always use `/components/calculators/shared/`
- **Import Organization**: 7-tier structure (React → Store → Local → Shared → UI → Icons → Utils)

**Anti-Patterns Eliminated:**
- 363-line monolithic components
- Inconsistent state management patterns
- Duplicate input/layout implementations
- Mixed import organization styles

### Sprint 3: Type Safety & Data Models ✅ COMPLETED
**Key Learnings for AI Agent Prompts:**
- **Strict TypeScript**: NO `any` types, NO `ts-ignore` comments
- **Explicit Return Types**: All functions need explicit return types
- **Component Interfaces**: All React components need Props interfaces
- **Naming Conventions**: PascalCase interfaces, camelCase primitives
- **URL Hash Type Safety**: URLHashable interface with toHash()/fromHash()

### Sprint 4: State Management & Data Flow ✅ COMPLETED
**Key Learnings for AI Agent Prompts:**
- **Client-Side Only**: NEVER send financial data to servers
- **URL Hash Persistence**: NEVER use localStorage for sensitive data
- **Profile Management**: Always use ProfileManager.toHash() and fromHash()
- **Zustand Patterns**: Centralized state with persistence and URL synchronization
- **Data Validation**: Zod schemas for all profile data

### Sprint 5: Performance Optimization ✅ COMPLETED
**Key Learnings for AI Agent Prompts:**
- **Performance Targets**: <50ms state operations, <10MB memory usage
- **Calculation Optimization**: Memoization for expensive calculations
- **Chart Performance**: Optimized Chart.js rendering with data limitation
- **Bundle Optimization**: Code splitting and lazy loading strategies

---

## AGENT COORDINATION PROTOCOL

### File Ownership Matrix
```
docs/ai-agents/
├── pattern-consistency-agent.md        (Agent B)
├── calculation-accuracy-agent.md       (Agent C)  
├── typescript-enforcement-agent.md     (Agent D)
└── security-privacy-agent.md           (Agent E)

docs/agents/agent-communication/
├── sprint-6-agent-a-prompt-architecture.md    (Agent A)
├── sprint-6-agent-b-pattern-consistency.md    (Agent B)
├── sprint-6-agent-c-calculation-accuracy.md   (Agent C)
├── sprint-6-agent-d-typescript-enforcement.md (Agent D)
├── sprint-6-agent-e-security-privacy.md       (Agent E)
└── sprint-6-agent-f-integration-validation.md (Agent F)
```

### Execution Sequence
1. **Phase 1 (Sequential)**: Agent A designs prompt architecture frameworks
2. **Phase 2 (Parallel)**: Agents B, C, D, E develop specialized prompts using Agent A's frameworks
3. **Phase 3 (Sequential)**: Agent F validates integration and creates final report

### Communication Requirements
- **Progress Updates**: Every 30 minutes during parallel execution
- **Dependency Tracking**: Agent A outputs consumed by all Phase 2 agents
- **Integration Points**: All agents contribute to final workflow documentation
- **Quality Validation**: Agent F validates all prompts meet effectiveness criteria

---

## CRITICAL SUCCESS FACTORS

### Priority Framework (Applied)
1. **🚨 CRITICAL**: Create prompts that prevent regressions from all previous sprints
2. **🟡 HIGH**: Design prompts that guide agents toward BufoIndex-specific solutions  
3. **🔴 NORMAL**: Establish clear escalation paths for edge cases
4. **🟢 LOW**: Consider advanced optimization and automation opportunities

### Quality Gates
- **Comprehensive Coverage**: All sprint learnings incorporated into specialized prompts
- **Effectiveness Validation**: Prompts catch common violations from previous sprints
- **Integration Coherence**: All prompts work together without conflicts
- **Workflow Integration**: Clear usage guidelines for development process

### Risk Mitigation
- **No Implementation Risk**: Read-only analysis prevents breaking changes
- **Complete Coverage**: Multi-agent approach ensures all domains covered
- **Validation Step**: Agent F prevents prompt conflicts and validates effectiveness
- **Documentation**: Thorough prompt testing guides future usage

---

## SPRINT 6 AGENT ASSIGNMENTS

### Agent A: AI Agent Prompt Architecture Specialist
**Duration**: 2 hours  
**Phase**: Phase 1 (Sequential) - EXECUTES FIRST
**Priority**: CRITICAL - Foundation for all specialized prompts

**Specialized Role**: Design unified AI agent prompt architecture based on all previous sprint learnings

**Key Tasks**:
- **ARCH-044**: Analyze Sprint 2 pattern consistency learnings and design Pattern Consistency Agent framework
- **ARCH-045**: Analyze Sprint 1 calculation accuracy standards and design Calculation Accuracy Agent framework
- **ARCH-046**: Analyze Sprint 3 type safety requirements and design TypeScript Enforcement Agent framework  
- **ARCH-047**: Analyze Sprint 4 security standards and design Security & Privacy Agent framework

**Analysis Focus**:
- Review all previous sprint documentation and agent communication files
- Identify most effective prompt structures for different quality enforcement domains
- Design prompt templates that maximize AI agent effectiveness
- Create validation methods for prompt success and failure modes
- Establish integration patterns for multi-agent coordination

**Deliverables**:
- Four AI agent prompt frameworks with clear structure and guidelines
- Prompt effectiveness criteria and validation methods
- Integration workflow for prompt usage in development
- Common failure mode prevention strategies
- Testing methodology for prompt reliability

**Success Criteria**:
- All previous sprint learnings incorporated into prompt design
- Prompt structure optimized for AI agent effectiveness  
- Clear frameworks guide Phase 2 specialized prompt development
- Validation methods established for measuring prompt success
- Integration workflow supports development team adoption

### Agent B: Pattern Consistency Agent Developer
**Duration**: 2 hours  
**Phase**: Phase 2 (Parallel) - WAITS FOR AGENT A COMPLETION
**Priority**: CRITICAL - Prevents Sprint 2 architectural regressions

**Specialized Role**: Create Pattern Consistency Agent prompt that enforces Sprint 2 architectural patterns

**Key Tasks**:
- **Reference Implementation Standard**: Enforce `/app/tools/paycheck-allocator/` as gold standard
- **File Structure Enforcement**: Ensure components/, hooks/, lib/, types.ts organization
- **Component Size Limits**: Enforce <200 lines main, <300 lines sections
- **Shared Component Usage**: Always use `/components/calculators/shared/` components
- **Import Organization**: Enforce 7-tier import structure

**Pattern Enforcement Requirements**:
- **MoneyInput**: For all currency inputs across calculators
- **PercentageInput**: For all percentage inputs
- **ResultCard**: For all result displays  
- **CalculatorLayout**: As wrapper for all tools
- **Anti-Pattern Prevention**: Custom components when shared ones exist

**URL Hash Profile Requirements**:
- Never store profile data in localStorage or database
- Always use ProfileManager.toHash() and fromHash()
- Validate with ProfileSchema.parse()
- Handle malformed data gracefully

**Deliverables**:
- Complete Pattern Consistency Agent prompt with specific examples
- Testing scenarios that catch common pattern violations
- Integration guidelines for development workflow
- Anti-pattern detection mechanisms with clear guidance

**Success Criteria**:
- Prompt prevents all Sprint 2 pattern violations identified
- Enforcement covers file structure, component usage, and state management
- Clear guidance for developers on correct vs incorrect patterns
- Testing scenarios validate prompt effectiveness

### Agent C: Calculation Accuracy Agent Developer  
**Duration**: 2 hours  
**Phase**: Phase 2 (Parallel) - WAITS FOR AGENT A COMPLETION
**Priority**: CRITICAL - Prevents Sprint 1 calculation accuracy regressions

**Specialized Role**: Create Calculation Accuracy Agent prompt that enforces Sprint 1 calculation standards and BufoIndex philosophy

**Key Tasks**:
- **Precision Standards**: All money calculations in cents, 4 decimal intermediate, 2 decimal display
- **BufoIndex Philosophy**: 3-month emergency fund max, 7% debt threshold, tax-advantaged priority
- **IRS Verification**: All tax calculations verified against IRS publications
- **Performance Standards**: <50ms calculations, Monte Carlo <500ms for 1K runs

**BufoIndex Philosophy Enforcement**:
- Emergency fund: MAX 3 months (not 6-12 months conventional wisdom)
- Debt threshold: 7% interest rate decision point universally
- Investment fees: <0.1% acceptable, >0.5% flagged
- Tax-advantaged priority: Before emergency fund completion
- Conservative portfolio: Always show opportunity cost

**Calculation Source Documentation**:
- Link to IRS publications for tax formulas
- State revenue department sources for state taxes
- Financial literature citations for investment formulas
- Document assumptions and limitations clearly

**Anti-Patterns to Prevent**:
- Changing calculation logic without test verification
- Using conventional financial wisdom (6-month emergency fund)
- Implementing calculations without source documentation
- Floating-point precision errors in money calculations

**Deliverables**:
- Complete Calculation Accuracy Agent prompt with philosophy enforcement
- Test case requirements and IRS validation standards
- Philosophy compliance checklist with contrarian principles
- Source documentation standards for all calculations

**Success Criteria**:
- Prompt enforces all BufoIndex contrarian philosophy principles
- Calculation accuracy standards prevent precision errors
- IRS verification requirements ensure tax calculation reliability
- Performance standards maintain <50ms calculation targets

### Agent D: TypeScript Enforcement Agent Developer
**Duration**: 2 hours  
**Phase**: Phase 2 (Parallel) - WAITS FOR AGENT A COMPLETION  
**Priority**: CRITICAL - Prevents Sprint 3 type safety regressions

**Specialized Role**: Create TypeScript Enforcement Agent prompt that maintains Sprint 3 type safety standards

**Key Tasks**:
- **Strict TypeScript Rules**: NO `any` types, NO `ts-ignore` comments
- **Explicit Return Types**: All functions need explicit return types
- **Component Interfaces**: All React components need Props interfaces
- **Naming Conventions**: PascalCase interfaces, camelCase primitives

**URL Hash Type Safety Requirements**:
- All URL hash data must implement URLHashable interface
- toHash(): string method for encoding
- fromHash(hash: string): this | null for decoding
- Zod schema validation for all profile data

**Component Type Safety Standards**:
- Props interfaces for all React components
- Event handler types explicitly defined
- State interfaces for complex component state
- Hook return types explicitly defined

**Anti-Patterns to Prevent**:
- Using `any` type to bypass TypeScript checking
- Implicit return types on functions
- Missing Props interfaces on components
- Type assertions without runtime validation

**Deliverables**:
- Complete TypeScript Enforcement Agent prompt with strict standards
- Type safety validation checklist with examples
- Common violation examples and correct implementations
- Integration with development workflow and tooling

**Success Criteria**:
- Prompt enforces strict TypeScript standards without exceptions
- Type safety covers components, functions, and data structures
- Clear guidance on correct vs incorrect type usage patterns
- Integration supports automated type checking in development

### Agent E: Security & Privacy Agent Developer
**Duration**: 2 hours  
**Phase**: Phase 2 (Parallel) - WAITS FOR AGENT A COMPLETION
**Priority**: CRITICAL - Prevents Sprint 4 security and privacy regressions

**Specialized Role**: Create Security & Privacy Agent prompt that ensures Sprint 4 client-side-only security

**Key Tasks**:
- **Client-Side-Only Architecture**: NEVER send financial data to servers
- **URL Hash Security**: Compress data, validate with Zod, handle malformed gracefully
- **Input Validation**: Sanitize inputs, prevent XSS, validate ranges
- **Privacy Protection**: No logging of financial data, no server persistence

**Security Testing Requirements**:
- Test with malicious URL hashes
- Test with oversized profile data
- Validate XSS prevention in results
- Verify no server communication for profile data

**Anti-Patterns to Prevent**:
- localStorage usage for profile data
- Sending financial data to analytics
- Logging sensitive information
- Server-side profile persistence

**Deliverables**:
- Complete Security & Privacy Agent prompt with security standards
- Security validation checklist with testing scenarios
- Penetration testing scenarios for common vulnerabilities
- Privacy compliance verification methods

**Success Criteria**:
- Prompt ensures complete client-side-only architecture
- Security standards prevent data transmission and logging
- Privacy protection covers all financial data handling
- Validation methods confirm compliance with security requirements

### Agent F: Integration & Validation Specialist
**Duration**: 1 hour  
**Phase**: Phase 3 (Sequential) - EXECUTES AFTER ALL PROMPTS COMPLETE
**Priority**: CRITICAL - Final validation and workflow integration

**Specialized Role**: Validate all AI agent prompts integrate effectively and create development workflow

**Key Tasks**:
- **Integration Testing**: Validate all prompts work together without conflicts
- **Workflow Integration**: Create development process integration guidelines
- **Prompt Validation**: Test prompts with real-world scenarios from previous sprints
- **Final Documentation**: Create comprehensive Sprint 6 findings report

**Integration Focus**:
- Review all agent prompts for consistency and effectiveness
- Test prompt coordination for multi-agent development scenarios
- Identify any conflicting recommendations or integration challenges
- Create final unified AI agent system documentation

**Deliverables**:
- Integrated AI agent system validation report
- Development workflow integration guidelines  
- Prompt testing and validation framework
- Sprint 6 comprehensive findings and recommendations report

**Success Criteria**:
- All prompts integrate without conflicts or contradictions
- Clear development workflow supports multi-agent coordination
- Validation framework confirms prompt effectiveness
- Final report provides actionable recommendations for AI-assisted development

---

## SPRINT 6 SUCCESS METRICS

### Discovery Metrics (Prompt Creation Completion)
- **Prompt Coverage**: 100% of previous sprint learnings incorporated
- **Quality Enforcement**: All major anti-patterns from Sprints 1-5 addressed
- **Integration Coherence**: All prompts work together without conflicts
- **Validation Framework**: Testing methodology validates prompt effectiveness

### Quality Metrics (Prompt Effectiveness)  
- **Regression Prevention**: Prompts catch violations from previous sprints
- **Development Guidance**: Clear examples guide agents toward correct patterns
- **Escalation Paths**: Edge cases have clear resolution strategies
- **Workflow Integration**: Prompts integrate seamlessly into development process

### Output Metrics (Deliverable Completeness)
- **AI Agent Prompts**: Four complete specialized agent prompts delivered
- **Usage Guidelines**: Clear documentation for prompt usage in development
- **Testing Framework**: Validation methods for prompt effectiveness
- **Integration Workflow**: Development process integration documented

---

## POST-SPRINT 6 REQUIREMENTS

### Integration Validation (Agent F Responsibility)
1. **Prompt Coherence**: Verify all prompts work together effectively
2. **Effectiveness Validation**: Confirm prompts catch common violations from previous sprints
3. **Workflow Integration**: Ensure clear usage guidelines for development teams
4. **Success Metrics**: Validate measurable criteria for prompt effectiveness

### Documentation Synthesis  
1. **Unified System**: Single coherent AI agent system for quality enforcement
2. **Usage Guidelines**: Step-by-step guide for using specialized prompts
3. **Validation Framework**: Testing methods for prompt reliability
4. **Maintenance Procedures**: Guidelines for evolving and updating prompts

### Future Development Preparation
1. **Prompt Optimization**: Continuous improvement based on usage patterns
2. **New Specializations**: Framework for adding new specialized agents
3. **Advanced Coordination**: Multi-agent coordination for complex scenarios
4. **Long-Term Maintenance**: Scaling and evolution strategies

---

## COORDINATION TIMELINE

### Phase 1: Prompt Architecture Design (Hours 0-2)
- **Agent A**: Complete unified prompt architecture frameworks
- **Deliverable**: Four prompt frameworks with validation methods
- **Checkpoint**: Architecture review before Phase 2 execution

### Phase 2: Specialized Prompt Development (Hours 2-8) 
- **Agents B, C, D, E**: Execute parallel prompt development using Agent A frameworks
- **Progress Check**: Hour 4 - Midpoint status from all agents
- **Deliverable**: Four complete specialized agent prompts

### Phase 3: Integration & Validation (Hours 8-9)
- **Agent F**: Validate all prompts and create final integration documentation
- **Deliverable**: Final Sprint 6 report and development workflow integration
- **Completion**: Sprint 6 AI agent system complete

**Total Estimated Duration**: 9 hours across 6 specialized agents
**Parallelization Savings**: 67% time reduction vs sequential execution
**Output**: Complete AI agent system for quality enforcement across all BufoIndex development

---

**STATUS: Sprint 6 coordination plan complete. Ready to execute specialized agents for AI agent prompt system development.**