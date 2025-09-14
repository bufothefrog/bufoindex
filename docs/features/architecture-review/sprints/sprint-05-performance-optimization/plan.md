# Sprint 5: Performance Optimization - AI Agent Implementation Plan

## Overview
**Priority:** MEDIUM (After correctness and consistency)  
**Agent Types:** performance-auditor-agent, calculation-optimizer-agent, react-optimizer-agent, web-worker-agent  
**Execution Mode:** Sequential audit, then parallel optimization  
**Focus:** DISCOVERY & ANALYSIS - Investigate current performance characteristics, identify bottlenecks, and assess optimization opportunities (READ-ONLY ASSESSMENT)

## Discovery Questions to Answer
- What are the current performance characteristics of each calculator?
- Where do users experience noticeable delays or sluggishness?
- Which calculations are most computationally intensive and why?
- How does the application currently handle long-running calculations?
- What performance expectations do users have for financial calculators?
- Where do current React patterns create performance bottlenecks?
- What's the actual impact of bundle size on user experience?

## Performance Targets
```
Basic calculations: < 50ms
Complex tax calculations: < 100ms
Monte Carlo 1,000 runs: < 500ms
Monte Carlo 10,000 runs: < 2,000ms
React component re-renders: Minimized
Bundle size: Reasonable for calculator app
Page load: < 3s on 3G connection
```

## AI Agent Execution Plan

### Phase 1: Performance Audit & Baseline (Sequential)

**Agent A (performance-auditor-agent):** ARCH-038, ARCH-041, ARCH-042, ARCH-043  
**Dependencies:** Must complete comprehensive audit before optimizations

#### Agent A: Performance Audit & Measurement Setup
**Tasks:** ARCH-038, ARCH-041, ARCH-042, ARCH-043
**Agent Prompt:**
```
You are a performance audit specialist for BufoIndex. Establish baseline metrics and identify optimization opportunities.

AUDIT REQUIREMENTS:
1. Implement calculation benchmarking (ARCH-038):
   - Set up performance.now() measurement for all calculations
   - Create benchmark test suite with realistic data
   - Measure current performance vs targets:
     * Basic calculations: target <50ms
     * Complex tax calculations: target <100ms
     * Monte Carlo simulations: measure current timing
   - Identify slowest calculations for optimization priority

2. Audit React re-renders (ARCH-041):
   - Use React DevTools Profiler to identify unnecessary re-renders
   - Find components that re-render without prop changes
   - Identify expensive render operations
   - Document hook dependency optimization opportunities
   - Find missing React.memo opportunities

3. Analyze bundle size (ARCH-042):
   - Create bundle analysis report (use webpack-bundle-analyzer)
   - Identify largest dependencies and their impact
   - Find code splitting opportunities
   - Analyze tree-shaking effectiveness
   - Document lazy loading opportunities for heavy components

4. Implement performance monitoring (ARCH-043):
   - Add performance measurement infrastructure
   - Create performance dashboard/logging
   - Set up regression detection for CI/CD
   - Monitor real-world performance metrics
   - Create alerts for performance degradation

DELIVERABLES:
- Complete performance baseline report
- Prioritized optimization recommendations
- Performance monitoring system
- Bundle analysis with optimization opportunities
- React render audit with specific improvement targets
```

### Phase 2: Calculation & Algorithm Optimization (Parallel)

**Agent B (calculation-optimizer-agent):** ARCH-039, ARCH-040  
**Agent C (web-worker-agent):** Monte Carlo Web Worker implementation  

#### Agent B: Calculation Performance Optimization
**Tasks:** ARCH-039, ARCH-040
**Dependencies:** Agent A's performance audit
**Agent Prompt:**
```
You are a calculation optimization specialist. Optimize financial calculations for speed while maintaining accuracy.

OPTIMIZATION REQUIREMENTS:
1. Optimize Monte Carlo performance (ARCH-039):
   - Target: 1,000 runs < 500ms, 10,000 runs < 2,000ms
   - Implement algorithm optimizations (vectorization where possible)
   - Add progress indicators for long-running simulations
   - Consider approximation methods for real-time feedback
   - Optimize random number generation and market return simulation

2. Implement calculation memoization (ARCH-040):
   - Cache repeated calculations (same inputs = same outputs)
   - Implement smart cache invalidation (profile changes)
   - Optimize cache size and memory usage (prevent memory leaks)
   - Test cache hit rates and effectiveness
   - Use React.useMemo and useCallback appropriately

OPTIMIZATION TECHNIQUES:
- Pre-compute static values (tax brackets, constants)
- Optimize loops and reduce array operations
- Use efficient data structures
- Minimize object creation in hot paths
- Profile-driven optimization (focus on bottlenecks)

ACCURACY REQUIREMENTS:
- All Sprint 1 tests must continue passing
- No changes to calculation logic that affect results
- Maintain banker's rounding and precision requirements
- Validate optimizations don't introduce floating-point errors

DELIVERABLES:
- Optimized calculation functions
- Memoization system implementation
- Performance improvement documentation
- Before/after benchmarks
```

