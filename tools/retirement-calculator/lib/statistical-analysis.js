/**
 * Statistical Analysis Utility
 * Portfolio distribution analysis and statistical computations
 */

class StatisticalAnalysis {
    /**
     * Calculate percentiles for a given dataset
     * @param {Array<number>} data - Sorted array of numerical data
     * @param {Array<number>} percentiles - Array of percentile values (e.g., [10, 25, 50, 75, 90])
     * @returns {Object} - Object with percentile values
     */
    static calculatePercentiles(data, percentiles) {
        if (!data || data.length === 0) {
            const result = {};
            percentiles.forEach(p => {
                result[`percentile${p}`] = 0;
            });
            return result;
        }

        // Ensure data is sorted
        const sortedData = [...data].sort((a, b) => a - b);
        const result = {};

        percentiles.forEach(percentile => {
            const index = (percentile / 100) * (sortedData.length - 1);
            
            if (index === Math.floor(index)) {
                // Exact index
                result[`percentile${percentile}`] = sortedData[index];
            } else {
                // Interpolate between two values
                const lower = Math.floor(index);
                const upper = Math.ceil(index);
                const weight = index - lower;
                
                result[`percentile${percentile}`] = 
                    sortedData[lower] * (1 - weight) + sortedData[upper] * weight;
            }
        });

        return result;
    }

    /**
     * Generate portfolio distribution data for charting
     * @param {Array<Object>} simulationResults - Array of simulation results
     * @returns {Object} - Distribution data formatted for charts
     */
    static generatePortfolioDistribution(simulationResults) {
        if (!simulationResults || simulationResults.length === 0) {
            return {
                bins: [],
                frequencies: [],
                statistics: {}
            };
        }

        // Extract portfolio values at retirement
        const portfolioValues = simulationResults
            .map(sim => sim.portfolioAtRetirement)
            .filter(val => val > 0)
            .sort((a, b) => a - b);

        if (portfolioValues.length === 0) {
            return {
                bins: [],
                frequencies: [],
                statistics: {}
            };
        }

        // Calculate basic statistics
        const min = Math.min(...portfolioValues);
        const max = Math.max(...portfolioValues);
        const mean = portfolioValues.reduce((sum, val) => sum + val, 0) / portfolioValues.length;
        const median = this.calculatePercentiles(portfolioValues, [50]).percentile50;

        // Calculate standard deviation
        const variance = portfolioValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / portfolioValues.length;
        const stdDev = Math.sqrt(variance);

        // Create histogram bins (using Sturges' rule for bin count)
        const binCount = Math.ceil(Math.log2(portfolioValues.length)) + 1;
        const binWidth = (max - min) / binCount;
        
        const bins = [];
        const frequencies = [];
        
        for (let i = 0; i < binCount; i++) {
            const binStart = min + (i * binWidth);
            const binEnd = binStart + binWidth;
            
            bins.push({
                start: binStart,
                end: binEnd,
                center: binStart + (binWidth / 2),
                label: `${this.formatCurrency(binStart)} - ${this.formatCurrency(binEnd)}`
            });
            
            // Count values in this bin
            const frequency = portfolioValues.filter(val => 
                val >= binStart && (i === binCount - 1 ? val <= binEnd : val < binEnd)
            ).length;
            
            frequencies.push(frequency);
        }

        return {
            bins,
            frequencies,
            statistics: {
                count: portfolioValues.length,
                min,
                max,
                mean,
                median,
                stdDev,
                variance,
                range: max - min,
                coefficientOfVariation: stdDev / mean
            }
        };
    }

    /**
     * Generate median yearly progression from multiple simulations
     * @param {Array<Object>} simulations - Array of simulation results
     * @returns {Array<Object>} - Median progression for charting
     */
    static generateMedianProgression(simulations) {
        if (!simulations || simulations.length === 0) {
            return [];
        }

        // Find the maximum age across all simulations
        const maxAge = Math.max(...simulations.map(sim => 
            Math.max(...sim.yearlyProgression.map(year => year.age))
        ));

        const minAge = Math.min(...simulations.map(sim => 
            Math.min(...sim.yearlyProgression.map(year => year.age))
        ));

        const medianProgression = [];

        // For each age, calculate median values across all simulations
        for (let age = minAge; age <= maxAge; age++) {
            const valuesAtAge = [];
            const withdrawalsAtAge = [];
            
            simulations.forEach(sim => {
                const yearData = sim.yearlyProgression.find(year => year.age === age);
                if (yearData) {
                    valuesAtAge.push(yearData.portfolioValue);
                    withdrawalsAtAge.push(yearData.withdrawal);
                }
            });

            if (valuesAtAge.length > 0) {
                const medianPortfolio = this.calculatePercentiles(valuesAtAge, [50]).percentile50;
                const medianWithdrawal = withdrawalsAtAge.length > 0 
                    ? this.calculatePercentiles(withdrawalsAtAge, [50]).percentile50 
                    : 0;

                // Calculate percentile bands for visualization
                const percentiles = this.calculatePercentiles(valuesAtAge, [10, 25, 75, 90]);

                medianProgression.push({
                    age,
                    portfolioValue: medianPortfolio,
                    withdrawal: medianWithdrawal,
                    percentile10: percentiles.percentile10,
                    percentile25: percentiles.percentile25,
                    percentile75: percentiles.percentile75,
                    percentile90: percentiles.percentile90,
                    simulationCount: valuesAtAge.length
                });
            }
        }

        return medianProgression;
    }

