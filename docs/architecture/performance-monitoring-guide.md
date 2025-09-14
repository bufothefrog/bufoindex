# Performance Monitoring Guide

## Quick Start

### Running Performance Tests Locally

```bash
# Run basic performance benchmarks
npm run benchmark:performance

# Run comprehensive performance monitoring
npm run perf

# Set new performance baselines
npm run perf:baseline

# Generate detailed performance report
npm run perf:report

# Compare against previous results
npm run perf:compare
```

### CI/CD Performance Monitoring

The performance monitoring system automatically runs on:
- Every push to main/develop branches
- Pull requests (with PR comments)
- Daily scheduled runs (trend analysis)
- Manual workflow triggers

## System Components

### 1. Performance Benchmarks (`test/lib/calculations/performance-benchmarks.bench.ts`)

Comprehensive benchmark suite covering:
- **Basic Calculations**: Currency formatting, future value, etc. (<50ms)
- **Complex Tax Calculations**: Tax brackets, paycheck optimization (<100ms)
- **Monte Carlo Simulations**: 1K runs <500ms, 10K runs <2s
- **Memory Usage**: <10MB increase monitoring
- **Component Rendering**: <16ms for 60fps

### 2. Performance Monitor (`scripts/performance-monitor.js`)

Main orchestration script that:
- Runs vitest benchmarks with controlled environment
- Captures performance results and system metrics
- Generates detailed reports with trend analysis
- Validates against performance thresholds
- Integrates with CI/CD pipeline

### 3. Regression Detector (`scripts/regression-detector.js`)

Advanced statistical analysis system:
- Maintains historical performance data
- Detects outliers using Z-score and IQR methods
- Performs trend analysis with linear regression
- Generates alerts for performance degradation
- Updates baselines automatically when appropriate

### 4. GitHub Actions Workflow (`.github/workflows/performance-monitoring.yml`)

Automated CI/CD integration:
- Runs on multiple Node.js versions (18, 20)
- Stabilizes environment for consistent results
- Caches performance data across builds
- Comments on PRs with performance results
- Fails builds on critical regressions

## Performance Standards

### Thresholds

| Operation | Target | Warning | Critical |
|-----------|--------|---------|----------|
| Basic calculations | <50ms | +10% | +25% |
| Complex tax calculations | <100ms | +15% | +30% |
| Monte Carlo (1K) | <500ms | +20% | +40% |
| Monte Carlo (10K) | <2s | +20% | +40% |
| Memory usage | <10MB | +25% | +50% |
| Component render | <16ms | +10% | +25% |

### Quality Gates

**Blocking Conditions (CI fails):**
- Critical performance regressions (>25% for basic operations)
- Memory usage exceeding 10MB increase
- Statistical outliers with high confidence (>95%)

**Warning Conditions (CI warns):**
- Performance degrading trends over 5+ runs
- Threshold violations within warning range
- Inconsistent performance across Node.js versions

## Data Files

### `.performance-baselines.json`
Contains current performance baselines used for comparison:
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "version": "abc123",
  "thresholds": { ... },
  "results": { ... }
}
```

### `.performance-history.json`
Historical performance data (last 50 runs):
```json
[
  {
    "timestamp": "2025-01-15T10:30:00Z",
    "version": "abc123",
    "branch": "main",
    "results": { ... }
  }
]
```

### `.performance-alerts.json`
Latest performance analysis with regressions/improvements:
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "summary": {
    "total_tests": 25,
    "regressions": 2,
    "improvements": 3
  },
  "regressions": [...],
  "improvements": [...]
}
```

## Usage Examples

### Setting Up Performance Monitoring

```bash
# 1. Initial baseline setup (run once)
npm run perf:baseline

# 2. Regular development workflow
npm run perf  # Check current performance
git add . && git commit -m "feature: new calculation"
git push origin feature-branch  # Triggers CI performance check
```

### Debugging Performance Issues

```bash
# 1. Run detailed performance analysis
npm run perf:report

# 2. Compare with previous baselines
npm run perf:compare

# 3. Check specific benchmark category
npm run benchmark:performance -- --grep "basic_calculations"

# 4. Memory profiling
node --inspect scripts/performance-monitor.js --memory
```

### CI/CD Integration

The system automatically:
1. **Runs benchmarks** on every PR/push
2. **Detects regressions** using statistical analysis
3. **Comments on PRs** with performance results
4. **Fails builds** on critical performance issues
5. **Tracks trends** over time with daily runs

## Regression Detection Algorithm

### Statistical Analysis