#### Agent C: Web Worker Implementation
**Dependencies:** Agent A's audit identifying heavy calculations
**Agent Prompt:**
```
You are a Web Worker specialist. Implement background processing for heavy calculations to maintain UI responsiveness.

WEB WORKER REQUIREMENTS:
1. Implement Monte Carlo Web Worker:
   - Move Monte Carlo simulations to background thread
   - Implement progress reporting back to main thread
   - Handle worker initialization and termination
   - Test worker performance vs main thread

2. Design worker communication protocol:
   - Define message structure for calculation requests
   - Implement progress updates (% complete, estimated time)
   - Handle error conditions and worker failures
   - Create typed interfaces for worker messages

3. Integrate with React components:
   - Create custom hooks for worker communication
   - Implement loading states and progress indicators
   - Handle worker results and update UI
   - Manage worker lifecycle (creation/cleanup)

4. Optimization considerations:
   - Worker warm-up time (keep workers alive for repeated use)
   - Transfer size optimization (avoid large data transfers)
   - Fallback to main thread if workers not available
   - Test on various browsers and devices

BROWSER COMPATIBILITY:
- Test Web Worker support across target browsers
- Implement graceful fallback for unsupported browsers
- Handle worker security restrictions (file:// protocol, etc.)
- Test on mobile devices (resource constraints)

DELIVERABLES:
- Web Worker implementation for Monte Carlo
- React hooks for worker communication
- Performance comparison (worker vs main thread)
- Browser compatibility testing results
```

### Phase 3: React & UI Optimization (Parallel)

**Agent D (react-optimizer-agent):** React-specific optimizations  
**Agent E (bundle-optimizer-agent):** Bundle size and loading optimizations

#### Agent D: React Performance Optimization
**Dependencies:** Agent A's React audit
**Agent Prompt:**
```
You are a React optimization specialist. Eliminate unnecessary re-renders and optimize component performance.

REACT OPTIMIZATION REQUIREMENTS:
1. Eliminate unnecessary re-renders:
   - Implement React.memo for pure components
   - Optimize hook dependencies (useEffect, useMemo, useCallback)
   - Fix components that re-render without prop changes
   - Use React.useMemo for expensive calculations

2. Optimize component structure:
   - Split large components into smaller, focused components
   - Implement proper state colocation (state closest to where it's used)
   - Use React.lazy for code splitting heavy components
   - Optimize context usage to prevent cascade re-renders

3. Performance monitoring integration:
   - Add React DevTools integration for ongoing monitoring
   - Implement performance measurement in development
   - Create alerts for performance regression
   - Document optimization patterns for future development

OPTIMIZATION TECHNIQUES:
- State optimization (avoid unnecessary state updates)
- Prop drilling elimination (use context judiciously)
- Component composition over inheritance
- Virtual list implementation for large data sets (if needed)

VALIDATION:
- Use React DevTools Profiler to verify improvements
- Benchmark before/after component render times
- Test on low-end devices (throttled CPU)
- Ensure optimizations don't break functionality

DELIVERABLES:
- Optimized React components
- Performance monitoring integration
- Before/after render performance metrics
- React optimization best practices documentation
```

