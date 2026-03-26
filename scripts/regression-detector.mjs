#!/usr/bin/env node

/**
 * BufoIndex Performance Regression Detector
 * 
 * Automated system for detecting performance regressions across builds
 * Compares current performance against historical baselines and trends
 * 
 * Features:
 * - Historical trend analysis
 * - Anomaly detection using statistical analysis
 * - Baseline drift prevention  
 * - Alert generation for CI/CD integration
 * - Performance budget enforcement
 */

import fs from 'fs/promises';
import path from 'path';

const REGRESSION_SETTINGS = {
  // Regression thresholds by test category
  thresholds: {
    basic_calculations: { warning: 10, error: 25 },    // % increase
    complex_tax: { warning: 15, error: 30 },
    monte_carlo: { warning: 20, error: 40 },
    memory_usage: { warning: 25, error: 50 },
    component_render: { warning: 10, error: 25 }
  },
  
  // Historical data requirements
  minHistoricalRuns: 5,           // Minimum runs for trend analysis
  maxHistoricalRuns: 50,          // Maximum runs to keep in history
  confidenceInterval: 0.95,      // Statistical confidence for outlier detection
  
  // Baseline update policies
  baselineUpdateThreshold: 0.05,  // Update baseline if consistent 5% improvement
  baselineStabilityPeriod: 10,    // Runs needed to establish stable baseline
};

class RegressionDetector {
  constructor() {
    this.historyFile = path.join(process.cwd(), '.performance-history.json');
    this.baselinesFile = path.join(process.cwd(), '.performance-baselines.json');
    this.alertsFile = path.join(process.cwd(), '.performance-alerts.json');
    this.history = [];
    this.baselines = null;
  }

  /**
   * Load performance history
   */
  async loadHistory() {
    try {
      const data = await fs.readFile(this.historyFile, 'utf8');
      this.history = JSON.parse(data);
      console.log(`📊 Loaded ${this.history.length} historical performance runs`);
    } catch (error) {
      console.log('ℹ️  No performance history found, starting fresh');
      this.history = [];
    }
  }

  /**
   * Load current baselines
   */
  async loadBaselines() {
    try {
      const data = await fs.readFile(this.baselinesFile, 'utf8');
      this.baselines = JSON.parse(data);
      console.log('📋 Loaded performance baselines');
    } catch (error) {
      console.log('⚠️  No performance baselines found');
      this.baselines = null;
    }
  }

  /**
   * Save updated history
   */
  async saveHistory() {
    // Keep only the most recent runs
    if (this.history.length > REGRESSION_SETTINGS.maxHistoricalRuns) {
      this.history = this.history.slice(-REGRESSION_SETTINGS.maxHistoricalRuns);
    }
    
    await fs.writeFile(this.historyFile, JSON.stringify(this.history, null, 2));
    console.log(`💾 Saved performance history (${this.history.length} runs)`);
  }

  /**
   * Add new performance run to history
   */
  addToHistory(results, metadata = {}) {
    const run = {
      timestamp: new Date().toISOString(),
      version: metadata.version || 'unknown',
      branch: metadata.branch || 'unknown',
      environment: metadata.environment || 'local',
      results: results
    };
    
    this.history.push(run);
  }

