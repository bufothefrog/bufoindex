/**
 * Monte Carlo Simulation Engine
 * Core stochastic simulation capabilities for retirement planning
 */

class MonteCarloEngine {
    /**
     * Box-Muller transform for generating normally distributed random numbers
     * @param {number} mean - Mean of the distribution
     * @param {number} stdDev - Standard deviation of the distribution
     * @returns {number} - Random number from normal distribution
     */
    static boxMullerRandom(mean = 0, stdDev = 1) {
        if (MonteCarloEngine._hasSpare) {
            MonteCarloEngine._hasSpare = false;
            return MonteCarloEngine._spare * stdDev + mean;
        }

        MonteCarloEngine._hasSpare = true;
        
        // Ensure we don't get 0 for u1 (would cause log(0) = -Infinity)
        let u1, u2;
        do {
            u1 = Math.random();
        } while (u1 === 0);
        u2 = Math.random();
        
        const mag = stdDev * Math.sqrt(-2.0 * Math.log(u1));
        MonteCarloEngine._spare = mag * Math.cos(2.0 * Math.PI * u2);
        
        return mag * Math.sin(2.0 * Math.PI * u2) + mean;
    }

    /**
     * Generate a sequence of random returns for a given year period
     * @param {number} years - Number of years to simulate
     * @param {number} meanReturn - Expected annual return (e.g., 0.07 for 7%)
     * @param {number} volatility - Standard deviation of returns (e.g., 0.15 for 15%)
     * @param {number} seed - Optional seed for deterministic results
     * @returns {Array<number>} - Array of annual returns
     */
    static generateReturnSequence(years, meanReturn, volatility, seed = null) {
        if (seed !== null) {
            // Simple seed-based random number generator for deterministic results
            let seedState = seed;
            Math.random = () => {
                seedState = (seedState * 9301 + 49297) % 233280;
                return seedState / 233280;
            };
        }

        const returns = [];
        for (let i = 0; i < years; i++) {
            returns.push(this.boxMullerRandom(meanReturn, volatility));
        }
        
        return returns;
    }

