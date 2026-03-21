/**
 * Advanced Insights Engine
 * Professional-grade financial analysis insights and Monte Carlo result interpretation
 */

class InsightsEngine {
    /**
     * Generate comprehensive advanced insights from Monte Carlo and financial modeling results
     * @param {Object} monteCarloResults - Results from Monte Carlo simulation
     * @param {Object} financialModelingResults - Results from financial modeling analysis
     * @param {Object} parameters - User input parameters
     * @returns {Array<Object>} - Array of insight objects
     */
    static generateAdvancedInsights(monteCarloResults, financialModelingResults, parameters) {
        const insights = [];
        
        try {
            // 1. Early vs Late Retirement Impact - Most useful comparison
            insights.push(...this.generateRetirementTimingInsights(monteCarloResults, financialModelingResults, parameters));
            
            // 2. Monte Carlo Success Rate - Critical risk assessment  
            insights.push(...this.generateMonteCarloInsights(monteCarloResults, parameters));
            
            // 3. Time vs Money Trade-off Analysis - Practical actionable insight
            insights.push(...this.generateTradeoffAnalysisInsights(monteCarloResults, financialModelingResults, parameters));
            
        } catch (error) {
            console.error('Error generating advanced insights:', error);
            // Return basic insight on error
            insights.push({
                title: 'ANALYSIS_ERROR',
                value: 'Error',
                text: 'Advanced analysis temporarily unavailable. Basic calculations are still valid.'
            });
        }
        
        return insights;
    }

    /**
     * Generate retirement timing comparison insights
     */
    static generateRetirementTimingInsights(monteCarloResults, financialModelingResults, parameters) {
        const insights = [];
        
        if (monteCarloResults.scenarios.length >= 2) {
            const scenarioA = monteCarloResults.scenarios[0]; // Earliest
            const scenarioC = monteCarloResults.scenarios[monteCarloResults.scenarios.length - 1]; // Latest
            
            if (scenarioA && scenarioC) {
                const successDifference = scenarioC.successRate - scenarioA.successRate;
                const portfolioDifference = scenarioC.portfolioAtRetirement.median - scenarioA.portfolioAtRetirement.median;
                const timeDifference = scenarioC.retirementAge - scenarioA.retirementAge;
                
                insights.push({
                    title: 'EARLY_VS_LATE_RETIREMENT_SUCCESS',
                    value: `${Math.round(successDifference * 100)}%`,
                    text: `Late retirement (Scenario C at ${scenarioC.retirementAge}) improves success probability by ${Math.round(successDifference * 100)} percentage points compared to early retirement (Scenario A at ${scenarioA.retirementAge}). Working ${timeDifference} additional years significantly reduces portfolio failure risk.`
                });
                
                insights.push({
                    title: 'RETIREMENT_AGE_PORTFOLIO_IMPACT',
                    value: FinancialCalculations.formatCurrency(Math.abs(portfolioDifference)),
                    text: portfolioDifference > 0 
                        ? `Working ${timeDifference} additional years results in ${FinancialCalculations.formatCurrency(portfolioDifference)} more in median portfolio value at retirement. This additional wealth provides substantial buffer against market volatility.`
                        : `Despite ${timeDifference} fewer working years, early retirement requires similar portfolio accumulation due to longer withdrawal period.`
                });
            }
        }
        
        return insights;
    }