#### Agent E: Bundle Size & Loading Optimization
**Dependencies:** Agent A's bundle analysis
**Agent Prompt:**
```
You are a bundle optimization specialist. Reduce bundle size and improve loading performance.

BUNDLE OPTIMIZATION REQUIREMENTS:
1. Code splitting implementation:
   - Implement route-based code splitting for each calculator
   - Add dynamic imports for heavy dependencies
   - Split vendor bundles appropriately
   - Implement lazy loading for non-critical components

2. Dependency optimization:
   - Audit and remove unused dependencies
   - Replace heavy libraries with lighter alternatives where possible
   - Implement tree-shaking optimization
   - Use dynamic imports for conditional features

3. Asset optimization:
   - Optimize images and static assets
   - Implement proper caching strategies
   - Use compression for text assets
   - Optimize CSS and remove unused styles

4. Loading performance:
   - Implement preloading for critical resources
   - Use service workers for caching (if appropriate)
   - Optimize First Contentful Paint and Largest Contentful Paint
   - Test loading performance on 3G connections

MEASUREMENT:
- Use bundle analyzer to measure improvements
- Test loading performance on various connection speeds
- Monitor Core Web Vitals metrics
- Verify functionality after optimizations

DELIVERABLES:
- Reduced bundle sizes with analysis report
- Code splitting implementation
- Loading performance improvements
- Asset optimization results
```

## Agent Coordination Plan

### Pre-Work Discovery (All Agents)
```bash
# Find calculation functions for performance testing
find . -name "*.ts" -o -name "*.tsx" | xargs grep -l "calculate\|compute" | head -10
grep -r "useMemo\|useCallback\|React.memo" --include="*.ts" --include="*.tsx" app/
npm run build && ls -la .next/ | grep -E "\.(js|css)$"
```

### Agent Communication Protocol
- `/docs/agents/agent-communication/sprint-05-performance-audit-report.md` (Agent A)
- `/docs/agents/agent-communication/sprint-05-calculation-optimization-report.md` (Agent B)
- `/docs/agents/agent-communication/sprint-05-web-worker-implementation-report.md` (Agent C)
- `/docs/agents/agent-communication/sprint-05-react-optimization-report.md` (Agent D)
- `/docs/agents/agent-communication/sprint-05-bundle-optimization-report.md` (Agent E)

### Execution Phases
1. **Phase 1:** Agent A conducts comprehensive performance audit (sequential)
2. **Phase 2:** Agents B & C optimize calculations in parallel
3. **Phase 3:** Agents D & E optimize React and bundles in parallel
4. **Phase 4:** Integration testing and performance validation

### Performance Contracts (Agent A → Others)
Agent A must provide:
- Current performance baselines for all calculations
- Prioritized optimization opportunities
- Performance monitoring infrastructure
- Specific targets for each optimization area

## Project Manager Coordination

### Spawn Commands
```markdown
# Phase 1 (Sequential)
Agent A: "Conduct comprehensive performance audit of BufoIndex calculations, React components, and bundle size"

# Phase 2 (Parallel - after A completes)
Agent B: "Optimize calculation performance with memoization while maintaining accuracy from Sprint 1"
Agent C: "Implement Web Workers for Monte Carlo simulations to maintain UI responsiveness"

# Phase 3 (Parallel - after B & C complete)
Agent D: "Optimize React components to eliminate unnecessary re-renders and improve performance"
Agent E: "Optimize bundle size and implement code splitting for better loading performance"
```

### Success Gate Validation
- All performance targets met or documented if not achievable
- No regression in calculation accuracy (Sprint 1 tests still pass)
- No functional regressions in UI/UX
- Performance monitoring system operational
- Bundle size reasonable for application complexity

### Optimization Constraints
- NEVER change calculation logic (accuracy is paramount)
- Maintain all accessibility features
- Preserve all existing functionality
- Keep mobile performance acceptable
- Don't sacrifice maintainability for marginal gains

## Performance Testing Requirements

### Automated Performance Testing
- Benchmark suite running all calculations with realistic data
- React component render time testing
- Bundle size regression testing
- Loading performance testing (3G simulation)

### Manual Performance Testing
- Test on low-end devices (older smartphones/tablets)
- Test on throttled networks (slow 3G, fast 3G)
- Test with large, complex profiles
- Test concurrent usage of multiple calculators

### Performance Monitoring
- Real-world performance metrics collection
- Regression detection in CI/CD pipeline
- Performance alerts for degradation
- Regular performance reporting

## Risk Mitigation

### High-Risk Optimizations
- Changing calculation algorithms (accuracy risk)
- Aggressive memoization (memory leak risk)
- Complex Web Worker implementations (browser compatibility)
- Aggressive code splitting (loading complexity)

### Mitigation Strategies
- Extensive testing of all optimizations
- Performance regression testing in CI/CD
- Fallback implementations for aggressive optimizations
- Documentation of all optimization decisions
- Monitoring for unexpected performance degradation