    /**
     * Simulate a single retirement scenario with stochastic returns
     * @param {Object} scenario - Scenario parameters
     * @param {Object} assumptions - Market assumptions
     * @param {number} simulationId - ID for this simulation run
     * @returns {Object} - Simulation results
     */
    static simulateSingleScenario(scenario, assumptions, simulationId = 0) {
        const {
            retirementAge,
            targetIncome,
            startingAge,
            startingBalance,
            lifeExpectancy = 100,
            endAge = 85
        } = scenario;

        const {
            inflationRate,
            accumulationReturn,
            retirementReturn,
            volatility
        } = assumptions;

        const yearsUntilRetirement = retirementAge - startingAge;
        const yearsInRetirement = (endAge || lifeExpectancy) - retirementAge;
        
        if (yearsUntilRetirement <= 0) {
            return {
                success: false,
                portfolioAtRetirement: 0,
                yearlyProgression: [],
                failureAge: null,
                reason: 'Invalid retirement age'
            };
        }

        // Calculate inflation-adjusted target income at retirement
        const inflatedTargetIncome = targetIncome * Math.pow(1 + inflationRate, yearsUntilRetirement);
        
        // Generate return sequences for accumulation and retirement phases
        const accumulationReturns = this.generateReturnSequence(
            yearsUntilRetirement, 
            accumulationReturn, 
            volatility,
            simulationId * 1000 + 1 // Seed for deterministic testing
        );
        
        const retirementReturns = this.generateReturnSequence(
            yearsInRetirement, 
            retirementReturn, 
            volatility,
            simulationId * 1000 + 2 // Different seed for retirement phase
        );

        // Accumulation phase simulation
        let portfolioValue = startingBalance;
        const yearlyProgression = [];
        
        // Calculate required annual contribution using deterministic method first
        const targetPortfolioSize = inflatedTargetIncome / 0.04; // 4% rule
        
        // Calculate required annual contribution manually (to avoid circular dependency)
        let requiredAnnualContribution = 0;
        if (yearsUntilRetirement > 0) {
            if (accumulationReturn === 0) {
                requiredAnnualContribution = (targetPortfolioSize - startingBalance) / yearsUntilRetirement;
            } else {
                const factor = Math.pow(1 + accumulationReturn, yearsUntilRetirement);
                const numerator = targetPortfolioSize - startingBalance * factor;
                const denominator = (factor - 1) / accumulationReturn;
                requiredAnnualContribution = numerator / denominator;
            }
        }

        // Simulate accumulation phase with stochastic returns
        for (let year = 0; year < yearsUntilRetirement; year++) {
            const currentAge = startingAge + year;
            const annualReturn = accumulationReturns[year];
            
            // Apply return first, then add contribution
            portfolioValue = portfolioValue * (1 + annualReturn) + requiredAnnualContribution;
            
            yearlyProgression.push({
                age: currentAge,
                portfolioValue: Math.max(0, portfolioValue),
                withdrawal: 0,
                annualReturn: annualReturn,
                phase: 'accumulation'
            });
        }

        const portfolioAtRetirement = portfolioValue;
        
        // Retirement phase simulation
        let currentWithdrawal = inflatedTargetIncome;
        let failureAge = null;
        
        for (let year = 0; year < yearsInRetirement; year++) {
            const currentAge = retirementAge + year;
            const annualReturn = retirementReturns[year];
            
            // Withdraw at beginning of year (inflation-adjusted)
            currentWithdrawal = inflatedTargetIncome * Math.pow(1 + inflationRate, year);
            portfolioValue -= currentWithdrawal;
            
            // Check for portfolio failure
            if (portfolioValue < 0 && failureAge === null) {
                failureAge = currentAge;
                portfolioValue = 0;
                // Stop simulation immediately when portfolio fails
                yearlyProgression.push({
                    age: currentAge,
                    portfolioValue: 0,
                    withdrawal: currentWithdrawal,
                    annualReturn: annualReturn,
                    phase: 'retirement'
                });
                break;
            }
            
            // Apply return to remaining portfolio
            if (portfolioValue > 0) {
                portfolioValue = portfolioValue * (1 + annualReturn);
            }
            
            yearlyProgression.push({
                age: currentAge,
                portfolioValue: Math.max(0, portfolioValue),
                withdrawal: currentWithdrawal,
                annualReturn: annualReturn,
                phase: 'retirement'
            });
        }

        return {
            success: failureAge === null,
            portfolioAtRetirement,
            yearlyProgression,
            failureAge,
            finalPortfolioValue: portfolioValue,
            totalWithdrawals: yearlyProgression
                .filter(y => y.phase === 'retirement')
                .reduce((sum, y) => sum + y.withdrawal, 0)
        };
    }