    /**
     * Generate Monte Carlo specific insights
     */
    static generateMonteCarloInsights(monteCarloResults, parameters) {
        const insights = [];
        
        monteCarloResults.scenarios.forEach((scenario, index) => {
            const successPct = Math.round(scenario.successRate * 100);
            const failureRate = (1 - scenario.successRate) * 100;
            
            insights.push({
                title: `MONTE_CARLO_SUCCESS_SCENARIO_${scenario.scenario}`,
                value: `${successPct}%`,
                text: `Based on ${parameters.monteCarloRuns || 1000} simulations with ${parameters.volatility}% market volatility, Scenario ${scenario.scenario} (retire at ${scenario.retirementAge}) has a ${successPct}% chance of lasting through age ${parameters.lifeExpectancy || 100}. Portfolio failure risk: ${Math.round(failureRate)}%.`
            });
            
            // Add failure analysis if significant failure rate
            if (scenario.failureAgeDistribution.length > 0) {
                const avgFailureAge = Math.round(
                    scenario.failureAgeDistribution.reduce((sum, age) => sum + age, 0) / 
                    scenario.failureAgeDistribution.length
                );
                
                insights.push({
                    title: `PORTFOLIO_FAILURE_ANALYSIS_${scenario.scenario}`,
                    value: `Age ${avgFailureAge}`,
                    text: `In unsuccessful simulations, portfolio depletion typically occurs around age ${avgFailureAge}. Consider increasing savings rate or adjusting withdrawal strategy if this risk is unacceptable.`
                });
            }
        });
        
        return insights;
    }

    /**
     * Generate portfolio range insights
     */
    static generatePortfolioRangeInsights(monteCarloResults) {
        const insights = [];
        
        // Focus on the most aggressive scenario for range analysis
        const scenarioA = monteCarloResults.scenarios[0];
        if (scenarioA) {
            const median = scenarioA.portfolioAtRetirement.median;
            const worst10 = scenarioA.portfolioAtRetirement.percentile10;
            const best10 = scenarioA.portfolioAtRetirement.percentile90;
            const range = best10 - worst10;
            
            insights.push({
                title: 'PORTFOLIO_RANGE_AT_RETIREMENT',
                value: FinancialCalculations.formatCurrency(median),
                text: `Median expected portfolio at early retirement: ${FinancialCalculations.formatCurrency(median)}. Range from ${FinancialCalculations.formatCurrency(worst10)} (worst 10%) to ${FinancialCalculations.formatCurrency(best10)} (best 10%). Market timing and sequence of returns create ${FinancialCalculations.formatCurrency(range)} variation.`
            });
            
            // Value at Risk analysis
            const portfolioVar = median - worst10;
            const varPercentage = Math.round((portfolioVar / median) * 100);
            
            insights.push({
                title: 'VALUE_AT_RISK_ANALYSIS',
                value: `${varPercentage}%`,
                text: `Value at Risk (90% confidence): Portfolio could be ${varPercentage}% (${FinancialCalculations.formatCurrency(portfolioVar)}) below median in worst-case scenarios. Consider stress-testing your withdrawal strategy against this downside risk.`
            });
        }
        
        return insights;
    }

    /**
     * Generate inflation impact insights
     */
    static generateInflationImpactInsights(monteCarloResults, financialModelingResults, parameters) {
        const insights = [];
        
        const currentIncome = parameters.targetIncome;
        const inflationRate = parameters.inflationRate / 100;
        const yearsToRetirement = Math.min(
            parameters.retirementAgeA - parameters.startingAge,
            parameters.retirementAgeB - parameters.startingAge,
            parameters.retirementAgeC - parameters.startingAge
        );
        
        const inflatedValue = currentIncome * Math.pow(1 + inflationRate, yearsToRetirement);
        const inflationMultiplier = inflatedValue / currentIncome;
        const purchasingPowerLoss = Math.round((1 - (1 / inflationMultiplier)) * 100);
        
        insights.push({
            title: 'INFLATION_PURCHASING_POWER_EROSION',
            value: `${purchasingPowerLoss}%`,
            text: `At ${parameters.inflationRate}% annual inflation, your current ${FinancialCalculations.formatCurrency(currentIncome)} purchasing power erodes by ${purchasingPowerLoss}% over ${yearsToRetirement} years. You'll need ${FinancialCalculations.formatCurrency(inflatedValue)} in nominal income to maintain the same standard of living.`
        });
        
        // Healthcare inflation analysis
        if (financialModelingResults.scenarios && financialModelingResults.scenarios[0]) {
            const healthcareCosts = financialModelingResults.scenarios[0].healthcareCosts;
            const healthcareAsPercent = Math.round((healthcareCosts / inflatedValue) * 100);
            
            insights.push({
                title: 'HEALTHCARE_INFLATION_IMPACT',
                value: `${healthcareAsPercent}%`,
                text: `Healthcare costs averaging ${FinancialCalculations.formatCurrency(healthcareCosts)} annually will consume ${healthcareAsPercent}% of retirement income. Healthcare inflation typically exceeds general inflation, making this a critical planning factor.`
            });
        }
        
        return insights;
    }

