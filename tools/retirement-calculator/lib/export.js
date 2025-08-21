/**
 * Export Utility
 * Functions for exporting calculation results in various formats
 */

class ExportUtility {
    /**
     * Export data as JSON file
     */
    static exportJSON(data, filename = 'retirement-scenarios.json') {
        const jsonString = JSON.stringify(data, null, 2);
        this.downloadFile(jsonString, filename, 'application/json');
    }

    /**
     * Export data as CSV file
     */
    static exportCSV(scenarios, filename = 'retirement-scenarios.csv') {
        const headers = [
            'Scenario',
            'Retirement Age',
            'Years Until Retirement',
            'First Year Income',
            'Target Portfolio Size',
            'Monthly Contribution',
            'Annual Contribution'
        ];

        const rows = scenarios.map(scenario => [
            scenario.label,
            scenario.retirementAge,
            scenario.yearsUntilRetirement,
            FinancialCalculations.formatCurrency(scenario.inflatedTargetIncome),
            FinancialCalculations.formatCurrency(scenario.targetPortfolioSize),
            FinancialCalculations.formatCurrency(scenario.monthlyContribution),
            FinancialCalculations.formatCurrency(scenario.annualContribution)
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        this.downloadFile(csvContent, filename, 'text/csv');
    }

    /**
     * Generate shareable URL with current parameters
     */
    static generateShareableURL(params) {
        const urlParams = new URLSearchParams();
        
        // Add all parameters to URL
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                urlParams.set(key, params[key]);
            }
        });

        // Create new URL with parameters
        const url = new URL(window.location.href.split('#')[0]);
        url.hash = urlParams.toString();
        
