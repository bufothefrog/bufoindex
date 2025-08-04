/**
 * Retirement Calculator Main Script v2.0
 * Orchestrates the terminal-style retirement planning calculator with Monte Carlo analysis
 */

class RetirementCalculator {
    constructor() {
        this.scenarios = [];
        this.insights = [];
        this.netWorthData = [];
        this.withdrawalData = [];
        this.monteCarloResults = null;
        this.financialModelingResults = null;
        
        // Chart instances
        this.withdrawalsChart = null;
        this.netWorthChart = null;
        this.successProbabilityChart = null;
        this.portfolioDistributionChart = null;
        
        this.init();
    }

    init() {
        // Load state from URL or use defaults
        const params = URLStateManager.loadState();
        URLStateManager.applyParametersToForm(params);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up automatic state saving
        URLStateManager.setupAutoSave();
        
        // Set up popstate listener for browser navigation
        URLStateManager.setupPopstateListener(() => this.updateAll());
        
        // Initial calculation
        this.updateAll();
    }

    setupEventListeners() {
        // Input change listeners
        const inputs = document.querySelectorAll('.retirement-calculator input, .retirement-calculator select');
        inputs.forEach(input => {
            if (input.id === 'targetIncome' || input.id === 'startingBalance' || input.id === 'currentIncome' || input.id === 'socialSecurityBenefit') {
                // Format currency inputs with commas
                input.addEventListener('input', (e) => {
                    const cursorPosition = e.target.selectionStart;
                    const oldValue = e.target.value;
                    const rawValue = oldValue.replace(/[^0-9]/g, '');
                    
                    if (rawValue) {
                        const formattedValue = parseInt(rawValue).toLocaleString();
                        e.target.value = formattedValue;
                        
                        // Adjust cursor position after formatting
                        const lengthDiff = formattedValue.length - oldValue.length;
                        e.target.setSelectionRange(cursorPosition + lengthDiff, cursorPosition + lengthDiff);
                    }
                    
                    this.updateAll();
                });
            } else {
                input.addEventListener('input', () => this.updateAll());
            }
            
            input.addEventListener('change', () => this.updateAll());
        });

        // Export button listeners
        document.getElementById('exportJSON')?.addEventListener('click', () => this.exportJSON());
        document.getElementById('exportCSV')?.addEventListener('click', () => this.exportCSV());
        document.getElementById('shareURL')?.addEventListener('click', () => this.shareURL());
        
        // Form validation listeners
        this.setupFormValidation();
    }

    calculateScenarios() {
        const params = URLStateManager.collectParametersFromForm();
        const validated = URLStateManager.validateParameters(params);

        const scenarioConfigs = [
            { label: 'A', retirementAge: validated.retirementAgeA, color: '#e74c3c' },
            { label: 'B', retirementAge: validated.retirementAgeB, color: '#f39c12' },
            { label: 'C', retirementAge: validated.retirementAgeC, color: '#27ae60' }
        ];

        this.scenarios = scenarioConfigs.map(config => {
            const calculation = FinancialCalculations.calculateScenario({
                startingAge: validated.startingAge,
                retirementAge: config.retirementAge,
                targetIncome: validated.targetIncome,
                startingBalance: validated.startingBalance,
                inflationRate: validated.inflationRate / 100,
                annualReturn: validated.annualReturn / 100
            });

            return {
                ...config,
                ...calculation,
                retirementAge: config.retirementAge
            };
        });

        return this.scenarios;
    }