    /**
     * Generate 4% rule validation insights
     */
    static generateFourPercentRuleInsights(monteCarloResults, parameters) {
        const insights = [];
        
        const targetIncome = parameters.targetIncome;
        const fourPercentRule = targetIncome / 0.04;
        
        monteCarloResults.scenarios.forEach((scenario, index) => {
            const medianPortfolio = scenario.portfolioAtRetirement.median;
            const difference = medianPortfolio - fourPercentRule;
            const percentDifference = Math.round((difference / fourPercentRule) * 100);
            
            insights.push({
                title: `FOUR_PERCENT_RULE_VALIDATION_${scenario.scenario}`,
                value: `${Math.abs(percentDifference)}%`,
                text: difference > 0 
                    ? `Scenario ${scenario.scenario} median portfolio (${FinancialCalculations.formatCurrency(medianPortfolio)}) exceeds 4% rule requirement (${FinancialCalculations.formatCurrency(fourPercentRule)}) by ${percentDifference}%. This provides safety margin for market volatility and sequence risk.`
                    : `Scenario ${scenario.scenario} median portfolio (${FinancialCalculations.formatCurrency(medianPortfolio)}) falls ${Math.abs(percentDifference)}% short of 4% rule requirement. Consider increasing savings rate or reducing target income.`
            });
        });
        
        // Safe withdrawal rate calculation
        const scenarioA = monteCarloResults.scenarios[0];
        if (scenarioA) {
            const safeWithdrawalRate = (targetIncome / scenarioA.portfolioAtRetirement.percentile10) * 100;
            
            insights.push({
                title: 'SAFE_WITHDRAWAL_RATE_ANALYSIS',
                value: `${Math.round(safeWithdrawalRate * 10) / 10}%`,
                text: `Based on 10th percentile portfolio outcomes, a ${Math.round(safeWithdrawalRate * 10) / 10}% withdrawal rate provides 90% confidence of success. This is ${safeWithdrawalRate > 4 ? 'higher' : 'lower'} than the traditional 4% rule, reflecting your specific risk tolerance and time horizon.`
            });
        }
        
        return insights;
    }

    /**
     * Generate return rate sensitivity insights
     */
    static generateReturnSensitivityInsights(monteCarloResults, parameters) {
        const insights = [];
        
        const accumulationReturn = parameters.accumulationReturn;
        const retirementReturn = parameters.retirementReturn;
        const volatility = parameters.volatility;
        
        // Volatility drag calculation
        const volatilityDrag = (Math.pow(volatility / 100, 2)) / 2;
        const expectedGeometricReturn = (accumulationReturn / 100) - volatilityDrag;
        const dragImpact = Math.round(volatilityDrag * 100 * 100) / 100; // Convert to basis points
        
        insights.push({
            title: 'VOLATILITY_DRAG_IMPACT',
            value: `${dragImpact} bps`,
            text: `Market volatility of ${volatility}% reduces expected geometric returns by approximately ${dragImpact} basis points annually through volatility drag. Your ${accumulationReturn}% expected return becomes ~${Math.round(expectedGeometricReturn * 100 * 10) / 10}% after accounting for compounding effects of volatility.`
        });
        
        // Sequence of returns risk
        insights.push({
            title: 'SEQUENCE_OF_RETURNS_RISK',
            value: 'Critical',
            text: `Early retirement scenarios face heightened sequence of returns risk. Poor market performance in the first 5-10 years of retirement can permanently impair portfolio sustainability, even if long-term average returns meet expectations. This risk justifies conservative withdrawal rates.`
        });
        
        // Bear market recovery analysis
        const scenarioA = monteCarloResults.scenarios[0];
        if (scenarioA && scenarioA.successRate < 0.9) {
            insights.push({
                title: 'BEAR_MARKET_RECOVERY_ANALYSIS',
                value: `${Math.round((1 - scenarioA.successRate) * 100)}%`,
                text: `Portfolio failures often result from major bear markets early in retirement. With ${Math.round((1 - scenarioA.successRate) * 100)}% failure rate, consider maintaining 2-3 years of expenses in cash/bonds to avoid selling stocks during market downturns. This "bond tent" strategy can significantly improve success rates.`
            });
        }
        
        return insights;
    }

