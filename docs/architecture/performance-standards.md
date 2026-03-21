# BufoIndex Performance Testing Standards

## Overview

This document defines the comprehensive performance testing standards for BufoIndex, ensuring that our financial calculation platform maintains sub-50ms responsiveness that differentiates us from competitors.

## Performance Targets

### Critical Performance Thresholds

| Category | Threshold | Rationale |
|----------|-----------|-----------|
| Basic Calculations | <50ms | User-facing calculations must feel instantaneous |
| Complex Tax Calculations | <100ms | Multi-step optimization remains responsive |
| Monte Carlo 1,000 runs | <500ms | Quick scenario analysis |
| Monte Carlo 10,000 runs | <2,000ms | Comprehensive simulation acceptable delay |
| Memory Usage | <10MB increase | Prevent memory leaks in calculation-heavy operations |
| Component Rendering | <16ms | 60fps smooth UI updates |

### Performance Philosophy

**Why These Targets Matter:**
- **Sub-50ms Basic Calculations:** Industry-leading responsiveness creates trust in accuracy
- **Predictable Performance:** Users can rely on consistent calculation speeds
- **Scalability:** Performance standards prevent degradation as features grow
- **Competitive Advantage:** Faster calculations = better user experience

## Testing Categories

### 1. Basic Calculations (`<50ms`)

**Scope:** Fundamental financial operations that users interact with frequently.

**Test Cases:**
- Currency formatting and parsing
- Future value calculations
- Present value calculations
- Portfolio size calculations
- Batch operations (50 calculations)

**Example Benchmark:**
```typescript
bench('Future value calculation (basic)', () => {
  FinancialCalculations.futureValue(10000, 0.07, 10)
}, { time: 50 })
```

**Performance Expectations:**
- Single operations: <10ms
- Batch operations: <50ms total
- Memory overhead: <1MB

### 2. Complex Tax Calculations (`<100ms`)

**Scope:** Multi-step tax optimization and paycheck allocation logic.

**Test Cases:**
- Federal tax bracket calculations
- State tax calculations
- Complete tax optimization analysis
- Paycheck allocation optimization

**Performance Expectations:**
- Tax bracket analysis: <50ms
- Full paycheck optimization: <100ms
- Memory overhead: <5MB

### 3. Monte Carlo Simulations

**Scope:** Stochastic modeling for retirement planning scenarios.

**Performance Targets:**
- 100 iterations: <100ms
- 1,000 iterations: <500ms
- 10,000 iterations: <2,000ms

**Test Cases:**
- Standard retirement scenarios
- Complex scenarios with high volatility
- Multiple concurrent simulations

### 4. Memory Usage Monitoring

**Scope:** Preventing memory leaks and excessive allocation.

**Test Cases:**
- Large dataset processing (10,000 calculations)
- Monte Carlo intensive operations
- Concurrent calculation scenarios

**Performance Expectations:**
- Maximum 10MB increase per major operation
- Garbage collection efficiency
- No memory leaks in repeated operations

### 5. Component Render Performance (`<16ms`)

**Scope:** UI responsiveness for 60fps user experience.

**Test Cases:**
- Real-time calculation result formatting
- Form input validation and updates
- Chart data rendering
- State updates with large datasets

## Benchmark Implementation

### Benchmark Structure

```typescript
import { bench, describe } from 'vitest'

describe('Performance Category', () => {
  bench('Test description', () => {
    // Test implementation
  }, {
    time: 50, // Maximum duration in ms
    iterations: 1000 // Optional iteration limit
  })
})
```

### Data Consistency

All benchmarks use standardized test data from `BENCHMARK_DATA`:
- Consistent input values across runs
- Realistic data sizes and complexity
- Edge cases included (large numbers, zero values, etc.)

### Environment Controls

- CPU governor set to performance mode in CI
- Node.js warmup before benchmarking
- Consistent Node.js versions (18, 20)
- Memory constraints defined

## Regression Detection

### Statistical Analysis

The regression detector uses multiple methods:
1. **Z-score analysis** for outlier detection
2. **Interquartile Range (IQR)** for robustness
3. **Linear regression** for trend analysis
4. **Confidence intervals** (95% default) for significance

### Regression Thresholds

| Test Category | Warning Threshold | Error Threshold |
|---------------|------------------|-----------------|
| Basic Calculations | +10% | +25% |
| Complex Tax | +15% | +30% |
| Monte Carlo | +20% | +40% |
| Memory Usage | +25% | +50% |
| Component Render | +10% | +25% |

### Baseline Management

- **Baseline Update Policy:** 5% consistent improvement over 10 runs
- **Historical Data:** Keep 50 most recent runs
- **Trend Analysis:** Minimum 5 runs for statistical significance

## CI/CD Integration

### GitHub Actions Workflow

The performance monitoring workflow runs on:
- Every push to main/develop branches
- Pull requests
- Daily scheduled runs (2 AM UTC)
- Manual triggers with options

### Quality Gates

**Blocking Conditions:**
- Critical regressions (>25% for basic calculations)
- Memory usage exceeding 10MB increase
- Statistical outliers with high confidence

