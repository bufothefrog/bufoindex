# Sprint 3: Type Safety & Data Models - AI Agent Implementation Plan

## Overview
**Priority:** HIGH  
**Agent Types:** typescript-architect-agent, data-model-agent, url-hash-agent, validation-agent  
**Execution Mode:** Sequential for data model design, parallel for implementation  
**Focus:** DISCOVERY & ANALYSIS - Evaluate current TypeScript usage patterns, assess data modeling needs, and investigate cross-calculator data sharing opportunities (READ-ONLY ASSESSMENT)

## Discovery Questions to Answer
- What TypeScript patterns currently exist across the codebase and where are the gaps?
- How do calculators currently share data and what are the limitations?
- What validation approaches are already in use and how effective are they?
- Where do type safety issues most commonly occur and what causes them?
- What are the real user needs for cross-calculator data persistence?
- How do similar financial applications handle data modeling and persistence?

## AI Agent Execution Plan

### Phase 1: Data Model Architecture (Sequential)

**Agent A (data-architect-agent):** ARCH-020, ARCH-021, ARCH-022  
**Dependencies:** Must complete before implementation agents

#### Agent A: Data Architecture Discovery
**Tasks:** ARCH-020, ARCH-021, ARCH-022
**Agent Prompt:**
```
You are conducting a data architecture discovery for BufoIndex. Your role is to investigate current data patterns and assess future needs.

DISCOVERY OBJECTIVES:
1. Analyze current data sharing approaches (ARCH-020):
   - How do the calculators currently pass data between each other?
   - What user information is collected by each calculator?
   - What data is essential vs nice-to-have for cross-calculator functionality?
   - Where do users experience friction with re-entering data?
   - What patterns exist in similar financial applications?

2. Investigate client-side persistence options (ARCH-021):
   - What are the current approaches to data persistence in the app?
   - What are the tradeoffs between URL hash, localStorage, and other methods?
   - What security and privacy constraints must be considered?
   - How do browser limitations affect different persistence approaches?
   - What user experience do we want for sharing and bookmarking?

3. Evaluate data serialization needs (ARCH-022):
   - How much data typically needs to be persisted across calculators?
   - What compression approaches are most suitable for financial data?
   - What are the real-world URL length constraints we need to handle?
   - How should we handle data corruption or versioning issues?
   - What fallback strategies are most user-friendly?

SECURITY CONSIDERATIONS:
- No sensitive data beyond what user intentionally shares via URL
- Compress data to obscure contents in URL bar
- Validate all decoded data with strict schemas
- Handle malformed hashes gracefully without errors

DELIVERABLES (DESIGN DOCUMENTS ONLY):
- Complete UnifiedProfile TypeScript interface design
- URLProfileManager class specification (no implementation)
- Compression strategy analysis and recommendations
- Documentation of data model design decisions
- Migration strategy design for profile versions
```

### Phase 2: TypeScript Configuration & Implementation (Parallel)

**Agent B (typescript-enforcer-agent):** ARCH-023, ARCH-024, ARCH-025  
**Agent C (validation-agent):** ARCH-026, ARCH-027, ARCH-028  
**Agent D (url-hash-implementer-agent):** Uses Agent A's designs

#### Agent B: TypeScript Usage Assessment
**Tasks:** ARCH-023, ARCH-024, ARCH-025
**Dependencies:** Understanding current codebase patterns
**Agent Prompt:**
```
You are conducting a TypeScript usage assessment for BufoIndex. Investigate current type safety patterns and identify improvement opportunities.

ASSESSMENT OBJECTIVES:
1. Evaluate current TypeScript configuration (ARCH-023):
   - What TypeScript settings are currently enabled?
   - Where do the current settings cause developer friction?
   - What type errors commonly occur during development?
   - How strict should the configuration be given the development approach?
   - What would be the impact of enabling stricter settings?

2. Analyze type usage patterns (ARCH-024):
   - Where are `any` types currently used and why?
   - What are the common causes of implicit `any` types?
   - Which areas of the codebase have the weakest type safety?
   - What would be required to improve type safety in these areas?
   - Where might stricter typing actually hinder development?

3. Investigate return type practices (ARCH-025):
   - How consistently are return types specified across the codebase?
   - Where do missing return types cause the most confusion?
   - What's the current approach to typing React components?
   - How complex are the current type definitions?
   - What would be the maintenance overhead of more explicit typing?

NAMING CONVENTIONS:
- Interfaces: PascalCase with descriptive suffixes (Props, State, Config)
- Types: PascalCase for objects, camelCase for primitives
- Enums: PascalCase for enum name, SCREAMING_SNAKE for values
- Generic types: Single capital letters (T, U, K, V)

VALIDATION:
- TypeScript must compile with no errors or warnings
- No `ts-ignore` comments allowed (fix the underlying issue)
- All React components must have proper Props interfaces
- All calculation functions must have explicit return types
```

