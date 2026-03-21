/**
 * Financial Calculations Utility
 * Core mathematical functions for retirement planning
 */

class FinancialCalculations {
    /**
     * Format number as currency without symbol (for clean display)
     */
    static formatCurrency(amount) {
        return Math.round(amount).toLocaleString();
    }

    /**
     * Parse currency input (handles $ symbols and commas)
     */
    static parseCurrency(value) {
        if (typeof value === 'string') {
            return parseFloat(value.replace(/[$,]/g, '')) || 0;
        }
        return value || 0;
    }

    /**
     * Calculate future value with compound interest
     */
    static futureValue(presentValue, rate, periods) {
        return presentValue * Math.pow(1 + rate, periods);
    }

    /**
     * Calculate present value (reverse of future value)
     */
    static presentValue(futureValue, rate, periods) {
        return futureValue / Math.pow(1 + rate, periods);
    }

    /**
     * Calculate required payment (PMT) using the annuity formula
     * PMT = (FV - PV * (1 + r)^n) / (((1 + r)^n - 1) / r)
     */
    static calculateRequiredPayment(presentValue, futureValue, rate, periods) {
        if (periods <= 0) return 0;
        
        if (rate === 0) {
            return (futureValue - presentValue) / periods;
        }
        
        const factor = Math.pow(1 + rate, periods);
        const numerator = futureValue - presentValue * factor;
        const denominator = (factor - 1) / rate;
        return numerator / denominator;
    }
    
    /**
     * Calculate required monthly payment with monthly compounding
     */
    static calculateRequiredMonthlyPayment(presentValue, futureValue, annualRate, years) {
        const months = years * 12;
        const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
        
        return this.calculateRequiredPayment(presentValue, futureValue, monthlyRate, months);
    }

    /**
     * Calculate inflation-adjusted income
     */
    static inflationAdjustedIncome(baseIncome, inflationRate, years) {
        return baseIncome * Math.pow(1 + inflationRate, years);
    }

    /**
     * Calculate portfolio size needed for withdrawal rule
     */
    static portfolioSizeForWithdrawal(annualIncome, withdrawalRate = null) {
        const rate = withdrawalRate || (window.FinancialConstants?.WITHDRAWAL_RATE || 0.04);
        return annualIncome / rate;
    }