    /**
     * Run Monte Carlo simulations for multiple scenarios
     * @param {Array<Object>} scenarios - Array of scenario configurations
     * @param {Object} assumptions - Market and inflation assumptions
     * @returns {Object} - Comprehensive simulation results
     */
    static runSimulations(scenarios, assumptions) {
        const { monteCarloRuns = 1000 } = assumptions;
        const results = {
            scenarios: [],
            executionTime: 0,
            totalSimulations: scenarios.length * monteCarloRuns
        };

        const startTime = performance.now();

        scenarios.forEach((scenario, scenarioIndex) => {
            console.log(`Running ${monteCarloRuns} simulations for Scenario ${String.fromCharCode(65 + scenarioIndex)}...`);
            
            const scenarioResults = {
                scenario: String.fromCharCode(65 + scenarioIndex), // A, B, C, etc.
                retirementAge: scenario.retirementAge,
                successRate: 0,
                portfolioAtRetirement: {
                    median: 0,
                    mean: 0,
                    percentile10: 0,
                    percentile25: 0,
                    percentile75: 0,
                    percentile90: 0,
                    min: Infinity,
                    max: -Infinity
                },
                finalPortfolioValue: {
                    median: 0,
                    mean: 0,
                    percentile10: 0,
                    percentile25: 0,
                    percentile75: 0,
                    percentile90: 0
                },
                failureAgeDistribution: [],
                yearlyProgression: [], // Will store median progression
                allSimulations: [] // Store all simulation results for analysis
            };

            // Run simulations for this scenario
            const simulations = [];
            let successfulSimulations = 0;

            for (let run = 0; run < monteCarloRuns; run++) {
                const simulation = this.simulateSingleScenario(scenario, assumptions, run);
                simulations.push(simulation);
                
                if (simulation.success) {
                    successfulSimulations++;
                }
            }

            // Calculate success rate
            scenarioResults.successRate = successfulSimulations / monteCarloRuns;

            // Extract portfolio values at retirement
            const portfolioAtRetirementValues = simulations
                .map(sim => sim.portfolioAtRetirement)
                .filter(val => val > 0)
                .sort((a, b) => a - b);

            // Extract final portfolio values (successful scenarios only)
            const finalPortfolioValues = simulations
                .filter(sim => sim.success)
                .map(sim => sim.finalPortfolioValue)
                .sort((a, b) => a - b);

            // Calculate statistics manually or using StatisticalAnalysis if available
            if (portfolioAtRetirementValues.length > 0) {
                if (typeof window !== 'undefined' && window.StatisticalAnalysis) {
                    scenarioResults.portfolioAtRetirement = window.StatisticalAnalysis.calculatePercentiles(
                        portfolioAtRetirementValues, 
                        [10, 25, 50, 75, 90]
                    );
                } else {
                    // Manual percentile calculation
                    scenarioResults.portfolioAtRetirement = this.calculatePercentilesManual(portfolioAtRetirementValues, [10, 25, 50, 75, 90]);
                }
                scenarioResults.portfolioAtRetirement.mean = portfolioAtRetirementValues.reduce((sum, val) => sum + val, 0) / portfolioAtRetirementValues.length;
                scenarioResults.portfolioAtRetirement.median = scenarioResults.portfolioAtRetirement.percentile50;
                scenarioResults.portfolioAtRetirement.min = Math.min(...portfolioAtRetirementValues);
                scenarioResults.portfolioAtRetirement.max = Math.max(...portfolioAtRetirementValues);
            } else {
                // Initialize empty results if no data
                scenarioResults.portfolioAtRetirement = {
                    median: 0,
                    mean: 0,
                    percentile10: 0,
                    percentile25: 0,
                    percentile50: 0,
                    percentile75: 0,
                    percentile90: 0,
                    min: 0,
                    max: 0
                };
            }

            if (finalPortfolioValues.length > 0) {
                if (typeof window !== 'undefined' && window.StatisticalAnalysis) {
                    scenarioResults.finalPortfolioValue = window.StatisticalAnalysis.calculatePercentiles(
                        finalPortfolioValues, 
                        [10, 25, 50, 75, 90]
                    );
                } else {
                    scenarioResults.finalPortfolioValue = this.calculatePercentilesManual(finalPortfolioValues, [10, 25, 50, 75, 90]);
                }
                scenarioResults.finalPortfolioValue.mean = finalPortfolioValues.reduce((sum, val) => sum + val, 0) / finalPortfolioValues.length;
            }

            // Collect failure ages for distribution analysis
            scenarioResults.failureAgeDistribution = simulations
                .filter(sim => sim.failureAge !== null)
                .map(sim => sim.failureAge);

            // Generate median yearly progression for charting
            if (typeof window !== 'undefined' && window.StatisticalAnalysis) {
                scenarioResults.yearlyProgression = window.StatisticalAnalysis.generateMedianProgression(simulations);
            } else {
                scenarioResults.yearlyProgression = this.generateMedianProgressionManual(simulations);
            }
            
            // Store all simulations for detailed analysis
            scenarioResults.allSimulations = simulations;

            results.scenarios.push(scenarioResults);
        });

        results.executionTime = performance.now() - startTime;
        
        // Generate cross-scenario comparisons
        results.aggregatedStats = this.generateAggregatedStats(results.scenarios);

        console.log(`Monte Carlo simulation completed in ${Math.round(results.executionTime)}ms`);
        console.log(`Total simulations: ${results.totalSimulations}`);
        
        return results;
    }

