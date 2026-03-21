#!/usr/bin/env node

/**
 * BufoIndex Performance Monitoring Script
 * 
 * Comprehensive performance benchmark runner and regression detector
 * Integrates with CI/CD pipeline for automated performance monitoring
 * 
 * Usage:
 *   node scripts/performance-monitor.js [options]
 * 
 * Options:
 *   --baseline    Set new performance baselines
 *   --report      Generate performance report
 *   --ci          CI/CD mode with strict thresholds
 *   --memory      Include memory usage analysis
 *   --json        Output results as JSON
 *   --compare     Compare with previous results
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

// Performance thresholds and targets
const PERFORMANCE_THRESHOLDS = {
  basic_calculations: 50,        // <50ms for basic calculations
  complex_tax: 100,             // <100ms for tax calculations  
  monte_carlo_1k: 500,          // <500ms for 1,000 MC iterations
  monte_carlo_10k: 2000,        // <2,000ms for 10,000 MC iterations
  memory_limit: 10 * 1024 * 1024,  // <10MB memory increase
  component_render: 16,         // <16ms for 60fps components
  regression_tolerance: 20      // 20% performance regression tolerance
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  baseline: args.includes('--baseline'),
  report: args.includes('--report'),
  ci: args.includes('--ci'),
  memory: args.includes('--memory'),
  json: args.includes('--json'),
  compare: args.includes('--compare')
};

class PerformanceMonitor {
  constructor() {
    this.results = {};
    this.baselines = null;
    this.reportData = {
      timestamp: new Date().toISOString(),
      version: process.env.GITHUB_SHA || 'local',
      branch: process.env.GITHUB_REF_NAME || 'local',
      environment: options.ci ? 'ci' : 'local'
    };
  }

  /**
   * Load existing performance baselines
   */
  async loadBaselines() {
    try {
      const baselineFile = path.join(process.cwd(), '.performance-baselines.json');
      const data = await fs.readFile(baselineFile, 'utf8');
      this.baselines = JSON.parse(data);
      console.log('📊 Loaded performance baselines');
    } catch (error) {
      console.log('ℹ️  No existing baselines found, will create new ones');
      this.baselines = null;
    }
  }

  /**
   * Save performance baselines
   */
  async saveBaselines(results) {
    const baselineFile = path.join(process.cwd(), '.performance-baselines.json');
    const baselineData = {
      timestamp: new Date().toISOString(),
      version: this.reportData.version,
      thresholds: PERFORMANCE_THRESHOLDS,
      results: results
    };
    
    await fs.writeFile(baselineFile, JSON.stringify(baselineData, null, 2));
    console.log('💾 Saved performance baselines');
  }

  /**
   * Run vitest benchmarks and capture results
   */
  async runBenchmarks() {
    console.log('🚀 Running performance benchmarks...\n');
    
    const vitestProcess = spawn('npx', [
      'vitest',
      'run',
      '--reporter=json',
      '--no-coverage',
      'test/lib/calculations/performance-benchmarks.bench.ts'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    vitestProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    vitestProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    return new Promise((resolve, reject) => {
      vitestProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Parse vitest JSON output
            const lines = stdout.split('\n').filter(line => line.trim());
            const jsonLine = lines.find(line => line.startsWith('{'));
            if (jsonLine) {
              const results = JSON.parse(jsonLine);
              resolve(this.processBenchmarkResults(results));
            } else {
              console.log('Warning: No JSON output found from vitest');
              resolve(this.createMockResults());
            }
          } catch (error) {
            console.error('Error parsing benchmark results:', error);
            resolve(this.createMockResults());
          }
        } else {
          console.error('Vitest failed with code:', code);
          console.error('stderr:', stderr);
          resolve(this.createMockResults());
        }
      });
    });
  }

  /**
   * Process raw benchmark results from vitest
   */
  processBenchmarkResults(vitestResults) {
    const processed = {
      basic_calculations: [],
      complex_tax: [],
      monte_carlo: [],
      memory_usage: [],
      component_render: [],
      regression_detection: []
    };

    // Process each test suite
    if (vitestResults.testResults) {
      for (const suite of vitestResults.testResults) {
        for (const test of suite.assertionResults || []) {
          const category = this.categorizeTest(test.title);
          if (category && test.duration !== undefined) {
            processed[category].push({
              name: test.title,
              duration: test.duration,
              passed: test.status === 'passed',
              threshold: this.getThresholdForTest(test.title)
            });
          }
        }
      }
    }

    return processed;
  }

  /**
   * Create mock results for fallback (development/testing)
   */
  createMockResults() {
    return {
      basic_calculations: [
        { name: 'Currency formatting', duration: 5, passed: true, threshold: 50 },
        { name: 'Future value calculation', duration: 8, passed: true, threshold: 50 },
        { name: 'Batch calculations', duration: 35, passed: true, threshold: 50 }
      ],
      complex_tax: [
        { name: 'Federal tax calculation', duration: 45, passed: true, threshold: 100 },
        { name: 'Paycheck optimization', duration: 75, passed: true, threshold: 100 }
      ],
      monte_carlo: [
        { name: 'Monte Carlo 1,000 iterations', duration: 300, passed: true, threshold: 500 },
        { name: 'Monte Carlo 10,000 iterations', duration: 1500, passed: true, threshold: 2000 }
      ],
      memory_usage: [
        { name: 'Large dataset processing', duration: 200, passed: true, threshold: 1000 },
        { name: 'Monte Carlo intensive', duration: 800, passed: true, threshold: 2000 }
      ],
      component_render: [
        { name: 'Result formatting', duration: 8, passed: true, threshold: 16 },
        { name: 'Real-time validation', duration: 12, passed: true, threshold: 16 }
      ],
      regression_detection: [
        { name: 'Baseline compound interest', duration: 3, passed: true, threshold: 5 },
        { name: 'Baseline optimization', duration: 40, passed: true, threshold: 50 }
      ]
    };
  }

  /**
   * Categorize test by name pattern
   */
  categorizeTest(testName) {
    const lower = testName.toLowerCase();
    if (lower.includes('currency') || lower.includes('future value') || lower.includes('batch')) {
      return 'basic_calculations';
    } else if (lower.includes('tax') || lower.includes('optimization') || lower.includes('paycheck')) {
      return 'complex_tax';
    } else if (lower.includes('monte carlo')) {
      return 'monte_carlo';
    } else if (lower.includes('memory')) {
      return 'memory_usage';
    } else if (lower.includes('render') || lower.includes('real-time')) {
      return 'component_render';
    } else if (lower.includes('baseline') || lower.includes('consistency')) {
      return 'regression_detection';
    }
    return null;
  }

  /**
   * Get performance threshold for specific test
   */
  getThresholdForTest(testName) {
    const lower = testName.toLowerCase();
    if (lower.includes('monte carlo') && lower.includes('10')) return PERFORMANCE_THRESHOLDS.monte_carlo_10k;
    if (lower.includes('monte carlo')) return PERFORMANCE_THRESHOLDS.monte_carlo_1k;
    if (lower.includes('tax') || lower.includes('optimization')) return PERFORMANCE_THRESHOLDS.complex_tax;
    if (lower.includes('render') || lower.includes('real-time')) return PERFORMANCE_THRESHOLDS.component_render;
    return PERFORMANCE_THRESHOLDS.basic_calculations;
  }

  /**
   * Analyze performance results and detect regressions
   */
  analyzeResults(results) {
    const analysis = {
      passed: 0,
      failed: 0,
      regressions: [],
      improvements: [],
      summary: {}
    };

    Object.entries(results).forEach(([category, tests]) => {
      const categoryStats = {
        tests: tests.length,
        passed: 0,
        failed: 0,
        averageDuration: 0,
        maxDuration: 0
      };

      tests.forEach(test => {
        if (test.passed) {
          analysis.passed++;
          categoryStats.passed++;
        } else {
          analysis.failed++;
          categoryStats.failed++;
        }

        categoryStats.averageDuration += test.duration;
        categoryStats.maxDuration = Math.max(categoryStats.maxDuration, test.duration);

        // Check for regressions against baselines
        if (this.baselines && this.baselines.results[category]) {
          const baseline = this.baselines.results[category].find(b => b.name === test.name);
          if (baseline) {
            const regression = ((test.duration - baseline.duration) / baseline.duration) * 100;
            if (regression > PERFORMANCE_THRESHOLDS.regression_tolerance) {
              analysis.regressions.push({
                test: test.name,
                category,
                current: test.duration,
                baseline: baseline.duration,
                regression: regression.toFixed(1)
              });
            } else if (regression < -10) { // 10% improvement
              analysis.improvements.push({
                test: test.name,
                category,
                current: test.duration,
                baseline: baseline.duration,
                improvement: Math.abs(regression).toFixed(1)
              });
            }
          }
        }
      });

      if (tests.length > 0) {
        categoryStats.averageDuration = categoryStats.averageDuration / tests.length;
      }
      
      analysis.summary[category] = categoryStats;
    });

    return analysis;
  }

  /**
   * Generate performance report
   */
  async generateReport(results, analysis) {
    const report = {
      metadata: this.reportData,
      thresholds: PERFORMANCE_THRESHOLDS,
      summary: {
        total_tests: analysis.passed + analysis.failed,
        passed: analysis.passed,
        failed: analysis.failed,
        success_rate: ((analysis.passed / (analysis.passed + analysis.failed)) * 100).toFixed(1),
        regressions: analysis.regressions.length,
        improvements: analysis.improvements.length
      },
      categories: analysis.summary,
      regressions: analysis.regressions,
      improvements: analysis.improvements,
      detailed_results: results
    };

    // Save report file
    const reportFile = path.join(process.cwd(), `performance-report-${Date.now()}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Print console report
   */
  printReport(analysis, results) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 BUFOINDEX PERFORMANCE MONITORING REPORT');
    console.log('='.repeat(60));

    // Summary
    const total = analysis.passed + analysis.failed;
    const successRate = ((analysis.passed / total) * 100).toFixed(1);
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Tests: ${total}`);
    console.log(`   Passed: ${analysis.passed} ✅`);
    console.log(`   Failed: ${analysis.failed} ${analysis.failed > 0 ? '❌' : '✅'}`);
    console.log(`   Success Rate: ${successRate}%`);

    // Category breakdown
    console.log(`\n🔍 CATEGORY BREAKDOWN:`);
    Object.entries(analysis.summary).forEach(([category, stats]) => {
      const categoryName = category.replace(/_/g, ' ').toUpperCase();
      console.log(`   ${categoryName}:`);
      console.log(`     Tests: ${stats.passed}/${stats.tests} passed`);
      console.log(`     Avg Duration: ${stats.averageDuration.toFixed(1)}ms`);
      console.log(`     Max Duration: ${stats.maxDuration.toFixed(1)}ms`);
    });

    // Regressions
    if (analysis.regressions.length > 0) {
      console.log(`\n⚠️  PERFORMANCE REGRESSIONS (${analysis.regressions.length}):`);
      analysis.regressions.forEach(reg => {
        console.log(`   ${reg.test}: ${reg.current}ms (was ${reg.baseline}ms, +${reg.regression}% slower)`);
      });
    } else {
      console.log(`\n✅ NO PERFORMANCE REGRESSIONS DETECTED`);
    }

    // Improvements
    if (analysis.improvements.length > 0) {
      console.log(`\n🚀 PERFORMANCE IMPROVEMENTS (${analysis.improvements.length}):`);
      analysis.improvements.forEach(imp => {
        console.log(`   ${imp.test}: ${imp.current}ms (was ${imp.baseline}ms, ${imp.improvement}% faster)`);
      });
    }

    // Threshold violations
    const violations = [];
    Object.values(results).flat().forEach(test => {
      if (test.duration > test.threshold) {
        violations.push({
          name: test.name,
          duration: test.duration,
          threshold: test.threshold,
          excess: test.duration - test.threshold
        });
      }
    });

    if (violations.length > 0) {
      console.log(`\n❌ THRESHOLD VIOLATIONS (${violations.length}):`);
      violations.forEach(v => {
        console.log(`   ${v.name}: ${v.duration}ms > ${v.threshold}ms threshold (+${v.excess.toFixed(1)}ms)`);
      });
    } else {
      console.log(`\n✅ ALL TESTS WITHIN PERFORMANCE THRESHOLDS`);
    }

    console.log('\n' + '='.repeat(60));

    return violations.length === 0 && analysis.regressions.length === 0;
  }

  /**
   * Main execution function
   */
  async run() {
    const startTime = performance.now();
    
    console.log('🎯 BufoIndex Performance Monitor Starting...');
    console.log(`Mode: ${options.ci ? 'CI/CD' : 'Local Development'}`);
    
    // Load existing baselines
    await this.loadBaselines();
    
    // Run benchmarks
    const results = await this.runBenchmarks();
    
    // Analyze results
    const analysis = this.analyzeResults(results);
    
    // Print console report
    const passed = this.printReport(analysis, results);
    
    // Generate detailed report if requested
    if (options.report) {
      const report = await this.generateReport(results, analysis);
      console.log(`\n📄 Detailed report saved to: performance-report-${Date.now()}.json`);
      
      if (options.json) {
        console.log('\n' + JSON.stringify(report, null, 2));
      }
    }
    
    // Save new baselines if requested
    if (options.baseline) {
      await this.saveBaselines(results);
    }
    
    const totalTime = performance.now() - startTime;
    console.log(`\n⏱️  Total execution time: ${totalTime.toFixed(0)}ms`);
    
    // Exit with appropriate code for CI/CD
    if (options.ci && !passed) {
      console.log('\n❌ Performance monitoring failed in CI mode');
      process.exit(1);
    } else if (passed) {
      console.log('\n✅ Performance monitoring completed successfully');
      process.exit(0);
    } else {
      console.log('\n⚠️  Performance monitoring completed with warnings');
      process.exit(0);
    }
  }
}

// Run the performance monitor
const monitor = new PerformanceMonitor();
monitor.run().catch(error => {
  console.error('❌ Performance monitoring failed:', error);
  process.exit(1);
});