**Warning Conditions:**
- Performance degrading trends
- Threshold violations within warning range
- Consistency issues across Node.js versions

### Reporting

**PR Comments Include:**
- Performance summary with pass/fail rates
- Category breakdown with average durations
- Regression and improvement highlights
- Visual indicators (✅ ❌ ⚠️ 🚀)

## Performance Debugging

### Common Performance Issues

1. **Memory Leaks**
   - Symptom: Gradually increasing memory usage
   - Detection: Memory monitoring benchmarks
   - Solutions: Proper cleanup, object pooling

2. **Algorithm Complexity**
   - Symptom: Non-linear performance degradation
   - Detection: Large dataset benchmarks
   - Solutions: Algorithm optimization, caching

3. **V8 Deoptimization**
   - Symptom: Sudden performance drops
   - Detection: Inconsistent benchmark results
   - Solutions: Type stability, warm-up periods

### Debugging Tools

```bash
# Local performance analysis
npm run benchmark
node scripts/performance-monitor.js --report

# Memory profiling
node --inspect scripts/performance-monitor.js --memory

# V8 optimization analysis
node --trace-opt lib/calculations/calculations.js
```

## Performance Budget

### Resource Limits

- **Total calculation time per user session:** <5 seconds
- **Memory usage per session:** <50MB
- **Concurrent calculations:** 10 without degradation
- **Database query time:** <100ms (future feature)

### Performance Monitoring

**Metrics Tracked:**
- P50, P95, P99 response times
- Memory usage patterns
- Error rates under load
- User-perceived performance

**Alerting Thresholds:**
- P95 exceeds targets by 50%
- Memory usage >100MB
- Error rate >1%

## Best Practices

### Writing Performance Tests

1. **Use Realistic Data**
   ```typescript
   const realisticProfile = generateMockProfile({
     income: { monthlyGross: 8333 }, // $100k annually
     debts: [/* realistic debt scenarios */]
   })
   ```

2. **Test Edge Cases**
   ```typescript
   // Test with extreme but valid inputs
   bench('Large portfolio calculation', () => {
     FinancialCalculations.futureValue(10000000, 0.12, 50)
   })
   ```

3. **Monitor Memory Usage**
   ```typescript
   bench('Memory-intensive operation', () => {
     const startMemory = process.memoryUsage().heapUsed
     // ... perform operation
     const memoryIncrease = process.memoryUsage().heapUsed - startMemory
     expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // 10MB
   })
   ```

### Performance Optimization

1. **Algorithm Selection**
   - Use appropriate Big O complexity for data size
   - Consider caching for repeated calculations
   - Implement early exits for optimization loops

2. **Memory Management**
   - Reuse objects where possible
   - Clear large arrays after use
   - Use TypedArrays for numeric calculations

3. **V8 Optimization**
   - Maintain type consistency
   - Avoid property deletion
   - Use consistent object shapes

## Maintenance

### Regular Tasks

**Weekly:**
- Review performance trend reports
- Update baselines if consistent improvements
- Address performance warnings

**Monthly:**
- Analyze historical performance data
- Update performance budgets based on usage
- Review and update test cases

**Quarterly:**
- Performance architecture review
- Benchmark new Node.js versions
- Evaluate new performance tooling

### Performance Review Process

1. **Code Review Stage**
   - Performance impact assessment
   - Benchmark updates for new features
   - Memory usage considerations

2. **Testing Stage**
   - Local performance validation
   - CI performance gate passage
   - Load testing for major changes

3. **Deployment Stage**
   - Performance monitoring setup
   - Rollback triggers defined
   - Post-deployment validation

## Troubleshooting Guide

### Performance Test Failures

**Symptoms and Solutions:**

1. **"Tests consistently failing after code change"**
   - Check for algorithm complexity changes
   - Verify no infinite loops or inefficient operations
   - Run local benchmarks to isolate issue

2. **"Intermittent performance failures in CI"**
   - Check for system resource contention
   - Verify consistent test environment
   - Increase iteration counts for stability

3. **"Memory usage exceeding limits"**
   - Check for object accumulation
   - Verify proper cleanup after operations
   - Use memory profiling tools

4. **"Regression detector false positives"**
   - Verify statistical significance settings
   - Check for environmental factors
   - Consider adjusting confidence intervals

### Emergency Performance Issues

**Response Procedure:**
1. Immediate: Disable failing components if user-facing
2. Analysis: Run comprehensive performance audit
3. Hotfix: Implement minimal viable fix
4. Validation: Confirm fix with performance tests
5. Prevention: Update tests to prevent recurrence

## Future Enhancements

### Planned Improvements

1. **Advanced Monitoring**
   - Real user monitoring (RUM) integration
   - Performance budgets per feature
   - Automated performance alerts

2. **Enhanced Testing**
   - Cross-browser performance testing
   - Mobile device performance validation
   - Network condition simulation

3. **Optimization Opportunities**
   - Web Workers for heavy calculations
   - Calculation result caching
   - Progressive calculation loading

---

*This document is part of the BufoIndex Quality Assurance framework and should be updated as performance requirements evolve.*