#### Agent C: Data Validation Assessment
**Tasks:** ARCH-026, ARCH-027, ARCH-028
**Dependencies:** Understanding current data patterns
**Agent Prompt:**
```
You are assessing data validation needs for BufoIndex. Investigate current validation approaches and evaluate improvement opportunities.

VALIDATION REQUIREMENTS:
1. Create comprehensive Zod schemas (ARCH-026):
   - ProfileSchema validating entire UnifiedProfile structure
   - DemographicsSchema with age limits (18-100), valid states, filing status
   - IncomeSchema with reasonable limits and validation rules
   - InvestmentSchema with account type validation
   - DebtSchema with interest rate and balance validation

2. Implement URL hash validation (ARCH-027):
   - Validate all decoded profile data with ProfileSchema.parse()
   - Provide user-friendly error messages for validation failures
   - Log validation errors for debugging (but don't expose to user)
   - Handle partial profiles gracefully (fill in missing fields)

3. Create profile migration system (ARCH-028):
   - Version-based migration framework
   - Handle backwards compatibility for old profile versions
   - Test migration scenarios thoroughly
   - Document migration strategies for future versions

VALIDATION RULES:
- Age: 18-100 (reasonable working age range)
- Income: $0-$10,000,000 (handle high earners but prevent unrealistic values)
- Percentages: 0-100 (or 0-1 depending on context)
- States: Valid US state codes + DC
- Filing Status: Valid IRS filing status options
- Account balances: Non-negative numbers
- Interest rates: 0-50% (catch obvious input errors)

ERROR HANDLING:
- Graceful degradation when validation fails
- Sensible defaults for missing or invalid fields  
- User-friendly error messages (not technical Zod errors)
- Preserve as much valid data as possible from partial profiles
```

#### Agent D: URL Hash System Implementation
**Dependencies:** Agents A and C complete their work
**Agent Prompt:**
```
You are a URL hash persistence specialist. Implement the secure client-side profile storage system.

IMPLEMENTATION REQUIREMENTS:
1. Implement ProfileManager class from Agent A's design:
   - toHash() static method with compression
   - fromHash() static method with decompression and validation
   - validate() method using Agent C's Zod schemas
   - Error handling for malformed or oversized hashes

2. Integrate with React applications:
   - Hook into Next.js router for URL hash changes
   - Sync profile changes to URL in real-time
   - Handle browser back/forward button correctly
   - Manage cross-tab synchronization

3. Security and performance optimization:
   - Compress profiles to keep URLs manageable
   - Validate all incoming data strictly
   - Handle DoS prevention (limit hash size)
   - Test with realistic profile data sizes

4. Integration with existing calculators:
   - Connect to paycheck allocator
   - Connect to retirement calculator
   - Provide fallbacks when profile is incomplete
   - Test data flow between tools

TESTING REQUIREMENTS:
- Test with various profile sizes
- Test malformed hash handling
- Test browser compatibility
- Test URL length limitations
- Test compression/decompression accuracy
```

## Agent Coordination Plan

### Pre-Work Discovery (All Agents)
```bash
# Find existing data models and type definitions
find . -name "*.ts" -o -name "*.tsx" | grep -E "(type|interface|model)" | head -10
grep -r "interface\|type\|any" --include="*.ts" --include="*.tsx" app/ | head -20
find . -name "tsconfig.json" -o -name "*.config.ts"
```

### Agent Communication Protocol
- `/docs/agents/agent-communication/sprint-03-data-architecture-report.md` (Agent A)
- `/docs/agents/agent-communication/sprint-03-typescript-enforcement-report.md` (Agent B)  
- `/docs/agents/agent-communication/sprint-03-validation-schemas-report.md` (Agent C)
- `/docs/agents/agent-communication/sprint-03-url-hash-implementation-report.md` (Agent D)

### Execution Phases
1. **Phase 1:** Agent A designs data models (sequential)
2. **Phase 2:** Agents B, C, D implement simultaneously (parallel)
3. **Phase 3:** Integration testing and validation (sequential)

### Data Model Contracts (Agent A → Others)
Agent A must provide:
- Complete UnifiedProfile interface definition
- URLProfileManager interface specification
- Compression strategy and implementation approach
- Profile versioning scheme

## Project Manager Coordination

### Spawn Commands
```markdown
# Phase 1 (Sequential)
Agent A: "Design unified profile data model and URL hash architecture for BufoIndex cross-calculator data sharing"

# Phase 2 (Parallel - after A completes)
Agent B: "Enforce strict TypeScript configuration and eliminate all any types throughout codebase"
Agent C: "Create comprehensive Zod validation schemas for all profile data with migration support"
Agent D: "Implement secure URL hash profile persistence system using data models and validation schemas"
```

### Success Gate Validation
- TypeScript compiles with strict mode and no errors
- Zero `any` types remain in codebase
- URL hash system working with real profile data
- Zod validation catching edge cases gracefully
- Profile persistence working across calculator navigation

### Integration Points
- Must integrate with existing calculators from Sprint 2
- Must maintain calculation accuracy from Sprint 1
- Profile data must work with all existing tools
- No functional regressions allowed

## Performance Considerations

### URL Hash Performance
- Profile encoding/decoding < 50ms
- Compressed profile size < 1500 characters (URL safe)
- Handle profiles with 10+ accounts and complex data
- Memory usage reasonable for client-side operation

### TypeScript Performance  
- Compilation time should not increase significantly
- Runtime performance unaffected by strict typing
- Development experience improved with better IntelliSense
- No bundle size increase from TypeScript changes