    updateSummaryTable() {
        const tbody = document.getElementById('summaryTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.scenarios.map(scenario => {
            if (!scenario.valid) {
                return `
                    <tr class="text-terminal-green opacity-50">
                        <td class="py-2 px-3">SCENARIO_${scenario.label}</td>
                        <td class="py-2 px-3">${scenario.retirementAge}</td>
                        <td class="py-2 px-3" colspan="4">INVALID: Retirement age must be after starting age</td>
                    </tr>
                `;
            }

            return `
                <tr class="text-terminal-green">
                    <td class="py-2 px-3">SCENARIO_${scenario.label}</td>
                    <td class="py-2 px-3">${scenario.retirementAge}</td>
                    <td class="py-2 px-3">${scenario.yearsUntilRetirement}</td>
                    <td class="py-2 px-3">${FinancialCalculations.formatCurrency(scenario.inflatedTargetIncome)}</td>
                    <td class="py-2 px-3">${FinancialCalculations.formatCurrency(scenario.targetPortfolioSize)}</td>
                    <td class="py-2 px-3">${FinancialCalculations.formatCurrency(scenario.monthlyContribution)}</td>
                </tr>
            `;
        }).join('');
    }

    generateInsights() {
        const validScenarios = this.scenarios.filter(s => s.valid);
        if (validScenarios.length === 0) return [];

        const params = URLStateManager.collectParametersFromForm();
        const validated = URLStateManager.validateParameters(params);
        
        // Use enhanced insights engine if Monte Carlo results are available
        if (this.monteCarloResults && this.financialModelingResults) {
            this.insights = InsightsEngine.generateAdvancedInsights(
                this.monteCarloResults, 
                this.financialModelingResults, 
                validated
            );
            return this.insights;
        }

        // Fallback to basic insights for backwards compatibility
        const earliest = validScenarios.reduce((min, s) => s.retirementAge < min.retirementAge ? s : min);
        const latest = validScenarios.reduce((max, s) => s.retirementAge > max.retirementAge ? s : max);

        const insights = [];

        if (earliest.label !== latest.label) {
            const timeDifference = latest.retirementAge - earliest.retirementAge;
            const contributionDifference = earliest.monthlyContribution - latest.monthlyContribution;
            const contributionRatio = Math.round((earliest.monthlyContribution / latest.monthlyContribution) * 100 - 100);

            insights.push({
                title: 'TIME_VS_MONEY_TRADEOFF',
                value: `${contributionRatio}%`,
                text: `Retiring ${timeDifference} years earlier requires ${contributionRatio}% higher monthly contributions (${FinancialCalculations.formatCurrency(contributionDifference)} more per month).`
            });

            const earlyTotalContributions = earliest.monthlyContribution * 12 * earliest.yearsUntilRetirement;
            const lateTotalContributions = latest.monthlyContribution * 12 * latest.yearsUntilRetirement;

            insights.push({
                title: 'TOTAL_CONTRIBUTION_IMPACT',
                value: FinancialCalculations.formatCurrency(Math.abs(earlyTotalContributions - lateTotalContributions)),
                text: earlyTotalContributions > lateTotalContributions ? 
                    `Early retirement requires ${FinancialCalculations.formatCurrency(earlyTotalContributions - lateTotalContributions)} more in total contributions despite fewer working years.` :
                    `Late retirement allows ${FinancialCalculations.formatCurrency(lateTotalContributions - earlyTotalContributions)} more in total contributions over the longer timeframe.`
            });
        }

        const inflationImpact = Math.round(((earliest.inflatedTargetIncome / validated.targetIncome) - 1) * 100);
        insights.push({
            title: 'INFLATION_IMPACT',
            value: `${inflationImpact}%`,
            text: `Your ${FinancialCalculations.formatCurrency(validated.targetIncome)} target income today will require ${FinancialCalculations.formatCurrency(earliest.inflatedTargetIncome)} in nominal dollars at early retirement due to ${validated.inflationRate}% annual inflation.`
        });

        insights.push({
            title: 'PORTFOLIO_REQUIREMENT',
            value: FinancialCalculations.formatCurrency(earliest.targetPortfolioSize),
            text: `To withdraw ${FinancialCalculations.formatCurrency(earliest.inflatedTargetIncome)} annually using the 4% rule, you need a portfolio worth ${FinancialCalculations.formatCurrency(earliest.targetPortfolioSize)} at retirement.`
        });

        insights.push({
            title: 'SAVINGS_RATE',
            value: `${Math.round(earliest.monthlyContribution / (validated.targetIncome/12) * 100)}%`,
            text: `Early retirement (Scenario ${earliest.label}) requires saving ${Math.round(earliest.monthlyContribution / (validated.targetIncome/12) * 100)}% of your target monthly retirement income every month during your working years.`
        });

        this.insights = insights;
        return insights;
    }

    updateInsights() {
        const insightsContainer = document.getElementById('insightsContent');
        if (!insightsContainer) return;

        const insights = this.generateInsights();

        insightsContainer.innerHTML = insights.map(insight => `
            <div class="terminal-insight">
                <div class="terminal-insight-title">${insight.title}</div>
                <span class="terminal-insight-value">${insight.value}</span>
                <div class="terminal-insight-text">${insight.text}</div>
            </div>
        `).join('');
    }

    updateCharts() {
        this.updateWithdrawalsChart();
        this.updateNetWorthChart();
        
        // Update new Monte Carlo charts if data is available
        if (this.monteCarloResults) {
            this.updateSuccessProbabilityChart();
            this.updatePortfolioDistributionChart();
        }
    }

    updateWithdrawalsChart() {
        const params = URLStateManager.collectParametersFromForm();
        const validated = URLStateManager.validateParameters(params);

        // Generate withdrawal data
        const labels = [];
        for (let age = 35; age <= 100; age += 5) {
            labels.push(age);
        }

        // Calculate earliest retirement age for starting point
        const earliestRetirementAge = Math.min(validated.retirementAgeA, validated.retirementAgeB, validated.retirementAgeC);
        
        // Single dataset showing withdrawals starting from earliest retirement age
        const data = labels.map(age => {
            if (age >= earliestRetirementAge) {
                const yearsFromStart = age - earliestRetirementAge;
                const withdrawal = validated.targetIncome * Math.pow(1 + validated.inflationRate/100, yearsFromStart);
                return withdrawal;
            }
            return null;
        });

        // Calculate max withdrawal for zoom limits
        const maxAge = 100;
        const maxYears = maxAge - earliestRetirementAge;
        const maxWithdrawal = validated.targetIncome * Math.pow(1 + validated.inflationRate/100, maxYears);

        const datasets = [{
            label: 'Annual Withdrawal (Inflation Adjusted)',
            data: data,
            borderColor: '#00FF41',
            backgroundColor: 'transparent',
            borderWidth: 3,
            pointRadius: 4,
            tension: 0.1,
            spanGaps: false
        }];

        // Destroy existing chart if it exists
        if (this.withdrawalsChart) {
            this.withdrawalsChart.destroy();
        }

        // Create new chart
        const ctx = document.getElementById('withdrawalsChart').getContext('2d');
        this.withdrawalsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0A0E1A',
                        borderColor: '#00FF41',
                        borderWidth: 1,
                        titleColor: '#00FF41',
                        bodyColor: '#00FF41',
                        font: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
                        },
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' + FinancialCalculations.formatCurrency(context.parsed.y);
                            }
                        }
                    },
                    zoom: {
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'xy',
                        },
                        pan: {
                            enabled: true,
                            mode: 'xy',
                        },
                        limits: {
                            x: {
                                min: Math.max(30, earliestRetirementAge - 5),
                                max: 105,
                                minRange: 10
                            },
                            y: {
                                min: -validated.targetIncome * 0.1, // Small negative buffer (10% of target income)
                                max: maxWithdrawal * 1.2, // 20% buffer above max
                                minRange: validated.targetIncome * 0.5 // Minimum range of 50% of target income
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        min: Math.max(30, earliestRetirementAge - 5),
                        max: 105,
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Age',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    y: {
                        min: -validated.targetIncome * 0.05, // 5% buffer below zero
                        max: maxWithdrawal * 1.1, // 10% buffer above max
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            },
                            callback: function(value) {
                                return '$' + FinancialCalculations.formatCurrency(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Annual Withdrawal',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    }
                }
            }
        });
    }

    updateNetWorthChart() {
        const validScenarios = this.scenarios.filter(s => s.valid);
        if (validScenarios.length === 0) return;

        const params = URLStateManager.collectParametersFromForm();
        const validated = URLStateManager.validateParameters(params);

        // Generate net worth data
        const datasets = validScenarios.map(scenario => {
            const progression = FinancialCalculations.generateNetWorthProgression(scenario, {
                startingAge: validated.startingAge,
                startingBalance: validated.startingBalance,
                annualReturn: validated.annualReturn / 100,
                inflationRate: validated.inflationRate / 100
            });

            const data = progression.map(p => ({
                x: p.age,
                y: p.netWorth
            }));

            return {
                label: `Scenario ${scenario.label} (Retire at ${scenario.retirementAge})`,
                data: data,
                borderColor: scenario.label === 'A' ? '#e74c3c' : scenario.label === 'B' ? '#f39c12' : '#27ae60',
                backgroundColor: 'transparent',
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 6,
                tension: 0.1
            };
        });

        // Destroy existing chart if it exists
        if (this.netWorthChart) {
            this.netWorthChart.destroy();
        }

        // Create new chart
        const ctx = document.getElementById('netWorthChart').getContext('2d');
        this.netWorthChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0A0E1A',
                        borderColor: '#00FF41',
                        borderWidth: 1,
                        titleColor: '#00FF41',
                        bodyColor: '#00FF41',
                        font: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
                        },
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' + FinancialCalculations.formatCurrency(context.parsed.y);
                            }
                        }
                    },
                    zoom: {
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'xy',
                        },
                        pan: {
                            enabled: true,
                            mode: 'xy',
                        },
                        limits: {
                            x: {
                                min: validated.startingAge - 5,
                                max: 105,
                                minRange: 10
                            },
                            y: {
                                min: -50000,
                                max: 'original',
                                minRange: 100000
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Age',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        },
                        min: validated.startingAge,
                        max: 100
                    },
                    y: {
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            },
                            callback: function(value) {
                                return '$' + FinancialCalculations.formatCurrency(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Net Worth',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    }
                }
            }
        });
    }

    async updateAll() {
        // Calculate basic scenarios first
        this.calculateScenarios();
        this.updateSummaryTable();
        
        // Run Monte Carlo simulation and financial modeling asynchronously
        await this.runMonteCarloAnalysis();
        await this.runFinancialModeling();
        
        // Generate insights after all data is available
        this.updateInsights();
        
        // Update all charts
        this.updateCharts();
    }

    // Export functions
    exportJSON() {
        const params = URLStateManager.collectParametersFromForm();
        const data = ExportUtility.exportComprehensiveData(
            this.scenarios,
            this.netWorthData,
            this.withdrawalData,
            this.insights,
            params,
            this.monteCarloResults,
            this.financialModelingResults
        );
        ExportUtility.exportJSON(data, `retirement_analysis_${new Date().toISOString().split('T')[0]}.json`);
    }

    exportCSV() {
        // Use enhanced multi-CSV export if available
        const exportData = {
            scenarios: this.scenarios,
            monteCarloResults: this.monteCarloResults,
            financialModelingResults: this.financialModelingResults,
            insights: this.insights
        };
        
        ExportUtility.exportMultipleCSVs(exportData);
    }

    async shareURL() {
        const params = URLStateManager.collectParametersFromForm();
        try {
            const result = await ExportUtility.copyShareableURL(params);
            if (result.success) {
                // Show temporary success message
                const button = document.getElementById('shareURL');
                const originalText = button.textContent;
                button.textContent = 'URL_COPIED!';
                button.style.backgroundColor = '#00FF41';
                button.style.color = '#000000';
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.backgroundColor = '';
                    button.style.color = '';
                }, 2000);
            }
        } catch (error) {
            console.error('Failed to copy URL:', error);
        }
    }

    // NEW METHODS FOR ENHANCED FUNCTIONALITY

    /**
     * Set up form validation with real-time feedback
     */
    setupFormValidation() {
        const inputs = document.querySelectorAll('[data-validation]');
        
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateInput(input));
            input.addEventListener('input', () => this.clearValidationError(input));
        });
    }

    /**
     * Validate individual input field
     */
    validateInput(input) {
        const validationType = input.dataset.validation;
        const value = input.value;
        const errorElement = input.parentElement.querySelector('.terminal-error');
        
        let isValid = true;
        let errorMessage = '';

        switch (validationType) {
            case 'currency':
                const numValue = FinancialCalculations.parseCurrency(value);
                const min = input.dataset.min ? parseFloat(input.dataset.min) : 0;
                const max = input.dataset.max ? parseFloat(input.dataset.max) : Infinity;
                
                if (numValue < min) {
                    isValid = false;
                    errorMessage = `VALUE_TOO_LOW (MIN: ${min.toLocaleString()})`;
                } else if (numValue > max) {
                    isValid = false;
                    errorMessage = `VALUE_TOO_HIGH (MAX: ${max.toLocaleString()})`;
                }
                break;
                
            case 'age':
                const age = parseInt(value);
                if (age < 18 || age > 100) {
                    isValid = false;
                    errorMessage = 'AGE_RANGE: 18-100';
                }
                break;
                
            case 'percentage':
                const pct = parseFloat(value);
                if (pct < 0 || pct > 50) {
                    isValid = false;
                    errorMessage = 'PERCENTAGE_RANGE: 0-50%';
                }
                break;
        }

        if (isValid) {
            input.classList.remove('border-red-400');
            errorElement.classList.add('hidden');
        } else {
            input.classList.add('border-red-400');
            errorElement.textContent = errorMessage;
            errorElement.classList.remove('hidden');
        }

        return isValid;
    }

    /**
     * Clear validation error for input
     */
    clearValidationError(input) {
        input.classList.remove('border-red-400');
        const errorElement = input.parentElement.querySelector('.terminal-error');
        errorElement.classList.add('hidden');
    }

    /**
     * Run Monte Carlo simulation analysis
     */
    async runMonteCarloAnalysis() {
        const params = this.collectEnhancedParameters();
        const validated = URLStateManager.validateParameters(params);

        const scenarioConfigs = [
            { retirementAge: validated.retirementAgeA },
            { retirementAge: validated.retirementAgeB },
            { retirementAge: validated.retirementAgeC }
        ];

        const assumptions = {
            startingAge: validated.startingAge,
            startingBalance: validated.startingBalance,
            targetIncome: validated.targetIncome,
            inflationRate: validated.inflationRate,
            accumulationReturn: validated.accumulationReturn || validated.annualReturn,
            retirementReturn: validated.retirementReturn || (validated.annualReturn * 0.7),
            volatility: validated.volatility || 15,
            monteCarloRuns: parseInt(validated.monteCarloRuns || 1000)
        };

        // Run Monte Carlo simulation
        try {
            this.monteCarloResults = await this.runMonteCarloSimulation(scenarioConfigs, assumptions);
        } catch (error) {
            console.error('Monte Carlo simulation failed:', error);
        }
    }

    /**
     * Run Monte Carlo simulation (wrapped for async execution)
     */
    async runMonteCarloSimulation(scenarios, assumptions) {
        return new Promise((resolve) => {
            // Use setTimeout to prevent UI blocking
            setTimeout(() => {
                const results = MonteCarloEngine.runSimulations(scenarios, {
                    inflationRate: assumptions.inflationRate / 100,
                    accumulationReturn: assumptions.accumulationReturn / 100,
                    retirementReturn: assumptions.retirementReturn / 100,
                    volatility: assumptions.volatility / 100,
                    monteCarloRuns: assumptions.monteCarloRuns
                });
                resolve(results);
            }, 10);
        });
    }

    /**
     * Run financial modeling analysis
     */
    async runFinancialModeling() {
        const params = this.collectEnhancedParameters();
        const validated = URLStateManager.validateParameters(params);

        const scenarioConfigs = [
            { label: 'A', retirementAge: validated.retirementAgeA },
            { label: 'B', retirementAge: validated.retirementAgeB },
            { label: 'C', retirementAge: validated.retirementAgeC }
        ];

        try {
            this.financialModelingResults = await this.runFinancialModelingAnalysis(scenarioConfigs, validated);
        } catch (error) {
            console.error('Financial modeling analysis failed:', error);
        }
    }

    /**
     * Run financial modeling analysis (wrapped for async execution)
     */
    async runFinancialModelingAnalysis(scenarios, assumptions) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const results = {
                    scenarios: [],
                    taxAnalysis: {},
                    socialSecurityOptimization: {},
                    healthcareProjections: {},
                    accountTypeOptimization: {}
                };

                scenarios.forEach((scenario, index) => {
                    // Calculate tax-adjusted withdrawals
                    const grossWithdrawal = assumptions.targetIncome;
                    const taxResult = FinancialModeling.calculateTaxAdjustedWithdrawal(
                        grossWithdrawal,
                        assumptions.accountType,
                        assumptions.state,
                        scenario.retirementAge,
                        assumptions.filingStatus || 'Single'
                    );

                    // Social Security optimization
                    const ssOptimization = FinancialModeling.optimizeSocialSecurity(
                        assumptions.startingAge,
                        scenario.retirementAge,
                        assumptions.socialSecurityBenefit,
                        assumptions.lifeExpectancy || 85
                    );

                    // Healthcare cost projections
                    const healthcareProjection = FinancialModeling.calculateHealthcareCosts(
                        scenario.retirementAge,
                        null, // Use age-based default
                        assumptions.healthcareMultiplier,
                        (assumptions.healthcareInflation || 5) / 100,
                        (assumptions.lifeExpectancy || 85) - scenario.retirementAge
                    );

                    results.scenarios.push({
                        scenario: scenario.label,
                        retirementAge: scenario.retirementAge,
                        grossWithdrawal: grossWithdrawal,
                        netWithdrawal: taxResult.netIncome,
                        taxAnalysis: taxResult,
                        socialSecurityBenefit: ssOptimization.optimal.monthlyBenefit * 12,
                        socialSecurityOptimization: ssOptimization,
                        healthcareCosts: healthcareProjection.averageAnnualCost,
                        healthcareProjection: healthcareProjection,
                        effectiveTaxRate: taxResult.effectiveRate
                    });
                });

                // Generate account type optimization
                results.accountTypeOptimization = FinancialModeling.determineOptimalAccountType(
                    assumptions.currentIncome,
                    assumptions.retirementTaxRate / 100,
                    assumptions.currentTaxRate / 100,
                    Math.min(
                        assumptions.retirementAgeA - assumptions.startingAge,
                        assumptions.retirementAgeB - assumptions.startingAge,
                        assumptions.retirementAgeC - assumptions.startingAge
                    )
                );

                resolve(results);
            }, 10);
        });
    }

    /**
     * Collect enhanced parameters including new fields
     */
    collectEnhancedParameters() {
        const basic = URLStateManager.collectParametersFromForm();
        
        // Add new fields
        const enhanced = {
            ...basic,
            currentIncome: this.getInputValue('currentIncome', 'currency'),
            accumulationReturn: this.getInputValue('accumulationReturn', 'number') || basic.annualReturn,
            retirementReturn: this.getInputValue('retirementReturn', 'number') || (basic.annualReturn * 0.7),
            volatility: this.getInputValue('volatility', 'number') || 15,
            monteCarloRuns: this.getInputValue('monteCarloRuns', 'number') || 1000,
            accountType: this.getSelectValue('accountType') || 'Traditional 401k/IRA',
            state: this.getSelectValue('state') || 'California',
            socialSecurityAge: this.getInputValue('socialSecurityAge', 'number') || 67,
            socialSecurityBenefit: this.getInputValue('socialSecurityBenefit', 'currency') || 2000,
            healthcareMultiplier: parseFloat(this.getSelectValue('healthcareMultiplier')) || 1.0
        };

        return enhanced;
    }

    /**
     * Helper to get input value with type conversion
     */
    getInputValue(id, type = 'number') {
        const element = document.getElementById(id);
        if (!element) return null;
        
        switch (type) {
            case 'currency':
                return FinancialCalculations.parseCurrency(element.value);
            case 'number':
                return parseFloat(element.value) || 0;
            default:
                return element.value;
        }
    }

    /**
     * Helper to get select value
     */
    getSelectValue(id) {
        const element = document.getElementById(id);
        return element ? element.value : null;
    }

    /**
     * Update Monte Carlo success probability chart
     */
    updateSuccessProbabilityChart() {
        if (!this.monteCarloResults) return;

        const ctx = document.getElementById('successProbabilityChart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.successProbabilityChart) {
            this.successProbabilityChart.destroy();
        }

        const config = ChartConfigs.createMonteCarloSuccessChart(this.monteCarloResults);
        this.successProbabilityChart = new Chart(ctx, config);
    }

    /**
     * Update portfolio distribution chart
     */
    updatePortfolioDistributionChart() {
        if (!this.monteCarloResults) return;

        const ctx = document.getElementById('portfolioDistributionChart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.portfolioDistributionChart) {
            this.portfolioDistributionChart.destroy();
        }

        const config = ChartConfigs.createPortfolioDistributionChart(this.monteCarloResults);
        this.portfolioDistributionChart = new Chart(ctx, config);
    }

    /**
     * Enhanced net worth chart with confidence bands
     */
    updateNetWorthChart() {
        const validScenarios = this.scenarios.filter(s => s.valid);
        if (validScenarios.length === 0) return;

        const params = URLStateManager.collectParametersFromForm();
        const validated = URLStateManager.validateParameters(params);

        // Generate basic net worth data
        const datasets = validScenarios.map(scenario => {
            const progression = FinancialCalculations.generateNetWorthProgression(scenario, {
                startingAge: validated.startingAge,
                startingBalance: validated.startingBalance,
                annualReturn: validated.annualReturn / 100,
                inflationRate: validated.inflationRate / 100
            });

            const data = progression.map(p => ({
                x: p.age,
                y: p.netWorth
            }));

            return {
                label: `Scenario ${scenario.label} (Retire at ${scenario.retirementAge})`,
                data: data,
                borderColor: scenario.label === 'A' ? '#e74c3c' : scenario.label === 'B' ? '#f39c12' : '#27ae60',
                backgroundColor: 'transparent',
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 6,
                tension: 0.1
            };
        });

        // Basic chart configuration
        const basicConfig = {
            type: 'line',
            data: { datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0A0E1A',
                        borderColor: '#00FF41',
                        borderWidth: 1,
                        titleColor: '#00FF41',
                        bodyColor: '#00FF41',
                        font: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
                        },
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' + FinancialCalculations.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Age',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        },
                        min: validated.startingAge,
                        max: 100
                    },
                    y: {
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            },
                            callback: function(value) {
                                return '$' + FinancialCalculations.formatCurrency(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Net Worth',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    }
                }
            }
        };

        // Enhance with confidence bands if Monte Carlo data is available
        let enhancedConfig = basicConfig;
        if (this.monteCarloResults) {
            enhancedConfig = ChartConfigs.enhanceNetWorthChart(basicConfig, this.monteCarloResults);
        }

        // Destroy existing chart
        if (this.netWorthChart) {
            this.netWorthChart.destroy();
        }

        // Create new chart
        const ctx = document.getElementById('netWorthChart').getContext('2d');
        this.netWorthChart = new Chart(ctx, enhancedConfig);
    }
}

// Global functions for UI interactions
function toggleAssumptions() {
    const section = document.getElementById('assumptionsSection');
    const toggle = document.getElementById('assumptionsToggle');
    
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        toggle.textContent = '[COLLAPSE]';
    } else {
        section.classList.add('hidden');
        toggle.textContent = '[EXPAND]';
    }
}

// Initialize calculator when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Register Chart.js zoom plugin if available
    if (typeof Chart !== 'undefined' && typeof ChartZoom !== 'undefined') {
        Chart.register(ChartZoom);
    }
    
    // Initialize calculator
    new RetirementCalculator();
});