    /**
     * Calculate a single retirement scenario
     */
    static calculateScenario(params) {
        try {
            // Validate input parameters
            if (!params || typeof params !== 'object') {
                throw new Error('Invalid parameters object');
            }

            const {
                startingAge,
                retirementAge,
                targetIncome,
                startingBalance,
                inflationRate,
                annualReturn
            } = params;

            // Get constants (with fallbacks for safety)
            const constants = window.FinancialConstants || {};
            const MIN_STARTING_AGE = constants.MIN_STARTING_AGE || 18;
            const MAX_RETIREMENT_AGE = constants.MAX_RETIREMENT_AGE || 100;
            const MIN_RETIREMENT_AGE = constants.MIN_RETIREMENT_AGE || 30;
            const MIN_INCOME = constants.MIN_INCOME || 1000;
            const MIN_STARTING_BALANCE = constants.MIN_STARTING_BALANCE || 0;
            const MAX_INFLATION_RATE = constants.MAX_INFLATION_RATE || 0.2;
            const MIN_RETURN_RATE = constants.MIN_RETURN_RATE || -0.5;
            const MAX_RETURN_RATE = constants.MAX_RETURN_RATE || 0.3;

            // Validate required parameters using constants
            if (typeof startingAge !== 'number' || startingAge < MIN_STARTING_AGE || startingAge > MAX_RETIREMENT_AGE) {
                throw new Error(`Invalid startingAge: ${startingAge}`);
            }
            if (typeof retirementAge !== 'number' || retirementAge < MIN_RETIREMENT_AGE || retirementAge > MAX_RETIREMENT_AGE) {
                throw new Error(`Invalid retirementAge: ${retirementAge}`);
            }
            if (typeof targetIncome !== 'number' || targetIncome < MIN_INCOME) {
                throw new Error(`Invalid targetIncome: ${targetIncome}`);
            }
            if (typeof startingBalance !== 'number' || startingBalance < MIN_STARTING_BALANCE) {
                throw new Error(`Invalid startingBalance: ${startingBalance}`);
            }
            if (typeof inflationRate !== 'number' || inflationRate < 0 || inflationRate > MAX_INFLATION_RATE) {
                throw new Error(`Invalid inflationRate: ${inflationRate}`);
            }
            if (typeof annualReturn !== 'number' || annualReturn < MIN_RETURN_RATE || annualReturn > MAX_RETURN_RATE) {
                throw new Error(`Invalid annualReturn: ${annualReturn}`);
            }

            const yearsUntilRetirement = retirementAge - startingAge;
            
            if (yearsUntilRetirement <= 0) {
                return {
                    yearsUntilRetirement: 0,
                    targetPortfolioSize: 0,
                    monthlyContribution: 0,
                    inflatedTargetIncome: targetIncome,
                    valid: false,
                    error: 'Retirement age must be greater than starting age'
                };
            }
        
        // Calculate inflation-adjusted target income at retirement
        const inflatedTargetIncome = this.inflationAdjustedIncome(
            targetIncome, 
            inflationRate, 
            yearsUntilRetirement
        );
        
        // Portfolio size needed (using 4% withdrawal rule)
        const targetPortfolioSize = this.portfolioSizeForWithdrawal(inflatedTargetIncome);
        
        // Calculate required monthly contribution using monthly compounding
        const monthlyContribution = this.calculateRequiredMonthlyPayment(
            startingBalance, 
            targetPortfolioSize, 
            annualReturn, 
            yearsUntilRetirement
        );
        
        const annualContribution = monthlyContribution * 12;

            return {
                yearsUntilRetirement,
                targetPortfolioSize,
                monthlyContribution: monthlyContribution, // Allow negative for Coast FIRE
                inflatedTargetIncome,
                annualContribution: annualContribution, // Allow negative for Coast FIRE
                valid: true
            };
        } catch (error) {
            console.error('Error in calculateScenario:', error.message, params);
            return {
                yearsUntilRetirement: 0,
                targetPortfolioSize: 0,
                monthlyContribution: 0,
                inflatedTargetIncome: params?.targetIncome || 0,
                annualContribution: 0,
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Generate net worth progression over time with monthly compounding
     */
    static generateNetWorthProgression(scenario, params) {
        try {
            // Validate input parameters
            if (!scenario || !params) {
                throw new Error('Missing scenario or params');
            }

            const { startingAge, startingBalance, annualReturn, retirementReturn, inflationRate, endAge } = params;
            const { retirementAge, targetPortfolioSize, inflatedTargetIncome, annualContribution } = scenario;

            // Validate critical parameters
            if (typeof startingAge !== 'number' || startingAge < 18 || startingAge > 100) {
                throw new Error(`Invalid startingAge: ${startingAge}`);
            }
            if (typeof retirementAge !== 'number' || retirementAge <= startingAge) {
                throw new Error(`Invalid retirementAge: ${retirementAge}`);
            }
            if (typeof startingBalance !== 'number' || startingBalance < 0) {
                throw new Error(`Invalid startingBalance: ${startingBalance}`);
            }
            if (typeof annualReturn !== 'number' || annualReturn < -0.5 || annualReturn > 0.5) {
                throw new Error(`Invalid annualReturn: ${annualReturn}`);
            }
        
        const progression = [];
        let netWorth = startingBalance;
        
        // Calculate for each age from starting age to end age (not hardcoded to 100)
        const finalAge = endAge || 100;
        
        // Convert to monthly rates
        const monthlyAccumulationReturn = Math.pow(1 + annualReturn, 1/12) - 1;
        const monthlyRetirementReturn = Math.pow(1 + (retirementReturn || annualReturn), 1/12) - 1;
        const monthlyInflation = Math.pow(1 + inflationRate, 1/12) - 1;
        const monthlyContribution = annualContribution / 12;
        const monthlyWithdrawal = inflatedTargetIncome / 12;
        
        
        for (let age = startingAge; age <= finalAge; age++) {
            if (age < retirementAge) {
                // Accumulation phase - monthly compounding
                for (let month = 0; month < 12; month++) {
                    // Add monthly contribution at the beginning of each month (including first month)
                    netWorth = netWorth + monthlyContribution;
                    // Apply monthly growth during accumulation phase
                    netWorth = netWorth * (1 + monthlyAccumulationReturn);
                }
            } else {
                // Retirement phase - monthly withdrawals with inflation adjustment
                // Use years since retirement for post-retirement inflation (monthlyWithdrawal already includes inflation to retirement date)
                const yearsFromRetirement = age - retirementAge;
                const inflationAdjustedWithdrawal = monthlyWithdrawal * Math.pow(1 + monthlyInflation, yearsFromRetirement * 12);
                
                for (let month = 0; month < 12; month++) {
                    // Withdraw at beginning of month
                    netWorth = netWorth - inflationAdjustedWithdrawal;
                    // Apply growth to remaining balance using retirement return rate
                    netWorth = netWorth * (1 + monthlyRetirementReturn);
                    // Floor at zero
                    netWorth = Math.max(0, netWorth);
                    
                    // If balance hits zero, stop calculating
                    if (netWorth === 0) {
                        progression.push({ age, netWorth: 0 });
                        // Fill remaining ages with zero
                        for (let remainingAge = age + 1; remainingAge <= finalAge; remainingAge++) {
                            progression.push({ age: remainingAge, netWorth: 0 });
                        }
                        return progression;
                    }
                }
            }
            
            progression.push({ age, netWorth: Math.round(netWorth) });
        }
        
            return progression;
        } catch (error) {
            console.error('Error in generateNetWorthProgression:', error.message, { scenario, params });
            return []; // Return empty array on error
        }
    }

    /**
     * Generate withdrawal amounts over time
     */
    static generateWithdrawalProgression(scenario, params) {
        const { retirementAge, inflatedTargetIncome } = scenario;
        const { inflationRate } = params;
        
        const progression = [];
        
        // Generate withdrawals from retirement age to 100
        for (let age = retirementAge; age <= 100; age++) {
            const yearsFromRetirement = age - retirementAge;
            const nominalWithdrawal = inflatedTargetIncome * Math.pow(1 + inflationRate, yearsFromRetirement);
            progression.push({ age, withdrawal: nominalWithdrawal });
        }
        
        return progression;
    }

    /**
     * Calculate multiple scenarios with Monte Carlo analysis and advanced financial modeling
     * @param {Array<Object>} scenarioConfigs - Array of scenario configurations
     * @param {Object} assumptions - Market assumptions including volatility
     * @param {Object} taxParameters - Optional tax and financial modeling parameters
     * @returns {Object} - Comprehensive results including stochastic analysis and tax planning
     */
    static calculateScenariosWithMonteCarlo(scenarioConfigs, assumptions, taxParameters = null) {
        const {
            startingAge,
            startingBalance,
            targetIncome,
            inflationRate,
            accumulationReturn,
            retirementReturn,
            volatility = 0.15,
            monteCarloRuns = 1000
        } = assumptions;

        // Prepare scenarios for Monte Carlo simulation
        const scenarios = scenarioConfigs.map(config => ({
            retirementAge: config.retirementAge,
            targetIncome,
            startingAge,
            startingBalance,
            endAge: assumptions.endAge || 85,
            lifeExpectancy: 100
        }));

        // Run Monte Carlo simulations
        const monteCarloResults = MonteCarloEngine.runSimulations(scenarios, {
            inflationRate: inflationRate / 100,
            accumulationReturn: accumulationReturn / 100,
            retirementReturn: retirementReturn / 100,
            volatility: volatility / 100,
            monteCarloRuns
        });

        // Calculate deterministic scenarios for comparison
        const deterministicScenarios = scenarioConfigs.map(config => {
            const deterministicResult = this.calculateScenario({
                startingAge,
                retirementAge: config.retirementAge,
                targetIncome,
                startingBalance,
                inflationRate: inflationRate / 100,
                annualReturn: accumulationReturn / 100
            });

            return {
                ...config,
                ...deterministicResult,
                retirementAge: config.retirementAge
            };
        });

        // Enhanced results with tax planning if parameters provided
        let enhancedResults = {
            deterministicScenarios,
            monteCarloResults,
            assumptions: {
                ...assumptions,
                volatility,
                monteCarloRuns
            },
            riskAnalysis: this.generateRiskAnalysis(monteCarloResults),
            comparison: this.compareStochasticToDeterministic(deterministicScenarios, monteCarloResults)
        };

        // Add advanced financial modeling if tax parameters provided
        if (taxParameters && window.FinancialModeling) {
            enhancedResults.taxPlanning = this.generateTaxPlanningAnalysis(deterministicScenarios, taxParameters);
            enhancedResults.socialSecurity = this.generateSocialSecurityAnalysis(scenarioConfigs, taxParameters);
            enhancedResults.healthcareCosts = this.generateHealthcareAnalysis(scenarioConfigs, taxParameters);
            enhancedResults.accountOptimization = this.generateAccountOptimizationAnalysis(taxParameters);
        }

        return enhancedResults;
    }

    /**
     * Generate tax planning analysis for scenarios
     * @param {Array<Object>} scenarios - Deterministic scenarios
     * @param {Object} taxParameters - Tax calculation parameters
     * @returns {Object} - Tax planning analysis
     */
    static generateTaxPlanningAnalysis(scenarios, taxParameters) {
        const {
            accountType = 'Traditional 401k/IRA',
            state = 'California',
            filingStatus = 'Single',
            currentIncome = 80000
        } = taxParameters;

        return scenarios.map((scenario, index) => {
            const scenarioLetter = String.fromCharCode(65 + index);
            const grossWithdrawal = scenario.inflatedTargetIncome;
            const retirementAge = scenario.retirementAge;
            
            const taxResult = window.FinancialModeling.calculateTaxAdjustedWithdrawal(
                grossWithdrawal,
                accountType,
                state,
                retirementAge,
                filingStatus
            );

            return {
                scenario: scenarioLetter,
                retirementAge,
                grossWithdrawal: Math.round(grossWithdrawal),
                netWithdrawal: Math.round(taxResult.netIncome),
                totalTax: Math.round(taxResult.totalTax),
                federalTax: Math.round(taxResult.federalTax),
                stateTax: Math.round(taxResult.stateTax),
                effectiveTaxRate: Math.round(taxResult.effectiveRate * 100) / 100,
                marginalTaxRate: Math.round(taxResult.marginalRate * 100) / 100,
                accountType,
                taxOptimizationPotential: this.calculateTaxOptimizationPotential(grossWithdrawal, state, retirementAge, filingStatus)
            };
        });
    }

    /**
     * Calculate tax optimization potential across account types
     * @param {number} grossWithdrawal - Gross withdrawal amount
     * @param {string} state - State for tax calculation
     * @param {number} age - Age at withdrawal
     * @param {string} filingStatus - Filing status
     * @returns {Object} - Tax optimization analysis
     */
    static calculateTaxOptimizationPotential(grossWithdrawal, state, age, filingStatus) {
        const accountTypes = ['Traditional 401k/IRA', 'Roth', 'Taxable'];
        const results = {};
        
        accountTypes.forEach(accountType => {
            const taxResult = window.FinancialModeling.calculateTaxAdjustedWithdrawal(
                grossWithdrawal,
                accountType,
                state,
                age,
                filingStatus
            );
            
            results[accountType] = {
                totalTax: taxResult.totalTax,
                netIncome: taxResult.netIncome,
                effectiveRate: taxResult.effectiveRate
            };
        });

        // Find best and worst options
        const sortedByTax = Object.entries(results).sort((a, b) => a[1].totalTax - b[1].totalTax);
        const bestOption = sortedByTax[0];
        const worstOption = sortedByTax[sortedByTax.length - 1];
        
        return {
            bestAccountType: bestOption[0],
            worstAccountType: worstOption[0],
            maxTaxSavings: Math.round(worstOption[1].totalTax - bestOption[1].totalTax),
            allOptions: results
        };
    }

    /**
     * Generate Social Security optimization analysis
     * @param {Array<Object>} scenarioConfigs - Scenario configurations
     * @param {Object} taxParameters - Tax parameters including SS info
     * @returns {Object} - Social Security analysis
     */
    static generateSocialSecurityAnalysis(scenarioConfigs, taxParameters) {
        const {
            currentAge = 30,
            expectedSsBenefit = 2000,
            lifeExpectancy = 85
        } = taxParameters;

        return scenarioConfigs.map((config, index) => {
            const scenarioLetter = String.fromCharCode(65 + index);
            const analysis = window.FinancialModeling.optimizeSocialSecurity(
                currentAge,
                config.retirementAge,
                expectedSsBenefit,
                lifeExpectancy
            );

            return {
                scenario: scenarioLetter,
                retirementAge: config.retirementAge,
                optimalClaimingAge: analysis.optimal.claimingAge,
                optimalMonthlyBenefit: analysis.optimal.monthlyBenefit,
                optimalAnnualBenefit: analysis.optimal.monthlyBenefit * 12,
                lifetimeValue: analysis.optimal.lifetimeValue,
                recommendation: analysis.recommendation,
                fullRetirementAge: analysis.fullRetirementAge
            };
        });
    }

    /**
     * Generate healthcare cost analysis
     * @param {Array<Object>} scenarioConfigs - Scenario configurations
     * @param {Object} taxParameters - Parameters including healthcare multiplier
     * @returns {Object} - Healthcare cost analysis
     */
    static generateHealthcareAnalysis(scenarioConfigs, taxParameters) {
        const {
            currentAge = 30,
            healthcareMultiplier = 1.0,
            healthcareInflation = 0.05
        } = taxParameters;

        return scenarioConfigs.map((config, index) => {
            const scenarioLetter = String.fromCharCode(65 + index);
            const yearsInRetirement = 85 - config.retirementAge; // Assume life expectancy of 85
            
            const analysis = window.FinancialModeling.calculateHealthcareCosts(
                config.retirementAge,
                null, // Use age-based default
                healthcareMultiplier,
                healthcareInflation,
                yearsInRetirement
            );

            return {
                scenario: scenarioLetter,
                retirementAge: config.retirementAge,
                yearsInRetirement,
                averageAnnualCost: analysis.averageAnnualCost,
                totalLifetimeCost: analysis.totalCumulativeCost,
                firstYearCost: analysis.projectedCosts[0]?.annualCost || 0,
                finalYearCost: analysis.finalYearCost,
                healthcareMultiplier,
                medicareTransition: analysis.medicareTransition
            };
        });
    }

    /**
     * Generate account type optimization analysis
     * @param {Object} taxParameters - Tax parameters
     * @returns {Object} - Account optimization recommendations
     */
    static generateAccountOptimizationAnalysis(taxParameters) {
        const {
            currentIncome = 80000,
            currentTaxRate = 0.22,
            retirementTaxRate = 0.15,
            yearsToRetirement = 20
        } = taxParameters;

        const analysis = window.FinancialModeling.determineOptimalAccountType(
            currentIncome,
            retirementTaxRate,
            currentTaxRate,
            yearsToRetirement
        );

        return {
            recommendedAccountType: analysis.recommendedType,
            estimatedTaxSavings: analysis.taxSavings,
            strategy: analysis.strategy,
            allRecommendations: analysis.analysis.recommendations,
            contributionComparison: {
                traditional: {
                    immediateDeduction: Math.round(20000 * currentTaxRate),
                    futureValue: Math.round(20000 * Math.pow(1.07, yearsToRetirement)),
                    futureTaxes: Math.round(20000 * Math.pow(1.07, yearsToRetirement) * retirementTaxRate)
                },
                roth: {
                    immediateTaxCost: Math.round(20000 * currentTaxRate),
                    futureValue: Math.round(20000 * Math.pow(1.07, yearsToRetirement)),
                    futureTaxes: 0
                }
            }
        };
    }

    /**
     * Generate risk analysis from Monte Carlo results
     * @param {Object} monteCarloResults - Results from Monte Carlo simulation
     * @returns {Object} - Risk analysis summary
     */
    static generateRiskAnalysis(monteCarloResults) {
        const riskSummary = {
            overallRisk: 'LOW',
            keyFindings: [],
            sequenceOfReturnsRisk: {},
            portfolioSurvivalRates: {}
        };

        monteCarloResults.scenarios.forEach(scenario => {
            const successRate = scenario.successRate;
            const scenarioLetter = scenario.scenario;

            // Determine risk level
            let riskLevel = 'LOW';
            if (successRate < 0.7) riskLevel = 'HIGH';
            else if (successRate < 0.85) riskLevel = 'MEDIUM';

            riskSummary.portfolioSurvivalRates[scenarioLetter] = {
                successRate,
                riskLevel,
                confidenceLevel: Math.round(successRate * 100)
            };

            // Analyze sequence of returns risk
            if (scenario.allSimulations) {
                const sequenceAnalysis = StatisticalAnalysis.analyzeSequenceOfReturnsRisk(scenario.allSimulations);
                riskSummary.sequenceOfReturnsRisk[scenarioLetter] = {
                    correlation: sequenceAnalysis.correlation,
                    earlyYearImpact: sequenceAnalysis.earlyYearImpact,
                    riskLevel: sequenceAnalysis.earlyYearImpact > 0.2 ? 'HIGH' : 'MEDIUM'
                };
            }

            // Generate key findings
            if (successRate < 0.8) {
                riskSummary.keyFindings.push(`Scenario ${scenarioLetter}: ${Math.round((1 - successRate) * 100)}% chance of portfolio depletion`);
            }

            if (scenario.failureAgeDistribution && scenario.failureAgeDistribution.length > 0) {
                const avgFailureAge = scenario.failureAgeDistribution.reduce((sum, age) => sum + age, 0) / scenario.failureAgeDistribution.length;
                riskSummary.keyFindings.push(`Scenario ${scenarioLetter}: Average failure age is ${Math.round(avgFailureAge)} years`);
            }
        });

        // Set overall risk level
        const allSuccessRates = monteCarloResults.scenarios.map(s => s.successRate);
        const minSuccessRate = Math.min(...allSuccessRates);
        
        if (minSuccessRate < 0.7) riskSummary.overallRisk = 'HIGH';
        else if (minSuccessRate < 0.85) riskSummary.overallRisk = 'MEDIUM';

        return riskSummary;
    }

    /**
     * Compare stochastic results to deterministic calculations
     * @param {Array<Object>} deterministicScenarios - Deterministic scenario results
     * @param {Object} monteCarloResults - Monte Carlo simulation results
     * @returns {Object} - Comparison analysis
     */
    static compareStochasticToDeterministic(deterministicScenarios, monteCarloResults) {
        const comparison = {
            portfolioSizeDifferences: {},
            contributionDifferences: {},
            insights: []
        };

        deterministicScenarios.forEach((detScenario, index) => {
            const mcScenario = monteCarloResults.scenarios[index];
            const scenarioLetter = String.fromCharCode(65 + index);

            if (detScenario.valid && mcScenario) {
                // Compare portfolio sizes
                const detPortfolio = detScenario.targetPortfolioSize;
                const mcMedianPortfolio = mcScenario.portfolioAtRetirement.median;
                const portfolioDiff = ((mcMedianPortfolio - detPortfolio) / detPortfolio) * 100;

                comparison.portfolioSizeDifferences[scenarioLetter] = {
                    deterministic: detPortfolio,
                    monteCarloMedian: mcMedianPortfolio,
                    percentageDifference: portfolioDiff,
                    range: {
                        low: mcScenario.portfolioAtRetirement.percentile10,
                        high: mcScenario.portfolioAtRetirement.percentile90
                    }
                };

                // Compare required contributions
                const detContribution = detScenario.monthlyContribution;
                // For Monte Carlo, we use the same deterministic contribution calculation
                // since we're analyzing the outcome uncertainty, not contribution uncertainty
                comparison.contributionDifferences[scenarioLetter] = {
                    deterministic: detContribution,
                    successProbability: mcScenario.successRate
                };

                // Generate insights
                if (Math.abs(portfolioDiff) > 10) {
                    comparison.insights.push(
                        `Scenario ${scenarioLetter}: Monte Carlo median portfolio differs from deterministic by ${Math.round(Math.abs(portfolioDiff))}%`
                    );
                }

                if (mcScenario.successRate < 0.9) {
                    comparison.insights.push(
                        `Scenario ${scenarioLetter}: Only ${Math.round(mcScenario.successRate * 100)}% success rate despite meeting deterministic requirements`
                    );
                }
            }
        });

        return comparison;
    }

    /**
     * Calculate safe withdrawal rate based on Monte Carlo analysis
     * @param {Object} scenario - Scenario parameters
     * @param {Object} assumptions - Market assumptions
     * @param {number} targetSuccessRate - Desired success rate (e.g., 0.95 for 95%)
     * @returns {Object} - Safe withdrawal rate analysis
     */
    static calculateSafeWithdrawalRate(scenario, assumptions, targetSuccessRate = 0.95) {
        const testWithdrawalRates = [0.03, 0.035, 0.04, 0.045, 0.05, 0.055, 0.06];
        const results = [];

        testWithdrawalRates.forEach(withdrawalRate => {
            // Adjust target income based on withdrawal rate
            const adjustedTargetIncome = scenario.targetIncome * (withdrawalRate / 0.04);
            
            const testScenario = {
                ...scenario,
                targetIncome: adjustedTargetIncome
            };

            // Run limited Monte Carlo simulation (fewer runs for performance)
            const testResults = MonteCarloEngine.runSimulations([testScenario], {
                ...assumptions,
                monteCarloRuns: 500
            });

            if (testResults.scenarios.length > 0) {
                results.push({
                    withdrawalRate,
                    successRate: testResults.scenarios[0].successRate,
                    medianPortfolio: testResults.scenarios[0].portfolioAtRetirement.median
                });
            }
        });

        // Find the highest withdrawal rate that meets the target success rate
        const safeWithdrawalRates = results.filter(r => r.successRate >= targetSuccessRate);
        const maxSafeRate = safeWithdrawalRates.length > 0 
            ? Math.max(...safeWithdrawalRates.map(r => r.withdrawalRate))
            : Math.min(...testWithdrawalRates);

        return {
            safeWithdrawalRate: maxSafeRate,
            targetSuccessRate,
            allResults: results,
            recommendation: maxSafeRate < 0.04 
                ? 'Consider more conservative withdrawal rate than traditional 4% rule'
                : 'Traditional 4% rule appears suitable for your scenario'
        };
    }

    /**
     * NEW METHOD: Calculate retirement readiness based on savings rate and target age
     * @param {Object} params - Retirement planning parameters
     * @returns {Object} - Comprehensive retirement readiness analysis
     */
    static calculateRetirementReadiness(params) {
        const {
            currentAge,
            targetRetirementAge,
            targetIncome,
            currentIncome,
            currentSavingsRate, // decimal (e.g., 0.15 for 15%)
            startingBalance,
            state = 'TX',
            riskProfile = 'tdf',
            inflationRate = 0.03,
            accumulationReturn: customAccumulationReturn,
            retirementReturn: customRetirementReturn,
            volatility: customVolatility
        } = params;

        // Use custom return rates if provided, otherwise get from risk profile
        let accumulationReturn, retirementReturn, volatility, riskData;
        
        // Always get risk profile data (needed for other parts of the function)
        riskData = window.SavingsFeasibility.getRiskProfile(riskProfile, currentAge);
        
        if (customAccumulationReturn !== undefined || customRetirementReturn !== undefined || customVolatility !== undefined) {
            // Use custom values, with risk profile fallbacks for missing ones
            accumulationReturn = customAccumulationReturn !== undefined ? customAccumulationReturn : riskData.accumulation.return;
            retirementReturn = customRetirementReturn !== undefined ? customRetirementReturn : riskData.retirement.return;
            volatility = customVolatility !== undefined ? customVolatility : riskData.accumulation.volatility;
            console.log('Using custom returns:', { accumulationReturn, retirementReturn, volatility });
        } else {
            // Use risk profile defaults
            accumulationReturn = riskData.accumulation.return;
            retirementReturn = riskData.retirement.return;
            volatility = riskData.accumulation.volatility;
            console.log('Using risk profile returns:', riskProfile, { accumulationReturn, retirementReturn, volatility });
        }

        // Calculate required savings rate for target goal
        const requiredSavingsRate = window.SavingsFeasibility.calculateRequiredSavingsRate({
            currentAge,
            targetAge: targetRetirementAge,
            targetIncome,
            currentIncome,
            startingBalance,
            inflationRate,
            annualReturn: accumulationReturn
        });

        // Assess realism of required savings rate
        const realismAssessment = window.SavingsFeasibility.assessSavingsRateIncrease(
            currentSavingsRate,
            requiredSavingsRate,
            currentIncome,
            state
        );

        // Generate three savings rate scenarios (pass monthly income for dollar-based increases)
        const monthlyIncome = currentIncome / 12;
        const savingsScenarios = window.SavingsFeasibility.generateSavingsRateScenarios(currentSavingsRate, monthlyIncome);
        
        // Calculate what retirement age is achievable with each savings rate
        const scenarioResults = savingsScenarios.map((scenario, index) => {
            const achievableAge = this.calculateAchievableRetirementAge({
                currentAge,
                targetIncome,
                currentIncome,
                savingsRate: scenario.rate,
                startingBalance,
                inflationRate,
                annualReturn: accumulationReturn
            });

            // Assess realism of this savings rate
            const realism = window.SavingsFeasibility.assessSavingsRateIncrease(
                currentSavingsRate,
                scenario.rate,
                currentIncome,
                state
            );

            return {
                label: scenario.label,
                savingsRate: scenario.rate,
                description: scenario.description,
                achievableRetirementAge: achievableAge,
                yearsUntilRetirement: achievableAge ? Math.max(0, achievableAge - currentAge) : 0,
                monthlyContribution: (scenario.rate * currentIncome) / 12,
                realismScore: realism.score,
                realismRating: realism.rating,
                confidenceLevel: window.SavingsFeasibility.getConfidenceLevel(realism.score),
                valid: achievableAge !== null && achievableAge <= 100 && achievableAge > currentAge
            };
        });

        return {
            targetGoal: {
                retirementAge: targetRetirementAge,
                targetIncome,
                requiredSavingsRate,
                realismAssessment,
                isRealistic: realismAssessment.score >= 60
            },
            scenarios: scenarioResults,
            riskProfile: riskData,
            marketAssumptions: {
                accumulationReturn,
                retirementReturn,
                volatility,
                inflationRate
            }
        };
    }

    /**
     * NEW METHOD: Calculate what retirement age is achievable with given savings rate
     * @param {Object} params - Savings parameters
     * @returns {number} - Achievable retirement age
     */
    static calculateAchievableRetirementAge(params) {
        try {
            const {
                currentAge,
                targetIncome,
                currentIncome,
                savingsRate,
                startingBalance,
                inflationRate,
                annualReturn
            } = params;

            // Get constants (with fallbacks)
            const constants = window.FinancialConstants || {};
            const MAX_RETIREMENT_AGE = constants.MAX_RETIREMENT_AGE || 100;
            const MIN_SAVINGS_RATE = constants.MIN_SAVINGS_RATE || 0.01;
            const MIN_INCOME = constants.MIN_INCOME || 1000;
            const WITHDRAWAL_RATE = constants.WITHDRAWAL_RATE || 0.04;

            // Validate inputs using constants
            if (currentAge >= MAX_RETIREMENT_AGE || savingsRate <= MIN_SAVINGS_RATE || 
                currentIncome <= MIN_INCOME || targetIncome <= MIN_INCOME) {
                return null; // Invalid inputs
            }

            const monthlyContribution = (currentIncome * savingsRate) / 12;
            const monthlyReturn = Math.pow(1 + annualReturn, 1/12) - 1;

            // Helper: calculate portfolio value using monthly compounding (matches generateNetWorthProgression)
            const calcPortfolioValue = (yearsToSave) => {
                let value = startingBalance;
                const totalMonths = yearsToSave * 12;
                for (let month = 0; month < totalMonths; month++) {
                    value = value + monthlyContribution;
                    value = value * (1 + monthlyReturn);
                }
                return value;
            };

            // Feasibility check: even with maximum savings at max age, is goal achievable?
            const maxYearsToSave = MAX_RETIREMENT_AGE - currentAge;
            const maxPortfolioValue = calcPortfolioValue(maxYearsToSave);

            const maxInflatedIncome = targetIncome * Math.pow(1 + inflationRate, maxYearsToSave);
            const maxRequiredPortfolio = maxInflatedIncome / WITHDRAWAL_RATE;

            if (maxPortfolioValue < maxRequiredPortfolio) {
                console.warn('Retirement goal impossible even at age 100', {
                    maxPortfolio: maxPortfolioValue,
                    required: maxRequiredPortfolio,
                    savingsRate: savingsRate * 100 + '%'
                });
                return null; // Impossible scenario
            }

            // Binary search to find retirement age
            let minAge = currentAge + 1;
            let maxAge = MAX_RETIREMENT_AGE;
            let bestAge = null;

            while (minAge <= maxAge) {
                const testAge = Math.floor((minAge + maxAge) / 2);
                const yearsToSave = testAge - currentAge;

                if (yearsToSave <= 0) {
                    minAge = testAge + 1;
                    continue;
                }

                // Calculate portfolio value at test retirement age (monthly compounding)
                const portfolioValue = calcPortfolioValue(yearsToSave);

                // Calculate required portfolio for target income (inflation-adjusted)
                const inflatedTargetIncome = targetIncome * Math.pow(1 + inflationRate, yearsToSave);
                const requiredPortfolio = inflatedTargetIncome / WITHDRAWAL_RATE;

                if (portfolioValue >= requiredPortfolio) {
                    bestAge = testAge;
                    maxAge = testAge - 1; // Try for earlier retirement
                } else {
                    minAge = testAge + 1; // Need to work longer
                }
            }

            // Return null if no achievable age found (shouldn't happen after feasibility check)
            return bestAge;
            
        } catch (error) {
            console.error('Error in calculateAchievableRetirementAge:', error.message, params);
            return null;
        }
    }

    /**
     * NEW METHOD: Generate savings rate scenarios for Monte Carlo analysis
     * @param {Object} params - Base parameters
     * @returns {Array} - Array of scenario objects for Monte Carlo simulation
     */
    static generateSavingsRateScenarios(params) {
        const readinessAnalysis = this.calculateRetirementReadiness(params);
        
        return readinessAnalysis.scenarios.map(scenario => ({
            retirementAge: params.targetRetirementAge,
            targetIncome: params.targetIncome,
            startingAge: params.currentAge,
            startingBalance: params.startingBalance,
            endAge: params.endAge || 85,
            lifeExpectancy: 100,
            savingsRate: scenario.savingsRate,
            label: scenario.label,
            realismRating: scenario.realismRating,
            confidenceLevel: scenario.confidenceLevel,
            achievableRetirementAge: scenario.achievableRetirementAge // Keep for reference
        }));
    }

    /**
     * NEW METHOD: Calculate minimum required savings rate to achieve goal
     * @param {Object} params - Goal parameters
     * @returns {Object} - Required savings rate analysis
     */
    static calculateMinimumSavingsRate(params) {
        const {
            currentAge,
            targetRetirementAge,
            targetIncome,
            currentIncome,
            startingBalance,
            inflationRate = 0.03,
            annualReturn = 0.08
        } = params;

        const yearsToRetirement = targetRetirementAge - currentAge;
        if (yearsToRetirement <= 0) {
            return { savingsRate: 0, achievable: false };
        }

        // Calculate required portfolio size
        const inflatedTargetIncome = targetIncome * Math.pow(1 + inflationRate, yearsToRetirement);
        const requiredPortfolio = inflatedTargetIncome / 0.04;

        // Calculate required annual contribution
        let requiredAnnualContribution = 0;
        if (annualReturn === 0) {
            requiredAnnualContribution = (requiredPortfolio - startingBalance) / yearsToRetirement;
        } else {
            const factor = Math.pow(1 + annualReturn, yearsToRetirement);
            const numerator = requiredPortfolio - startingBalance * factor;
            const denominator = (factor - 1) / annualReturn;
            requiredAnnualContribution = numerator / denominator;
        }

        const requiredSavingsRate = Math.max(0, requiredAnnualContribution / currentIncome);
        
        return {
            savingsRate: requiredSavingsRate,
            achievable: requiredSavingsRate <= 0.80, // Assume 80% is absolute maximum
            requiredMonthlyContribution: requiredAnnualContribution / 12,
            requiredPortfolio,
            inflatedTargetIncome
        };
    }
}

// Export for use in other modules
window.FinancialCalculations = FinancialCalculations;