  /**
   * Calculate statistical measures for test performance
   */
  calculateStats(testName, category) {
    const relevantRuns = this.history
      .filter(run => run.results[category])
      .map(run => {
        const test = run.results[category].find(t => t.name === testName);
        return test ? test.duration : null;
      })
      .filter(duration => duration !== null);

    if (relevantRuns.length === 0) return null;

    const sorted = relevantRuns.sort((a, b) => a - b);
    const mean = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
    const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      count: sorted.length,
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      stdDev,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      recent: sorted.slice(-5) // Last 5 runs
    };
  }

  /**
   * Detect outliers using statistical analysis
   */
  isOutlier(value, stats, confidenceLevel = REGRESSION_SETTINGS.confidenceInterval) {
    if (!stats || stats.count < REGRESSION_SETTINGS.minHistoricalRuns) {
      return { isOutlier: false, reason: 'insufficient_data' };
    }

    // Z-score based outlier detection
    const zScore = Math.abs((value - stats.mean) / stats.stdDev);
    const zThreshold = confidenceLevel === 0.95 ? 1.96 : 2.58; // 95% or 99%

    if (zScore > zThreshold) {
      return {
        isOutlier: true,
        reason: 'statistical_outlier',
        zScore: zScore.toFixed(2),
        threshold: zThreshold
      };
    }

    // Interquartile range (IQR) method as backup
    const q1 = stats.recent[Math.floor(stats.recent.length * 0.25)];
    const q3 = stats.recent[Math.floor(stats.recent.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    if (value < lowerBound || value > upperBound) {
      return {
        isOutlier: true,
        reason: 'iqr_outlier',
        bounds: [lowerBound, upperBound]
      };
    }

    return { isOutlier: false, reason: 'within_bounds' };
  }

  /**
   * Detect trend in recent performance data
   */
  detectTrend(testName, category) {
    const stats = this.calculateStats(testName, category);
    if (!stats || stats.recent.length < 3) {
      return { trend: 'unknown', confidence: 0 };
    }

    // Simple linear regression on recent data
    const n = stats.recent.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = stats.recent;
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const rSquared = this.calculateRSquared(x, y, slope);
    
    let trend = 'stable';
    if (Math.abs(slope) > stats.mean * 0.05) { // 5% change considered significant
      trend = slope > 0 ? 'degrading' : 'improving';
    }
    
    return {
      trend,
      slope: slope.toFixed(3),
      confidence: rSquared.toFixed(3),
      recentMean: y.reduce((sum, val) => sum + val, 0) / n
    };
  }

  /**
   * Calculate R-squared for trend confidence
   */
  calculateRSquared(x, y, slope) {
    const n = x.length;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;
    const intercept = yMean - slope * (x.reduce((sum, val) => sum + val, 0) / n);
    
    let ssRes = 0; // Sum of squares of residuals
    let ssTot = 0; // Total sum of squares
    
    for (let i = 0; i < n; i++) {
      const predicted = slope * x[i] + intercept;
      ssRes += Math.pow(y[i] - predicted, 2);
      ssTot += Math.pow(y[i] - yMean, 2);
    }
    
    return 1 - (ssRes / ssTot);
  }

  /**
   * Detect regressions in current run against history
   */
  async detectRegressions(currentResults) {
    const regressions = [];
    const improvements = [];
    const alerts = [];

    for (const [category, tests] of Object.entries(currentResults)) {
      for (const test of tests) {
        const stats = this.calculateStats(test.name, category);
        
        if (!stats) {
          // First run for this test
          continue;
        }

        // Check for statistical outliers
        const outlier = this.isOutlier(test.duration, stats);
        
        // Check for trend-based regressions
        const trend = this.detectTrend(test.name, category);
        
        // Calculate regression percentage vs baseline
        let regressionVsBaseline = 0;
        if (this.baselines && this.baselines.results[category]) {
          const baseline = this.baselines.results[category].find(b => b.name === test.name);
          if (baseline) {
            regressionVsBaseline = ((test.duration - baseline.duration) / baseline.duration) * 100;
          }
        }

        // Calculate regression vs recent mean
        const regressionVsRecent = ((test.duration - stats.mean) / stats.mean) * 100;

        // Determine thresholds for this category
        const thresholds = REGRESSION_SETTINGS.thresholds[category] || 
                          REGRESSION_SETTINGS.thresholds.basic_calculations;

        // Generate alerts based on analysis
        const alert = {
          test: test.name,
          category,
          current: test.duration,
          baseline: stats.mean,
          regression: regressionVsRecent,
          regressionVsBaseline,
          trend: trend.trend,
          outlier: outlier.isOutlier,
          severity: 'info'
        };

        // Determine alert severity
        if (outlier.isOutlier && regressionVsRecent > thresholds.error) {
          alert.severity = 'error';
          regressions.push(alert);
        } else if (outlier.isOutlier && regressionVsRecent > thresholds.warning) {
          alert.severity = 'warning';
          regressions.push(alert);
        } else if (trend.trend === 'degrading' && trend.confidence > 0.7) {
          alert.severity = 'warning';
          alert.reason = 'degrading_trend';
          regressions.push(alert);
        } else if (regressionVsRecent < -10) { // 10% improvement
          improvements.push({
            ...alert,
            improvement: Math.abs(regressionVsRecent),
            severity: 'improvement'
          });
        }

        alerts.push(alert);
      }
    }

    return { regressions, improvements, alerts };
  }

  /**
   * Generate regression report
   */
  generateRegressionReport(analysis) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_tests: analysis.alerts.length,
        regressions: analysis.regressions.length,
        improvements: analysis.improvements.length,
        errors: analysis.regressions.filter(r => r.severity === 'error').length,
        warnings: analysis.regressions.filter(r => r.severity === 'warning').length
      },
      regressions: analysis.regressions,
      improvements: analysis.improvements,
      all_alerts: analysis.alerts,
      settings: REGRESSION_SETTINGS
    };

    return report;
  }

  /**
   * Save alerts for CI/CD integration
   */
  async saveAlerts(alerts) {
    await fs.writeFile(this.alertsFile, JSON.stringify(alerts, null, 2));
    console.log(`🚨 Saved ${alerts.regressions.length} performance alerts`);
  }

  /**
   * Print regression analysis to console
   */
  printRegressionAnalysis(analysis) {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 PERFORMANCE REGRESSION ANALYSIS');
    console.log('='.repeat(60));

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Tests Analyzed: ${analysis.alerts.length}`);
    console.log(`   Regressions Found: ${analysis.regressions.length}`);
    console.log(`   Improvements Found: ${analysis.improvements.length}`);
    
    const errors = analysis.regressions.filter(r => r.severity === 'error');
    const warnings = analysis.regressions.filter(r => r.severity === 'warning');
    console.log(`   Errors: ${errors.length} ❌`);
    console.log(`   Warnings: ${warnings.length} ⚠️`);

    if (errors.length > 0) {
      console.log(`\n❌ CRITICAL REGRESSIONS:`);
      errors.forEach(reg => {
        console.log(`   ${reg.test} (${reg.category}):`);
        console.log(`     Current: ${reg.current.toFixed(1)}ms`);
        console.log(`     Baseline: ${reg.baseline.toFixed(1)}ms`);
        console.log(`     Regression: +${reg.regression.toFixed(1)}%`);
        if (reg.outlier) console.log(`     📈 Statistical outlier detected`);
      });
    }

    if (warnings.length > 0) {
      console.log(`\n⚠️  PERFORMANCE WARNINGS:`);
      warnings.forEach(warn => {
        console.log(`   ${warn.test} (${warn.category}):`);
        console.log(`     Current: ${warn.current.toFixed(1)}ms (+${warn.regression.toFixed(1)}%)`);
        if (warn.trend === 'degrading') {
          console.log(`     📉 Degrading trend detected`);
        }
      });
    }

    if (analysis.improvements.length > 0) {
      console.log(`\n🚀 PERFORMANCE IMPROVEMENTS:`);
      analysis.improvements.forEach(imp => {
        console.log(`   ${imp.test}: ${imp.current.toFixed(1)}ms (-${imp.improvement.toFixed(1)}%)`);
      });
    }

    console.log('\n' + '='.repeat(60));

    return errors.length === 0; // Return true if no critical errors
  }

  /**
   * Main execution function
   */
  async analyze(currentResults, metadata = {}) {
    console.log('🔍 Starting performance regression analysis...');
    
    // Load historical data
    await this.loadHistory();
    await this.loadBaselines();
    
    // Add current run to history
    this.addToHistory(currentResults, metadata);
    
    // Detect regressions
    const analysis = await this.detectRegressions(currentResults);
    
    // Generate and print report
    const passed = this.printRegressionAnalysis(analysis);
    const report = this.generateRegressionReport(analysis);
    
    // Save updated history and alerts
    await this.saveHistory();
    await this.saveAlerts(report);
    
    return { passed, report };
  }
}

export { RegressionDetector, REGRESSION_SETTINGS };