    /**
     * Generate aggregated statistics across all scenarios
     * @param {Array<Object>} scenarioResults - Results from all scenarios
     * @returns {Object} - Aggregated statistical analysis
     */
    static generateAggregatedStats(scenarioResults) {
        const stats = {
            successRateComparison: {},
            portfolioRequirementComparison: {},
            riskAnalysis: {}
        };

        scenarioResults.forEach(scenario => {
            stats.successRateComparison[scenario.scenario] = {
                successRate: scenario.successRate,
                confidenceLevel: scenario.successRate * 100 // Convert to percentage
            };

            stats.portfolioRequirementComparison[scenario.scenario] = {
                medianPortfolio: scenario.portfolioAtRetirement.median,
                range: {
                    low: scenario.portfolioAtRetirement.percentile10,
                    high: scenario.portfolioAtRetirement.percentile90
                }
            };

            // Risk metrics
            const failureRate = 1 - scenario.successRate;
            const avgFailureAge = scenario.failureAgeDistribution.length > 0 
                ? scenario.failureAgeDistribution.reduce((sum, age) => sum + age, 0) / scenario.failureAgeDistribution.length
                : null;

            stats.riskAnalysis[scenario.scenario] = {
                failureRate,
                averageFailureAge: avgFailureAge,
                portfolioVolatility: this.calculatePortfolioVolatility(scenario.allSimulations)
            };
        });

        return stats;
    }

    /**
     * Calculate portfolio volatility from simulation results
     * @param {Array<Object>} simulations - All simulation results
     * @returns {number} - Standard deviation of portfolio values at retirement
     */
    static calculatePortfolioVolatility(simulations) {
        const portfolioValues = simulations.map(sim => sim.portfolioAtRetirement);
        const mean = portfolioValues.reduce((sum, val) => sum + val, 0) / portfolioValues.length;
        const variance = portfolioValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / portfolioValues.length;
        return Math.sqrt(variance);
    }

    /**
     * Manual percentile calculation (fallback when StatisticalAnalysis not available)
     * @param {Array<number>} data - Sorted array of numerical data
     * @param {Array<number>} percentiles - Array of percentile values
     * @returns {Object} - Object with percentile values
     */
    static calculatePercentilesManual(data, percentiles) {
        if (!data || data.length === 0) {
            const result = {};
            percentiles.forEach(p => {
                result[`percentile${p}`] = 0;
            });
            return result;
        }

        const sortedData = [...data].sort((a, b) => a - b);
        const result = {};

        percentiles.forEach(percentile => {
            const index = (percentile / 100) * (sortedData.length - 1);
            
            if (index === Math.floor(index)) {
                result[`percentile${percentile}`] = sortedData[index];
            } else {
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
     * Manual median progression generation (fallback)
     * @param {Array<Object>} simulations - Array of simulation results
     * @returns {Array<Object>} - Median progression for charting
     */
    static generateMedianProgressionManual(simulations) {
        if (!simulations || simulations.length === 0) {
            return [];
        }

        // Find the age range
        const allAges = new Set();
        simulations.forEach(sim => {
            sim.yearlyProgression.forEach(year => {
                allAges.add(year.age);
            });
        });

        const sortedAges = Array.from(allAges).sort((a, b) => a - b);
        const medianProgression = [];

        sortedAges.forEach(age => {
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
                const portfolioPercentiles = this.calculatePercentilesManual(valuesAtAge, [10, 25, 50, 75, 90]);
                const withdrawalPercentiles = withdrawalsAtAge.length > 0 
                    ? this.calculatePercentilesManual(withdrawalsAtAge, [50])
                    : { percentile50: 0 };

                medianProgression.push({
                    age,
                    portfolioValue: portfolioPercentiles.percentile50,
                    withdrawal: withdrawalPercentiles.percentile50,
                    percentile10: portfolioPercentiles.percentile10,
                    percentile25: portfolioPercentiles.percentile25,
                    percentile75: portfolioPercentiles.percentile75,
                    percentile90: portfolioPercentiles.percentile90,
                    simulationCount: valuesAtAge.length
                });
            }
        });

        return medianProgression;
    }
}

// Static variables for Box-Muller transform
MonteCarloEngine._hasSpare = false;
MonteCarloEngine._spare = 0;

// Export for use in other modules
window.MonteCarloEngine = MonteCarloEngine;