/**
 * Financial Calculations Utility
 * Core mathematical functions for retirement planning
 */

class FinancialCalculations {
    /**
     * Format number as currency without symbol (for terminal display)
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
     * Calculate inflation-adjusted income
     */
    static inflationAdjustedIncome(baseIncome, inflationRate, years) {
        return baseIncome * Math.pow(1 + inflationRate, years);
    }

    /**
     * Calculate portfolio size needed for 4% withdrawal rule
     */
    static portfolioSizeForWithdrawal(annualIncome, withdrawalRate = 0.04) {
        return annualIncome / withdrawalRate;
    }

    /**
     * Calculate a single retirement scenario
     */
    static calculateScenario(params) {
        const {
            startingAge,
            retirementAge,
            targetIncome,
            startingBalance,
            inflationRate,
            annualReturn
        } = params;

        const yearsUntilRetirement = retirementAge - startingAge;
        
        if (yearsUntilRetirement <= 0) {
            return {
                yearsUntilRetirement: 0,
                targetPortfolioSize: 0,
                monthlyContribution: 0,
                inflatedTargetIncome: targetIncome,
                valid: false
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
        
        // Calculate required annual contribution
        const annualContribution = this.calculateRequiredPayment(
            startingBalance, 
            targetPortfolioSize, 
            annualReturn, 
            yearsUntilRetirement
        );
        
        const monthlyContribution = annualContribution / 12;

        return {
            yearsUntilRetirement,
            targetPortfolioSize,
            monthlyContribution: Math.max(0, monthlyContribution),
            inflatedTargetIncome,
            annualContribution: Math.max(0, annualContribution),
            valid: true
        };
    }

    /**
     * Generate net worth progression over time
     */
    static generateNetWorthProgression(scenario, params) {
        const { startingAge, startingBalance, annualReturn, inflationRate } = params;
        const { retirementAge, targetPortfolioSize, inflatedTargetIncome, annualContribution } = scenario;
        
        const progression = [];
        
        // Generate data from starting age to 100
        for (let age = startingAge; age <= 100; age++) {
            let netWorth = 0;
            
            if (age < retirementAge) {
                // Accumulation phase
                const yearsFromStart = age - startingAge;
                netWorth = startingBalance;
                
                // Apply compound growth and annual contributions
                for (let year = 0; year < yearsFromStart; year++) {
                    netWorth = netWorth * (1 + annualReturn) + annualContribution;
                }
            } else {
                // Retirement phase - start with target portfolio size
                netWorth = targetPortfolioSize;
                
                // Apply withdrawals and growth for each year since retirement
                const yearsInRetirement = age - retirementAge;
                for (let year = 0; year < yearsInRetirement; year++) {
                    const thisYearWithdrawal = inflatedTargetIncome * Math.pow(1 + inflationRate, year);
                    netWorth = (netWorth - thisYearWithdrawal) * (1 + annualReturn);
                    netWorth = Math.max(0, netWorth);
                }
            }
            
            progression.push({ age, netWorth });
        }
        
        return progression;
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
            riskProfile = 'moderate',
            inflationRate = 0.03
        } = params;

        // Get risk profile data
        const riskData = window.SavingsFeasibility.getRiskProfile(riskProfile);
        const accumulationReturn = riskData.accumulation.return;
        const retirementReturn = riskData.retirement.return;
        const volatility = riskData.accumulation.volatility;

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

        // Generate three savings rate scenarios
        const savingsScenarios = window.SavingsFeasibility.generateSavingsRateScenarios(currentSavingsRate);
        
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
                yearsUntilRetirement: Math.max(0, achievableAge - currentAge),
                monthlyContribution: (scenario.rate * currentIncome) / 12,
                realismScore: realism.score,
                realismRating: realism.rating,
                confidenceLevel: window.SavingsFeasibility.getConfidenceLevel(realism.score),
                valid: achievableAge <= 100 && achievableAge > currentAge
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
        const {
            currentAge,
            targetIncome,
            currentIncome,
            savingsRate,
            startingBalance,
            inflationRate,
            annualReturn
        } = params;

        const annualContribution = currentIncome * savingsRate;
        
        // Binary search to find retirement age
        let minAge = currentAge + 1;
        let maxAge = 100;
        let bestAge = maxAge;

        while (minAge <= maxAge) {
            const testAge = Math.floor((minAge + maxAge) / 2);
            const yearsToSave = testAge - currentAge;
            
            if (yearsToSave <= 0) {
                minAge = testAge + 1;
                continue;
            }

            // Calculate portfolio value at test retirement age
            let portfolioValue = startingBalance;
            for (let year = 0; year < yearsToSave; year++) {
                portfolioValue = portfolioValue * (1 + annualReturn) + annualContribution;
            }

            // Calculate required portfolio for target income (inflation-adjusted)
            const inflatedTargetIncome = targetIncome * Math.pow(1 + inflationRate, yearsToSave);
            const requiredPortfolio = inflatedTargetIncome / 0.04; // 4% rule

            if (portfolioValue >= requiredPortfolio) {
                bestAge = testAge;
                maxAge = testAge - 1; // Try for earlier retirement
            } else {
                minAge = testAge + 1; // Need to work longer
            }
        }

        return bestAge;
    }

    /**
     * NEW METHOD: Generate savings rate scenarios for Monte Carlo analysis
     * @param {Object} params - Base parameters
     * @returns {Array} - Array of scenario objects for Monte Carlo simulation
     */
    static generateSavingsRateScenarios(params) {
        const readinessAnalysis = this.calculateRetirementReadiness(params);
        
        return readinessAnalysis.scenarios.map(scenario => ({
            retirementAge: scenario.achievableRetirementAge,
            targetIncome: params.targetIncome,
            startingAge: params.currentAge,
            startingBalance: params.startingBalance,
            endAge: params.endAge || 85,
            lifeExpectancy: 100,
            savingsRate: scenario.savingsRate,
            label: scenario.label,
            realismRating: scenario.realismRating,
            confidenceLevel: scenario.confidenceLevel
        }));
    }
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