        return url.toString();
    }

    /**
     * Copy shareable URL to clipboard
     */
    static async copyShareableURL(params) {
        const url = this.generateShareableURL(params);
        
        try {
            await navigator.clipboard.writeText(url);
            return { success: true, url };
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = url;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return { success: true, url };
        }
    }

    /**
     * Helper function to trigger file download
     */
    static downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the URL object
        URL.revokeObjectURL(url);
    }

    /**
     * Export comprehensive data package with Monte Carlo and financial modeling results
     */
    static exportComprehensiveData(scenarios, netWorthData, withdrawalData, insights, params, monteCarloResults = null, financialModelingResults = null) {
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                calculatorVersion: '2.0',
                analysisType: monteCarloResults && financialModelingResults ? 'Monte Carlo with Financial Modeling' : 'Deterministic',
                description: 'BufoIndex > Retirement Planning Calculator - Comprehensive Analysis Results'
            },
            parameters: {
                userDecisions: {
                    startingAge: params.startingAge,
                    retirementAges: {
                        scenarioA: params.retirementAgeA,
                        scenarioB: params.retirementAgeB,
                        scenarioC: params.retirementAgeC
                    },
                    financialGoals: {
                        targetIncome: params.targetIncome,
                        startingBalance: params.startingBalance,
                        currentIncome: params.currentIncome
                    },
                    taxStrategy: {
                        accountType: params.accountType,
                        state: params.state,
                        filingStatus: params.filingStatus
                    },
                    socialSecurity: {
                        claimingAge: params.socialSecurityAge,
                        expectedBenefit: params.socialSecurityBenefit
                    },
                    healthcare: {
                        multiplier: params.healthcareMultiplier,
                        inflationRate: params.healthcareInflation
                    }
                },
                assumptions: {
                    inflationRate: params.inflationRate,
                    accumulationReturn: params.accumulationReturn,
                    retirementReturn: params.retirementReturn,
                    marketVolatility: params.volatility,
                    lifeExpectancy: params.lifeExpectancy,
                    taxRates: {
                        current: params.currentTaxRate,
                        retirement: params.retirementTaxRate
                    }
                },
                monteCarloSettings: monteCarloResults ? {
                    simulations: params.monteCarloRuns,
                    volatility: params.volatility,
                    executionTime: monteCarloResults.executionTime,
                    totalSimulations: monteCarloResults.totalSimulations
                } : null
            },
            deterministicResults: {
                scenarios: scenarios,
                projections: {
                    netWorth: netWorthData,
                    withdrawals: withdrawalData
                },
                basicInsights: insights.filter(insight => 
                    ['TIME_VS_MONEY_TRADEOFF', 'TOTAL_CONTRIBUTION_IMPACT', 'INFLATION_IMPACT', 'PORTFOLIO_REQUIREMENT', 'SAVINGS_RATE'].includes(insight.title)
                )
            },
            monteCarloResults: monteCarloResults ? {
                scenarios: monteCarloResults.scenarios.map(scenario => ({
                    scenario: scenario.scenario,
                    retirementAge: scenario.retirementAge,
                    successRate: scenario.successRate,
                    portfolioStatistics: {
                        atRetirement: scenario.portfolioAtRetirement,
                        final: scenario.finalPortfolioValue
                    },
                    riskMetrics: {
                        failureRate: 1 - scenario.successRate,
                        averageFailureAge: scenario.failureAgeDistribution.length > 0 
                            ? scenario.failureAgeDistribution.reduce((sum, age) => sum + age, 0) / scenario.failureAgeDistribution.length
                            : null,
                        failureAgeDistribution: scenario.failureAgeDistribution,
                        portfolioVolatility: this.calculateVolatility(scenario.allSimulations.map(sim => sim.portfolioAtRetirement))
                    },
                    yearlyProgression: scenario.yearlyProgression
                })),
                aggregatedAnalysis: monteCarloResults.aggregatedStats,
                rawSimulationCount: monteCarloResults.totalSimulations
            } : null,
            financialModelingResults: financialModelingResults ? {
                taxAnalysis: financialModelingResults.scenarios.map(scenario => ({
                    scenario: scenario.scenario,
                    retirementAge: scenario.retirementAge,
                    withdrawalAnalysis: {
                        gross: scenario.grossWithdrawal,
                        net: scenario.netWithdrawal,
                        taxes: scenario.taxAnalysis.totalTax,
                        effectiveRate: scenario.effectiveTaxRate,
                        breakdown: scenario.taxAnalysis.breakdown
                    },
                    marginalRates: {
                        federal: scenario.taxAnalysis.marginalRate * 0.7, // Approximate federal portion
                        state: scenario.taxAnalysis.marginalRate * 0.3   // Approximate state portion
                    }
                })),
                socialSecurityOptimization: financialModelingResults.scenarios.map(scenario => ({
                    scenario: scenario.scenario,
                    retirementAge: scenario.retirementAge,
                    annualBenefit: scenario.socialSecurityBenefit,
                    optimization: scenario.socialSecurityOptimization ? {
                        optimalClaimingAge: scenario.socialSecurityOptimization.optimal.claimingAge,
                        optimalMonthlyBenefit: scenario.socialSecurityOptimization.optimal.monthlyBenefit,
                        lifetimeValue: scenario.socialSecurityOptimization.optimal.lifetimeValue,
                        allScenarios: scenario.socialSecurityOptimization.allScenarios,
                        breakEvenAnalysis: scenario.socialSecurityOptimization.breakEvenAnalysis
                    } : null
                })),
                healthcareProjections: financialModelingResults.scenarios.map(scenario => ({
                    scenario: scenario.scenario,
                    retirementAge: scenario.retirementAge,
                    averageAnnualCost: scenario.healthcareCosts,
                    totalLifetimeCost: scenario.healthcareProjection ? scenario.healthcareProjection.totalCumulativeCost : null,
                    projectedCosts: scenario.healthcareProjection ? scenario.healthcareProjection.projectedCosts : null,
                    medicareTransition: scenario.healthcareProjection ? scenario.healthcareProjection.medicareTransition : null
                })),
                accountTypeOptimization: financialModelingResults.accountTypeOptimization
            } : null,
            advancedInsights: insights.filter(insight => 
                !['TIME_VS_MONEY_TRADEOFF', 'TOTAL_CONTRIBUTION_IMPACT', 'INFLATION_IMPACT', 'PORTFOLIO_REQUIREMENT', 'SAVINGS_RATE'].includes(insight.title)
            ).map(insight => ({
                category: this.categorizeInsight(insight.title),
                title: insight.title,
                value: insight.value,
                analysis: insight.text,
                confidence: this.getInsightConfidence(insight.title)
            })),
            chartData: this.generateChartDataExport(monteCarloResults, scenarios, netWorthData, withdrawalData),
            methodologyNotes: {
                deterministicCalculations: {
                    fourPercentRule: 'Portfolio Size = Annual Income ÷ 0.04',
                    compoundGrowth: 'Future Value = Present Value × (1 + rate)^years',
                    requiredPayment: 'PMT = (FV - PV × (1 + r)^n) ÷ (((1 + r)^n - 1) ÷ r)'
                },
                monteCarloMethodology: monteCarloResults ? {
                    distributionType: 'Normal (Box-Muller transformation)',
                    returnGeneration: 'Stochastic with specified mean and volatility',
                    sequenceRisk: 'Modeled through random return ordering',
                    failureCriteria: 'Portfolio value <= 0 before life expectancy'
                } : null,
                assumptions: {
                    inflationAdjustment: 'All future values adjusted for inflation',
                    taxCalculations: 'Based on 2024 federal and state tax brackets',
                    healthcareCosts: 'Age-adjusted with healthcare-specific inflation',
                    socialSecurity: 'Based on current Social Security Administration rules'
                }
            }
        };

        return exportData;
    }

    /**
     * Export comprehensive Monte Carlo data for analysis
     */
    static exportComprehensiveMonteCarloData(allResults) {
        if (!allResults || !allResults.monteCarloResults) {
            console.warn('No Monte Carlo results available for comprehensive export');
            return null;
        }

        const monteCarloResults = allResults.monteCarloResults;
        const financialModelingResults = allResults.financialModelingResults;

        return {
            metadata: {
                exportDate: new Date().toISOString(),
                dataType: 'Monte Carlo Simulation Results',
                simulationCount: monteCarloResults.totalSimulations,
                executionTime: monteCarloResults.executionTime
            },
            simulationParameters: allResults.parameters,
            scenarioResults: monteCarloResults.scenarios.map(scenario => ({
                scenario: scenario.scenario,
                configuration: {
                    retirementAge: scenario.retirementAge
                },
                statisticalSummary: {
                    successRate: scenario.successRate,
                    portfolioAtRetirement: scenario.portfolioAtRetirement,
                    finalPortfolioValue: scenario.finalPortfolioValue,
                    failureAnalysis: {
                        failureRate: 1 - scenario.successRate,
                        failureAgeDistribution: scenario.failureAgeDistribution,
                        averageFailureAge: scenario.failureAgeDistribution.length > 0 
                            ? scenario.failureAgeDistribution.reduce((sum, age) => sum + age, 0) / scenario.failureAgeDistribution.length
                            : null
                    }
                },
                yearByYearProgression: scenario.yearlyProgression,
                rawSimulationData: scenario.allSimulations ? scenario.allSimulations.map(sim => ({
                    simulationId: sim.simulationId || Math.random(),
                    success: sim.success,
                    portfolioAtRetirement: sim.portfolioAtRetirement,
                    finalPortfolioValue: sim.finalPortfolioValue,
                    failureAge: sim.failureAge,
                    totalWithdrawals: sim.totalWithdrawals,
                    yearlyData: sim.yearlyProgression ? sim.yearlyProgression.map(year => ({
                        age: year.age,
                        portfolioValue: year.portfolioValue,
                        withdrawal: year.withdrawal,
                        annualReturn: year.annualReturn,
                        phase: year.phase
                    })) : []
                })) : []
            })),
            aggregatedStatistics: monteCarloResults.aggregatedStats,
            riskAnalysis: {
                overallRisk: this.calculateOverallRisk(monteCarloResults),
                sequenceOfReturnsRisk: this.calculateSequenceRisk(monteCarloResults),
                portfolioSurvivalRates: this.calculateSurvivalRates(monteCarloResults)
            },
            financialModelingIntegration: financialModelingResults
        };
    }

    /**
     * Export multiple CSV files in a ZIP package
     */
    static exportMultipleCSVs(results) {
        if (typeof JSZip === 'undefined') {
            console.warn('JSZip not available, falling back to single CSV export');
            this.exportCSV(results.scenarios || results);
            return;
        }

        const zip = new JSZip();
        
        try {
            // Scenario Summary CSV  
            const scenarioCSV = this.generateScenarioSummaryCSV(results);
            zip.file('scenario_summary.csv', scenarioCSV);

            // Monte Carlo Results CSV (if available)
            if (results.monteCarloResults) {
                const monteCarloCSV = this.generateMonteCarloCSV(results.monteCarloResults);
                zip.file('monte_carlo_results.csv', monteCarloCSV);

                // Year-by-year projections CSV
                const projectionCSV = this.generateYearlyProjectionCSV(results.monteCarloResults);
                zip.file('yearly_projections.csv', projectionCSV);
            }

            // Financial Modeling CSV (if available)
            if (results.financialModelingResults) {
                const financialModelingCSV = this.generateFinancialModelingCSV(results.financialModelingResults);
                zip.file('financial_modeling.csv', financialModelingCSV);
            }

            // Insights CSV
            if (results.insights) {
                const insightsCSV = this.generateInsightsCSV(results.insights);
                zip.file('insights_analysis.csv', insightsCSV);
            }

            // Generate and download ZIP
            zip.generateAsync({ type: 'blob' }).then(content => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = `retirement_analysis_${new Date().toISOString().split('T')[0]}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            });

        } catch (error) {
            console.error('Error generating ZIP export:', error);
            // Fallback to basic CSV export
            this.exportCSV(results.scenarios || results);
        }
    }

    // Helper methods for enhanced export functionality

    /**
     * Calculate volatility of an array of values
     */
    static calculateVolatility(values) {
        if (!values || values.length === 0) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    /**
     * Categorize insight by title for better organization
     */
    static categorizeInsight(title) {
        const categories = {
            'MONTE_CARLO': ['MONTE_CARLO_SUCCESS', 'PORTFOLIO_FAILURE_ANALYSIS', 'VALUE_AT_RISK'],
            'PORTFOLIO_ANALYSIS': ['PORTFOLIO_RANGE_AT_RETIREMENT', 'FOUR_PERCENT_RULE_VALIDATION', 'SAFE_WITHDRAWAL_RATE'],
            'RETIREMENT_TIMING': ['EARLY_VS_LATE_RETIREMENT', 'RETIREMENT_AGE_PORTFOLIO_IMPACT'],
            'MARKET_RISK': ['VOLATILITY_DRAG_IMPACT', 'SEQUENCE_OF_RETURNS_RISK', 'BEAR_MARKET_RECOVERY'],
            'INFLATION_HEALTHCARE': ['INFLATION_PURCHASING_POWER', 'HEALTHCARE_INFLATION_IMPACT', 'MEDICARE_TRANSITION'],
            'TAX_OPTIMIZATION': ['TAX_ADJUSTED_WITHDRAWAL', 'ACCOUNT_TYPE_OPTIMIZATION'],
            'SOCIAL_SECURITY': ['SOCIAL_SECURITY_OPTIMIZATION'],
            'LIFESTYLE_PLANNING': ['SAVINGS_RATE_COMPARISON', 'LIFESTYLE_ADJUSTMENT_IMPACT'],
            'HEALTHCARE': ['HEALTHCARE_COST_PROJECTION']
        };

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => title.includes(keyword))) {
                return category;
            }
        }
        
        return 'GENERAL';
    }

    /**
     * Assign confidence level to insights
     */
    static getInsightConfidence(title) {
        const highConfidence = ['MONTE_CARLO_SUCCESS', 'PORTFOLIO_RANGE', 'TAX_ADJUSTED_WITHDRAWAL'];
        const mediumConfidence = ['INFLATION_PURCHASING_POWER', 'HEALTHCARE_COST', 'FOUR_PERCENT_RULE'];
        const lowConfidence = ['BEAR_MARKET_RECOVERY', 'LIFESTYLE_ADJUSTMENT'];

        if (highConfidence.some(keyword => title.includes(keyword))) return 'HIGH';
        if (mediumConfidence.some(keyword => title.includes(keyword))) return 'MEDIUM';
        if (lowConfidence.some(keyword => title.includes(keyword))) return 'LOW';
        
        return 'MEDIUM';
    }

    /**
     * Generate chart data for export
     */
    static generateChartDataExport(monteCarloResults, scenarios, netWorthData, withdrawalData) {
        const chartData = {
            scenarios: scenarios,
            netWorthProgression: netWorthData,
            withdrawalProgression: withdrawalData
        };

        if (monteCarloResults) {
            chartData.successProbability = monteCarloResults.scenarios.map(scenario => ({
                scenario: scenario.scenario,
                retirementAge: scenario.retirementAge,
                successRate: scenario.successRate,
                failureRate: 1 - scenario.successRate
            }));

            chartData.portfolioDistribution = monteCarloResults.scenarios.map(scenario => ({
                scenario: scenario.scenario,
                percentiles: scenario.portfolioAtRetirement
            }));

            chartData.confidenceBands = monteCarloResults.scenarios.map(scenario => ({
                scenario: scenario.scenario,
                retirementAge: scenario.retirementAge,
                yearlyProgression: scenario.yearlyProgression
            }));
        }

        return chartData;
    }

    /**
     * Generate scenario summary CSV
     */
    static generateScenarioSummaryCSV(results) {
        const scenarios = results.scenarios || results;
        const headers = [
            'Scenario',
            'Retirement Age', 
            'Years Until Retirement',
            'Target Portfolio Size',
            'Monthly Contribution',
            'Annual Contribution',
            'Success Rate (%)',
            'Median Portfolio at Retirement',
            'Portfolio Range (10th-90th percentile)'
        ];

        const rows = scenarios.map((scenario, index) => {
            const monteCarloScenario = results.monteCarloResults ? 
                results.monteCarloResults.scenarios.find(mc => mc.scenario === scenario.label) : null;

            return [
                scenario.label,
                scenario.retirementAge,
                scenario.yearsUntilRetirement,
                FinancialCalculations.formatCurrency(scenario.targetPortfolioSize),
                FinancialCalculations.formatCurrency(scenario.monthlyContribution),
                FinancialCalculations.formatCurrency(scenario.annualContribution),
                monteCarloScenario ? Math.round(monteCarloScenario.successRate * 100) : 'N/A',
                monteCarloScenario ? FinancialCalculations.formatCurrency(monteCarloScenario.portfolioAtRetirement.median) : 'N/A',
                monteCarloScenario ? 
                    `${FinancialCalculations.formatCurrency(monteCarloScenario.portfolioAtRetirement.percentile10)} - ${FinancialCalculations.formatCurrency(monteCarloScenario.portfolioAtRetirement.percentile90)}` : 
                    'N/A'
            ];
        });

        return [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
    }

    /**
     * Generate Monte Carlo results CSV
     */
    static generateMonteCarloCSV(monteCarloResults) {
        const headers = [
            'Scenario',
            'Retirement Age',
            'Success Rate (%)',
            'Failure Rate (%)',
            'Median Portfolio at Retirement',
            '10th Percentile Portfolio',
            '90th Percentile Portfolio',
            'Average Failure Age',
            'Portfolio Volatility'
        ];

        const rows = monteCarloResults.scenarios.map(scenario => [
            scenario.scenario,
            scenario.retirementAge,
            Math.round(scenario.successRate * 100),
            Math.round((1 - scenario.successRate) * 100),
            FinancialCalculations.formatCurrency(scenario.portfolioAtRetirement.median),
            FinancialCalculations.formatCurrency(scenario.portfolioAtRetirement.percentile10),
            FinancialCalculations.formatCurrency(scenario.portfolioAtRetirement.percentile90),
            scenario.failureAgeDistribution.length > 0 ? 
                Math.round(scenario.failureAgeDistribution.reduce((sum, age) => sum + age, 0) / scenario.failureAgeDistribution.length) : 
                'N/A',
            this.calculateVolatility(scenario.allSimulations ? scenario.allSimulations.map(sim => sim.portfolioAtRetirement) : [])
        ]);

        return [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
    }

    /**
     * Generate yearly projection CSV
     */
    static generateYearlyProjectionCSV(monteCarloResults) {
        const headers = [
            'Scenario',
            'Age',
            'Median Portfolio Value',
            '10th Percentile',
            '25th Percentile', 
            '75th Percentile',
            '90th Percentile',
            'Median Withdrawal',
            'Simulation Count'
        ];

        const rows = [];
        monteCarloResults.scenarios.forEach(scenario => {
            scenario.yearlyProgression.forEach(yearData => {
                rows.push([
                    scenario.scenario,
                    yearData.age,
                    FinancialCalculations.formatCurrency(yearData.portfolioValue),
                    FinancialCalculations.formatCurrency(yearData.percentile10 || 0),
                    FinancialCalculations.formatCurrency(yearData.percentile25 || 0),
                    FinancialCalculations.formatCurrency(yearData.percentile75 || 0),
                    FinancialCalculations.formatCurrency(yearData.percentile90 || 0),
                    FinancialCalculations.formatCurrency(yearData.withdrawal || 0),
                    yearData.simulationCount || 0
                ]);
            });
        });

        return [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
    }

    /**
     * Generate financial modeling CSV
     */
    static generateFinancialModelingCSV(financialModelingResults) {
        const headers = [
            'Scenario',
            'Retirement Age',
            'Gross Withdrawal',
            'Net Withdrawal',
            'Total Tax',
            'Effective Tax Rate (%)',
            'Social Security Benefit',
            'Optimal SS Claiming Age',
            'Healthcare Costs',
            'Total Lifetime Healthcare Cost'
        ];

        const rows = financialModelingResults.scenarios.map(scenario => [
            scenario.scenario,
            scenario.retirementAge,
            FinancialCalculations.formatCurrency(scenario.grossWithdrawal),
            FinancialCalculations.formatCurrency(scenario.netWithdrawal),
            FinancialCalculations.formatCurrency(scenario.taxAnalysis.totalTax),
            Math.round(scenario.effectiveTaxRate * 100),
            FinancialCalculations.formatCurrency(scenario.socialSecurityBenefit),
            scenario.socialSecurityOptimization ? scenario.socialSecurityOptimization.optimal.claimingAge : 'N/A',
            FinancialCalculations.formatCurrency(scenario.healthcareCosts),
            scenario.healthcareProjection ? FinancialCalculations.formatCurrency(scenario.healthcareProjection.totalCumulativeCost) : 'N/A'
        ]);

        return [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
    }

    /**
     * Generate insights CSV
     */
    static generateInsightsCSV(insights) {
        const headers = [
            'Category',
            'Title',
            'Key Value',
            'Analysis',
            'Confidence Level'
        ];

        const rows = insights.map(insight => [
            this.categorizeInsight(insight.title),
            insight.title,
            insight.value,
            insight.text,
            this.getInsightConfidence(insight.title)
        ]);

        return [headers, ...rows]
            .map(row => row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(','))
            .join('\n');
    }

    /**
     * Calculate overall risk metrics
     */
    static calculateOverallRisk(monteCarloResults) {
        const avgSuccessRate = monteCarloResults.scenarios.reduce((sum, scenario) => sum + scenario.successRate, 0) / monteCarloResults.scenarios.length;
        const riskScore = Math.round((1 - avgSuccessRate) * 100);
        
        return {
            averageSuccessRate: avgSuccessRate,
            overallRiskScore: riskScore,
            riskLevel: riskScore < 20 ? 'LOW' : riskScore < 40 ? 'MEDIUM' : 'HIGH'
        };
    }

    /**
     * Calculate sequence of returns risk
     */
    static calculateSequenceRisk(monteCarloResults) {
        // Simplified sequence risk calculation
        const earlyRetirementScenario = monteCarloResults.scenarios[0];
        const lateRetirementScenario = monteCarloResults.scenarios[monteCarloResults.scenarios.length - 1];
        
        const sequenceRiskImpact = earlyRetirementScenario ? 
            (lateRetirementScenario.successRate - earlyRetirementScenario.successRate) * 100 : 0;
        
        return {
            sequenceRiskImpact: Math.round(sequenceRiskImpact),
            riskLevel: sequenceRiskImpact > 30 ? 'HIGH' : sequenceRiskImpact > 15 ? 'MEDIUM' : 'LOW',
            description: 'Impact of early retirement on success rate due to sequence risk'
        };
    }

    /**
     * Calculate portfolio survival rates by age
     */
    static calculateSurvivalRates(monteCarloResults) {
        const survivalRates = {};
        
        monteCarloResults.scenarios.forEach(scenario => {
            const ageRanges = [65, 70, 75, 80, 85, 90, 95, 100];
            survivalRates[scenario.scenario] = {};
            
            ageRanges.forEach(age => {
                const survivingPortfolios = scenario.yearlyProgression.filter(yearData => 
                    yearData.age === age && yearData.portfolioValue > 0
                ).length;
                
                const totalSimulations = scenario.yearlyProgression.filter(yearData => 
                    yearData.age === age
                ).length;
                
                survivalRates[scenario.scenario][`age${age}`] = totalSimulations > 0 ? 
                    Math.round((survivingPortfolios / totalSimulations) * 100) : 0;
            });
        });
        
        return survivalRates;
    }
}

// Export for use in other modules
window.ExportUtility = ExportUtility;