    /**
     * Calculate correlation between two datasets
     * @param {Array<number>} x - First dataset
     * @param {Array<number>} y - Second dataset
     * @returns {number} - Correlation coefficient (-1 to 1)
     */
    static calculateCorrelation(x, y) {
        if (!x || !y || x.length !== y.length || x.length === 0) {
            return 0;
        }

        const n = x.length;
        const meanX = x.reduce((sum, val) => sum + val, 0) / n;
        const meanY = y.reduce((sum, val) => sum + val, 0) / n;

        let numerator = 0;
        let sumXSquared = 0;
        let sumYSquared = 0;

        for (let i = 0; i < n; i++) {
            const xDiff = x[i] - meanX;
            const yDiff = y[i] - meanY;
            
            numerator += xDiff * yDiff;
            sumXSquared += xDiff * xDiff;
            sumYSquared += yDiff * yDiff;
        }

        const denominator = Math.sqrt(sumXSquared * sumYSquared);
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Perform sequence of returns risk analysis
     * @param {Array<Object>} simulations - Array of simulation results
     * @returns {Object} - Risk analysis results
     */
    static analyzeSequenceOfReturnsRisk(simulations) {
        if (!simulations || simulations.length === 0) {
            return {
                earlyYearReturns: [],
                lateYearReturns: [],
                correlation: 0,
                earlyYearImpact: 0,
                riskMetrics: {}
            };
        }

        const successfulSims = simulations.filter(sim => sim.success);
        const failedSims = simulations.filter(sim => !sim.success);

        // Analyze early retirement years (first 5 years) vs success rate
        const earlyYearReturns = [];
        const lateYearReturns = [];
        const finalPortfolioValues = [];

        simulations.forEach(sim => {
            const retirementPhase = sim.yearlyProgression.filter(year => year.phase === 'retirement');
            
            if (retirementPhase.length >= 5) {
                // Calculate average return for first 5 years of retirement
                const earlyReturns = retirementPhase.slice(0, 5);
                const avgEarlyReturn = earlyReturns.reduce((sum, year) => sum + year.annualReturn, 0) / 5;
                earlyYearReturns.push(avgEarlyReturn);

                // Calculate average return for years 6-10 (if available)
                if (retirementPhase.length >= 10) {
                    const lateReturns = retirementPhase.slice(5, 10);
                    const avgLateReturn = lateReturns.reduce((sum, year) => sum + year.annualReturn, 0) / 5;
                    lateYearReturns.push(avgLateReturn);
                } else {
                    lateYearReturns.push(null);
                }

                finalPortfolioValues.push(sim.finalPortfolioValue);
            }
        });

        // Calculate correlation between early year returns and final portfolio values
        const correlation = this.calculateCorrelation(earlyYearReturns, finalPortfolioValues);

        // Calculate impact of early poor returns
        const earlyYearImpact = this.calculateEarlyYearImpact(simulations);

        return {
            earlyYearReturns,
            lateYearReturns: lateYearReturns.filter(val => val !== null),
            correlation,
            earlyYearImpact,
            riskMetrics: {
                successfulSimulations: successfulSims.length,
                failedSimulations: failedSims.length,
                totalSimulations: simulations.length,
                averageFailureAge: failedSims.length > 0 
                    ? failedSims.reduce((sum, sim) => sum + (sim.failureAge || 0), 0) / failedSims.length 
                    : null
            }
        };
    }

    /**
     * Calculate the impact of early year returns on portfolio survival
     * @param {Array<Object>} simulations - Array of simulation results
     * @returns {number} - Impact score (0-1, higher means more sensitive to early returns)
     */
    static calculateEarlyYearImpact(simulations) {
        const retirementPhaseData = simulations.map(sim => {
            const retirementPhase = sim.yearlyProgression.filter(year => year.phase === 'retirement');
            
            if (retirementPhase.length >= 3) {
                const firstThreeYears = retirementPhase.slice(0, 3);
                const avgEarlyReturn = firstThreeYears.reduce((sum, year) => sum + year.annualReturn, 0) / 3;
                
                return {
                    avgEarlyReturn,
                    success: sim.success,
                    finalValue: sim.finalPortfolioValue
                };
            }
            
            return null;
        }).filter(data => data !== null);

        if (retirementPhaseData.length === 0) return 0;

        // Sort by early year returns
        retirementPhaseData.sort((a, b) => a.avgEarlyReturn - b.avgEarlyReturn);

        // Calculate success rates for bottom quartile vs top quartile
        const quartileSize = Math.floor(retirementPhaseData.length / 4);
        const bottomQuartile = retirementPhaseData.slice(0, quartileSize);
        const topQuartile = retirementPhaseData.slice(-quartileSize);

        const bottomSuccessRate = bottomQuartile.filter(d => d.success).length / bottomQuartile.length;
        const topSuccessRate = topQuartile.filter(d => d.success).length / topQuartile.length;

        // Impact score is the difference in success rates
        return Math.max(0, topSuccessRate - bottomSuccessRate);
    }

    /**
     * Format currency for display (without symbol for terminal aesthetics)
     * @param {number} amount - Dollar amount
     * @returns {string} - Formatted currency string
     */
    static formatCurrency(amount) {
        return Math.round(amount).toLocaleString();
    }

    /**
     * Generate confidence intervals for portfolio projections
     * @param {Array<Object>} simulations - Array of simulation results
     * @param {number} confidenceLevel - Confidence level (e.g., 0.95 for 95%)
     * @returns {Object} - Confidence interval data
     */
    static generateConfidenceIntervals(simulations, confidenceLevel = 0.95) {
        const alpha = 1 - confidenceLevel;
        const lowerPercentile = (alpha / 2) * 100;
        const upperPercentile = (1 - alpha / 2) * 100;

        // Find age range
        const allAges = [];
        simulations.forEach(sim => {
            sim.yearlyProgression.forEach(year => {
                if (!allAges.includes(year.age)) {
                    allAges.push(year.age);
                }
            });
        });
        allAges.sort((a, b) => a - b);

        const confidenceIntervals = [];

        allAges.forEach(age => {
            const valuesAtAge = simulations
                .map(sim => {
                    const yearData = sim.yearlyProgression.find(year => year.age === age);
                    return yearData ? yearData.portfolioValue : null;
                })
                .filter(val => val !== null);

            if (valuesAtAge.length > 0) {
                const percentiles = this.calculatePercentiles(valuesAtAge, [lowerPercentile, 50, upperPercentile]);
                
                confidenceIntervals.push({
                    age,
                    lower: percentiles[`percentile${lowerPercentile}`],
                    median: percentiles.percentile50,
                    upper: percentiles[`percentile${upperPercentile}`],
                    sampleSize: valuesAtAge.length
                });
            }
        });

        return {
            confidenceLevel,
            intervals: confidenceIntervals
        };
    }

    /**
     * Calculate Value at Risk (VaR) for portfolio at retirement
     * @param {Array<number>} portfolioValues - Array of portfolio values at retirement
     * @param {number} confidenceLevel - Confidence level (e.g., 0.05 for 5% VaR)
     * @returns {Object} - VaR analysis
     */
    static calculateValueAtRisk(portfolioValues, confidenceLevel = 0.05) {
        if (!portfolioValues || portfolioValues.length === 0) {
            return {
                var: 0,
                expectedShortfall: 0,
                confidenceLevel
            };
        }

        const sortedValues = [...portfolioValues].sort((a, b) => a - b);
        const varIndex = Math.floor(confidenceLevel * sortedValues.length);
        const var5 = sortedValues[varIndex];

        // Calculate Expected Shortfall (average of values below VaR)
        const shortfallValues = sortedValues.slice(0, varIndex + 1);
        const expectedShortfall = shortfallValues.length > 0 
            ? shortfallValues.reduce((sum, val) => sum + val, 0) / shortfallValues.length 
            : 0;

        return {
            var: var5,
            expectedShortfall,
            confidenceLevel,
            percentOfScenarios: (varIndex / sortedValues.length) * 100
        };
    }
}

// Export for use in other modules
window.StatisticalAnalysis = StatisticalAnalysis;