    /**
     * Generate tax optimization insights
     */
    static generateTaxOptimizationInsights(financialModelingResults, parameters) {
        const insights = [];
        
        if (financialModelingResults.scenarios && financialModelingResults.scenarios.length > 0) {
            const scenario = financialModelingResults.scenarios[0];
            const effectiveRate = Math.round(scenario.effectiveTaxRate * 100);
            const netWithdrawal = scenario.netWithdrawal;
            const grossWithdrawal = scenario.grossWithdrawal;
            const taxCost = grossWithdrawal - netWithdrawal;
            
            insights.push({
                title: 'TAX_ADJUSTED_WITHDRAWAL_ANALYSIS',
                value: `${effectiveRate}%`,
                text: `With ${parameters.accountType} accounts in ${parameters.state}, your effective tax rate on ${FinancialCalculations.formatCurrency(grossWithdrawal)} withdrawals is ${effectiveRate}%. Annual tax cost: ${FinancialCalculations.formatCurrency(taxCost)}, leaving ${FinancialCalculations.formatCurrency(netWithdrawal)} spendable income.`
            });
        }
        
        // Account type optimization
        if (financialModelingResults.accountTypeOptimization) {
            const optimization = financialModelingResults.accountTypeOptimization;
            
            insights.push({
                title: 'ACCOUNT_TYPE_OPTIMIZATION',
                value: optimization.recommendedType,
                text: `Based on current income (${FinancialCalculations.formatCurrency(parameters.currentIncome)}) and expected retirement tax rates, ${optimization.recommendedType} accounts provide optimal tax efficiency. Estimated tax savings: ${FinancialCalculations.formatCurrency(optimization.taxSavings)} over your accumulation period.`
            });
        }
        
        return insights;
    }

    /**
     * Generate trade-off analysis insights
     */
    static generateTradeoffAnalysisInsights(monteCarloResults, financialModelingResults, parameters) {
        const insights = [];
        
        if (monteCarloResults.scenarios.length >= 2) {
            const early = monteCarloResults.scenarios[0];
            const late = monteCarloResults.scenarios[monteCarloResults.scenarios.length - 1];
            
            // Calculate required savings rate
            const currentIncome = parameters.currentIncome;
            const yearsToEarlyRetirement = early.retirementAge - parameters.startingAge;
            const yearsToLateRetirement = late.retirementAge - parameters.startingAge;
            
            // Estimate required annual contributions (simplified calculation)
            const earlyTargetPortfolio = early.portfolioAtRetirement.median;
            const lateTargetPortfolio = late.portfolioAtRetirement.median;
            
            const earlyAnnualSavings = this.calculateRequiredAnnualSavings(
                earlyTargetPortfolio, 
                parameters.startingBalance, 
                yearsToEarlyRetirement, 
                parameters.accumulationReturn / 100
            );
            
            const lateAnnualSavings = this.calculateRequiredAnnualSavings(
                lateTargetPortfolio, 
                parameters.startingBalance, 
                yearsToLateRetirement, 
                parameters.accumulationReturn / 100
            );
            
            const earlySavingsRate = Math.round((earlyAnnualSavings / currentIncome) * 100);
            const lateSavingsRate = Math.round((lateAnnualSavings / currentIncome) * 100);
            
            insights.push({
                title: 'SAVINGS_RATE_COMPARISON',
                value: `${earlySavingsRate}% vs ${lateSavingsRate}%`,
                text: `Early retirement requires saving ${earlySavingsRate}% of current income vs ${lateSavingsRate}% for late retirement. The ${earlySavingsRate - lateSavingsRate} percentage point difference represents ${FinancialCalculations.formatCurrency(earlyAnnualSavings - lateAnnualSavings)} additional annual savings for financial independence ${late.retirementAge - early.retirementAge} years earlier.`
            });
            
            // Lifestyle adjustment analysis
            const remainingIncome = currentIncome - earlyAnnualSavings;
            const lifestyleReduction = Math.round((1 - (remainingIncome / currentIncome)) * 100);
            
            insights.push({
                title: 'LIFESTYLE_ADJUSTMENT_IMPACT',
                value: `${lifestyleReduction}%`,
                text: `Achieving early retirement requires reducing current lifestyle by ${lifestyleReduction}% to accommodate ${earlySavingsRate}% savings rate. Remaining spendable income: ${FinancialCalculations.formatCurrency(remainingIncome)}. Consider whether this trade-off aligns with your values and priorities.`
            });
        }
        
        return insights;
    }