1. **Z-Score Method**: Detects outliers beyond 1.96 standard deviations (95% confidence)
2. **Interquartile Range (IQR)**: Backup method for robustness
3. **Linear Regression**: Analyzes trends in recent performance data
4. **Confidence Intervals**: Ensures statistical significance

### Baseline Management

- **Update Policy**: New baselines set when 5% improvement sustained over 10 runs
- **Data Retention**: Keep 50 most recent performance runs
- **Stability Period**: Minimum 5 runs needed for trend analysis

### Example Detection Logic

```javascript
// Simplified regression detection
function detectRegression(currentValue, historicalStats) {
  const zScore = Math.abs((currentValue - historicalStats.mean) / historicalStats.stdDev);
  const regressionPercent = ((currentValue - historicalStats.mean) / historicalStats.mean) * 100;
  
  if (zScore > 1.96 && regressionPercent > thresholds.warning) {
    return { severity: 'warning', regression: regressionPercent };
  }
  
  if (zScore > 1.96 && regressionPercent > thresholds.error) {
    return { severity: 'error', regression: regressionPercent };
  }
  
  return { severity: 'ok' };
}
```

## Troubleshooting

### Common Issues

**1. "Performance tests failing locally but passing in CI"**
```bash
# Solution: Stabilize local environment
export NODE_ENV=test
node scripts/performance-monitor.js --ci
```

**2. "False positive regressions"**
- Check for environmental factors (high CPU usage, background tasks)
- Verify statistical significance settings in regression detector
- Consider increasing confidence intervals for noisy environments

**3. "Memory usage alerts"**
```bash
# Debug memory usage
node --inspect scripts/performance-monitor.js --memory
# Check for memory leaks in calculations
```

**4. "Baseline drift over time"**
- Normal for gradual improvements
- Baselines update automatically with consistent 5% improvements
- Manual reset: `npm run perf:baseline`

### Environment Issues

**CPU Governor:** CI sets CPU to performance mode for consistent results
```bash
# Linux: Check current governor
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor

# Set to performance (requires sudo)
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

**Node.js Optimization:** V8 warmup prevents inconsistent initial results
```bash
# Warmup is built into performance monitor
node scripts/performance-monitor.js  # Includes automatic warmup
```

## Integration with Quality Gates

The performance monitoring integrates with the overall quality gate system:

```bash
# Run all quality checks including performance
npm run quality:perf

# Individual quality components
npm run type-check    # TypeScript validation
npm run lint          # Code quality
npm run test:run      # Unit/integration tests
npm run perf:ci       # Performance benchmarks
```

### Quality Gate Failure Scenarios

1. **TypeScript Errors**: Block all development until resolved
2. **Test Failures**: Block deployment
3. **Critical Performance Regressions**: Block deployment
4. **Memory Leaks**: Block deployment
5. **Linting Issues**: Warning only (configurable)

## Maintenance

### Weekly Tasks
- Review performance trend reports
- Address performance warnings
- Update baselines if consistent improvements

### Monthly Tasks
- Analyze historical performance data
- Review and update performance budgets
- Update benchmark test cases for new features

### Quarterly Tasks
- Performance architecture review
- Evaluate new performance tooling
- Update performance standards based on user feedback

## Best Practices

### Writing Performance-Conscious Code

1. **Measure First**: Always benchmark before optimizing
2. **Profile Memory**: Check for memory leaks in calculation-heavy code
3. **Cache Wisely**: Cache expensive calculations, but watch memory usage
4. **Early Exit**: Implement early exits in optimization loops

### Adding New Benchmarks

1. **Realistic Data**: Use representative input sizes and complexity
2. **Appropriate Thresholds**: Set thresholds based on user experience needs
3. **Memory Monitoring**: Include memory usage checks for new calculations
4. **Edge Cases**: Test performance with extreme but valid inputs

### Code Review Checklist

- [ ] Performance impact assessed for changes
- [ ] Benchmarks updated for new calculation functions
- [ ] Memory usage considerations documented
- [ ] Performance tests passing locally

## Future Enhancements

### Planned Improvements

1. **Real User Monitoring (RUM)**
   - Client-side performance tracking
   - User experience metrics
   - Performance correlation with business metrics

2. **Advanced Analytics**
   - Performance regression predictions
   - Automated optimization suggestions
   - Cross-browser performance comparison

3. **Enhanced Reporting**
   - Performance dashboard with historical charts
   - Slack/Teams integration for alerts
   - Performance budget tracking per feature

---

*This guide is part of the BufoIndex Quality Assurance framework. Keep it updated as the performance monitoring system evolves.*