    /**
     * Generate Social Security insights
     */
    static generateSocialSecurityInsights(financialModelingResults) {
        const insights = [];
        
        if (financialModelingResults.scenarios && financialModelingResults.scenarios[0]) {
            const ssOptimization = financialModelingResults.scenarios[0].socialSecurityOptimization;
            
            if (ssOptimization && ssOptimization.optimal) {
                const optimal = ssOptimization.optimal;
                const fullRetirementAge = ssOptimization.fullRetirementAge;
                
                insights.push({
                    title: 'SOCIAL_SECURITY_OPTIMIZATION',
                    value: `Age ${optimal.claimingAge}`,
                    text: `Optimal Social Security claiming strategy: Start benefits at age ${optimal.claimingAge} for maximum lifetime value of ${FinancialCalculations.formatCurrency(optimal.lifetimeValue)}. Monthly benefit: ${FinancialCalculations.formatCurrency(optimal.monthlyBenefit)}. ${optimal.claimingAge === fullRetirementAge ? 'This aligns with your full retirement age.' : optimal.claimingAge < fullRetirementAge ? 'Early claiming reduces monthly benefits but maximizes total value given life expectancy.' : 'Delayed claiming increases monthly benefits significantly.'}`
                });
            }
        }
        
        return insights;
    }

    /**
     * Generate healthcare cost insights
     */
    static generateHealthcareInsights(financialModelingResults) {
        const insights = [];
        
        if (financialModelingResults.scenarios && financialModelingResults.scenarios[0]) {
            const healthcareProjection = financialModelingResults.scenarios[0].healthcareProjection;
            
            if (healthcareProjection) {
                const totalCost = healthcareProjection.totalCumulativeCost;
                const avgAnnual = healthcareProjection.averageAnnualCost;
                const finalYear = healthcareProjection.finalYearCost;
                
                insights.push({
                    title: 'HEALTHCARE_COST_PROJECTION',
                    value: FinancialCalculations.formatCurrency(totalCost),
                    text: `Projected lifetime healthcare costs: ${FinancialCalculations.formatCurrency(totalCost)} from age ${healthcareProjection.currentAge} to ${healthcareProjection.finalAge}. Average annual cost: ${FinancialCalculations.formatCurrency(avgAnnual)}, rising to ${FinancialCalculations.formatCurrency(finalYear)} in final years due to healthcare inflation and age-related care needs.`
                });
                
                if (healthcareProjection.medicareTransition) {
                    const transition = healthcareProjection.medicareTransition;
                    
                    insights.push({
                        title: 'MEDICARE_TRANSITION_IMPACT',
                        value: FinancialCalculations.formatCurrency(transition.savings),
                        text: `Medicare eligibility at 65 reduces healthcare costs by approximately ${FinancialCalculations.formatCurrency(transition.savings)} annually. Pre-Medicare costs: ${FinancialCalculations.formatCurrency(transition.preMediareCost)}, Post-Medicare: ${FinancialCalculations.formatCurrency(transition.postMedicareCost)}. Budget extra for pre-65 healthcare if retiring early.`
                    });
                }
            }
        }
        
        return insights;
    }

    /**
     * Helper method to calculate required annual savings
     * @param {number} futureValue - Target portfolio value
     * @param {number} presentValue - Current portfolio value
     * @param {number} years - Years to accumulate
     * @param {number} rate - Annual return rate
     * @returns {number} - Required annual savings
     */
    static calculateRequiredAnnualSavings(futureValue, presentValue, years, rate) {
        if (years <= 0) return 0;
        
        if (rate === 0) {
            return (futureValue - presentValue) / years;
        }
        
        const factor = Math.pow(1 + rate, years);
        const numerator = futureValue - presentValue * factor;
        const denominator = (factor - 1) / rate;
        
        return Math.max(0, numerator / denominator);
    }

    /**
     * Interpret Monte Carlo results for human-readable summary
     * @param {Object} results - Monte Carlo simulation results
     * @returns {string} - Human-readable interpretation
     */
    static interpretMonteCarloResults(results) {
        if (!results || !results.scenarios) {
            return "Monte Carlo analysis not available.";
        }

        const scenarios = results.scenarios;
        const totalSimulations = results.totalSimulations;
        const executionTime = Math.round(results.executionTime);

        let interpretation = `Monte Carlo Analysis Summary (${totalSimulations} simulations, ${executionTime}ms execution):\n\n`;

        scenarios.forEach((scenario, index) => {
            const successRate = Math.round(scenario.successRate * 100);
            const medianPortfolio = FinancialCalculations.formatCurrency(scenario.portfolioAtRetirement.median);
            const range = `${FinancialCalculations.formatCurrency(scenario.portfolioAtRetirement.percentile10)} - ${FinancialCalculations.formatCurrency(scenario.portfolioAtRetirement.percentile90)}`;

            interpretation += `Scenario ${scenario.scenario} (Retire at ${scenario.retirementAge}): ${successRate}% success rate\n`;
            interpretation += `  • Median portfolio: ${medianPortfolio}\n`;
            interpretation += `  • 80% confidence range: ${range}\n`;

            if (scenario.failureAgeDistribution.length > 0) {
                const avgFailureAge = Math.round(
                    scenario.failureAgeDistribution.reduce((sum, age) => sum + age, 0) / 
                    scenario.failureAgeDistribution.length
                );
                interpretation += `  • Average failure age: ${avgFailureAge}\n`;
            }

            interpretation += '\n';
        });

        return interpretation;
    }

    /**
     * Generate tax optimization recommendations
     * @param {Object} taxAnalysis - Tax analysis results
     * @returns {Array<string>} - Array of actionable recommendations
     */
    static generateTaxOptimizationRecommendations(taxAnalysis) {
        const recommendations = [];

        if (taxAnalysis.accountTypeOptimization) {
            const opt = taxAnalysis.accountTypeOptimization;
            recommendations.push(`Primary strategy: Use ${opt.recommendedType} accounts for tax efficiency`);
            
            if (opt.analysis && opt.analysis.recommendations) {
                opt.analysis.recommendations.forEach(rec => {
                    recommendations.push(`${rec.type}: ${rec.reason} - ${rec.longTermImpact}`);
                });
            }
        }

        if (taxAnalysis.scenarios && taxAnalysis.scenarios.length > 0) {
            const scenario = taxAnalysis.scenarios[0];
            if (scenario.effectiveTaxRate > 0.25) {
                recommendations.push("Consider Roth conversions during low-income years to reduce future tax burden");
                recommendations.push("Evaluate tax-loss harvesting opportunities in taxable accounts");
            }
            
            if (scenario.effectiveTaxRate < 0.15) {
                recommendations.push("Take advantage of low tax rates with Traditional account withdrawals");
                recommendations.push("Consider Roth conversions while in lower tax brackets");
            }
        }

        return recommendations;
    }
}

// Export for use in other modules
window.InsightsEngine = InsightsEngine;