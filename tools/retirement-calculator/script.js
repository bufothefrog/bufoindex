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
    
    // Helper function for currency formatting (fallback if FinancialCalculations not loaded)
    formatCurrency(amount) {
        if (typeof FinancialCalculations !== 'undefined' && FinancialCalculations.formatCurrency) {
            return FinancialCalculations.formatCurrency(amount);
        }
        // Fallback formatting
        return Math.round(amount).toLocaleString();
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
        document.getElementById('exportPDF')?.addEventListener('click', () => this.exportPDF());
        document.getElementById('shareURL')?.addEventListener('click', () => this.shareURL());
        
        // Form validation listeners
        this.setupFormValidation();
    }

    calculateScenarios() {
        try {
            const params = this.collectEnhancedParameters();
            console.log('Enhanced parameters:', params);
            
            // Check if FinancialCalculations is available
            if (typeof FinancialCalculations === 'undefined') {
                throw new Error('FinancialCalculations not loaded');
            }
            
            // Calculate retirement readiness using new method
            const readinessAnalysis = FinancialCalculations.calculateRetirementReadiness({
                currentAge: params.startingAge,
                targetRetirementAge: params.targetRetirementAge,
                targetIncome: params.targetIncome,
                currentIncome: params.currentIncome,
                currentSavingsRate: params.currentSavingsRate / 100, // Convert to decimal
                startingBalance: params.startingBalance,
                state: params.state,
                riskProfile: params.riskProfile,
                inflationRate: params.inflationRate / 100
            });

            console.log('Readiness analysis:', readinessAnalysis);

            // Store target goal assessment
            this.targetGoalAssessment = readinessAnalysis.targetGoal;
            console.log('Target goal assessment:', this.targetGoalAssessment);
            
            // Convert scenarios to format expected by rest of app
            this.scenarios = readinessAnalysis.scenarios.map((scenario, index) => {
                const colors = ['#e74c3c', '#f39c12', '#27ae60'];
                const yearsUntilRetirement = Math.max(0, scenario.achievableRetirementAge - params.startingAge);
                return {
                    label: scenario.label,
                    savingsRate: scenario.savingsRate,
                    retirementAge: scenario.achievableRetirementAge,
                    yearsUntilRetirement: yearsUntilRetirement,
                    monthlyContribution: scenario.monthlyContribution,
                    realismScore: scenario.realismScore,
                    realismRating: scenario.realismRating,
                    confidenceLevel: scenario.confidenceLevel,
                    valid: scenario.valid,
                    color: colors[index] || '#888888',
                    // Calculate additional fields for compatibility
                    inflatedTargetIncome: params.targetIncome * Math.pow(1 + params.inflationRate/100, yearsUntilRetirement),
                    targetPortfolioSize: (params.targetIncome * Math.pow(1 + params.inflationRate/100, yearsUntilRetirement)) / 0.04
                };
            });

            console.log('Generated scenarios:', this.scenarios);
            return this.scenarios;
        } catch (error) {
            console.error('Error in calculateScenarios:', error);
            // Return empty scenarios if calculation fails
            this.scenarios = [];
            this.targetGoalAssessment = null;
            return this.scenarios;
        }
    }

    updateSummaryTable() {
        const tbody = document.getElementById('summaryTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.scenarios.map(scenario => {
            if (!scenario.valid) {
                return `
                    <tr class="text-terminal-green opacity-50">
                        <td class="py-2 px-3">SCENARIO_${scenario.label}</td>
                        <td class="py-2 px-3">${Math.round(scenario.savingsRate * 100)}%</td>
                        <td class="py-2 px-3" colspan="4">INVALID: Unable to retire with this savings rate</td>
                    </tr>
                `;
            }

            // Add realism color coding
            const realismClass = this.getRealismColorClass(scenario.realismRating);
            const confidenceMeter = this.generateConfidenceMeter(scenario.confidenceLevel);
            
            // Show Monte Carlo success rate if available
            const successProb = scenario.monteCarloSuccessRate ? 
                `${Math.round(scenario.monteCarloSuccessRate * 100)}%` : 
                'Calculating...';

            return `
                <tr class="text-terminal-green">
                    <td class="py-2 px-3">SCENARIO_${scenario.label}</td>
                    <td class="py-2 px-3">${Math.round(scenario.savingsRate * 100)}%</td>
                    <td class="py-2 px-3">${scenario.retirementAge}</td>
                    <td class="py-2 px-3 ${realismClass}">
                        <div class="flex items-center gap-2">
                            <span>${scenario.realismRating}</span>
                            ${confidenceMeter}
                        </div>
                    </td>
                    <td class="py-2 px-3">${successProb}</td>
                    <td class="py-2 px-3">${this.formatCurrency(scenario.monthlyContribution)}</td>
                </tr>
            `;
        }).join('');
    }

    getRealismColorClass(rating) {
        switch (rating) {
            case 'Highly Realistic': return 'text-green-400';
            case 'Challenging but Achievable': return 'text-yellow-400';
            case 'Unlikely': return 'text-orange-400';
            case 'Unrealistic': return 'text-red-400';
            default: return 'text-terminal-green';
        }
    }

    generateConfidenceMeter(confidenceLevel) {
        const width = Math.max(10, confidenceLevel); // Minimum 10% width for visibility
        const color = confidenceLevel >= 80 ? '#00FF41' : 
                      confidenceLevel >= 60 ? '#FFB86C' : 
                      confidenceLevel >= 40 ? '#FF8C42' : '#FF6B6B';
        
        return `
            <div class="inline-flex items-center gap-1">
                <div class="w-16 h-2 bg-gray-800 border border-terminal-green">
                    <div class="h-full" style="width: ${width}%; background-color: ${color};"></div>
                </div>
                <span class="text-xs">${confidenceLevel}%</span>
            </div>
        `;
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
                text: `Retiring ${timeDifference} years earlier requires ${contributionRatio}% higher monthly contributions (${this.formatCurrency(contributionDifference)} more per month).`
            });
        }

        insights.push({
            title: 'SAVINGS_RATE',
            value: `${Math.round(earliest.monthlyContribution / (validated.targetIncome/12) * 100)}%`,
            text: `Early retirement (Scenario ${earliest.label}) requires saving ${Math.round(earliest.monthlyContribution / (validated.targetIncome/12) * 100)}% of your target monthly retirement income every month during your working years.`
        });

        this.insights = insights;
        return insights;
    }

    generateNewStyleInsights() {
        if (!this.targetGoalAssessment || !this.scenarios) {
            console.warn('Missing data for new style insights:', {
                targetGoalAssessment: !!this.targetGoalAssessment,
                scenarios: !!this.scenarios
            });
            return [];
        }

        try {
            const insights = [];
            const params = this.collectEnhancedParameters();

            // Target Goal Assessment
            const targetRating = this.targetGoalAssessment.realismAssessment.rating;
            const requiredRate = Math.round(this.targetGoalAssessment.requiredSavingsRate * 100);
            const currentRate = Math.round(params.currentSavingsRate);

            insights.push({
                title: 'RETIREMENT_GOAL_ASSESSMENT',
                value: targetRating,
                text: `Your goal to retire at ${params.targetRetirementAge} with $${this.formatCurrency(params.targetIncome)} is rated as "${targetRating}". You would need to save ${requiredRate}% of income vs your current ${currentRate}%.`
            });

            // Savings Rate Impact
            const currentScenario = this.scenarios.find(s => s.label === 'Current');
            const aggressiveScenario = this.scenarios.find(s => s.label === 'Aggressive');
            
            if (currentScenario && aggressiveScenario && currentScenario.valid && aggressiveScenario.valid) {
                const yearsSaved = currentScenario.retirementAge - aggressiveScenario.retirementAge;
                insights.push({
                    title: 'SAVINGS_RATE_IMPACT',
                    value: `${yearsSaved} years`,
                    text: `Increasing your savings rate by 20% (from ${Math.round(currentScenario.savingsRate*100)}% to ${Math.round(aggressiveScenario.savingsRate*100)}%) allows you to retire ${yearsSaved} years earlier.`
                });
            }

            // Cost of Living Impact
            const colTier = window.SavingsFeasibility.getStateCOLTier(params.state);
            const colNames = ['', 'Very High', 'High', 'Moderate', 'Low'];
            const maxSavings = Math.round(window.SavingsFeasibility.calculateMaxRealisticSavings(params.currentIncome, params.state) * 100);
            
            insights.push({
                title: 'LOCATION_IMPACT',
                value: `${maxSavings}% max`,
                text: `Living in ${params.state} (${colNames[colTier]} cost of living) limits realistic savings to approximately ${maxSavings}% of income at your income level.`
            });

            // Risk Profile Impact
            const riskData = window.SavingsFeasibility.getRiskProfile(params.riskProfile);
            insights.push({
                title: 'RISK_PROFILE',
                value: riskData.name,
                text: `Your ${riskData.name} investment approach assumes ${Math.round(riskData.accumulation.return*100)}% returns during accumulation and ${Math.round(riskData.retirement.return*100)}% during retirement.`
            });

            // Action Items
            if (!this.targetGoalAssessment.isRealistic) {
                const minRequiredRate = Math.round(this.targetGoalAssessment.requiredSavingsRate * 100);
                insights.push({
                    title: 'ACTION_REQUIRED',
                    value: `${minRequiredRate}% needed`,
                    text: `To achieve your goal, consider: 1) Increase savings rate to ${minRequiredRate}%, 2) Retire later, 3) Reduce target income, or 4) Move to lower cost area.`
                });
            }

            return insights;
        } catch (error) {
            console.error('Error generating new style insights:', error);
            return this.generateInsights(); // Fallback to old insights
        }
    }

    updateInsights() {
        const insightsContainer = document.getElementById('insightsContent');
        if (!insightsContainer) return;

        // Use new savings-focused insights if we have the new data structure
        const insights = this.targetGoalAssessment ? this.generateNewStyleInsights() : this.generateInsights();

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
        const params = this.collectEnhancedParameters();

        // Generate withdrawal data
        const labels = [];
        const endAge = params.endAge || 85;
        for (let age = params.startingAge; age <= endAge; age += 5) {
            labels.push(age);
        }
        // Ensure we include the endAge if it's not divisible by 5
        if (endAge % 5 !== 0 && labels[labels.length - 1] < endAge) {
            labels.push(endAge);
        }

        // Calculate earliest retirement age for starting point from our scenarios
        const validScenarios = this.scenarios.filter(s => s.valid);
        if (validScenarios.length === 0) return;
        
        const earliestRetirementAge = Math.min(...validScenarios.map(s => s.retirementAge));
        
        // Single dataset showing withdrawals starting from earliest retirement age
        const data = labels.map(age => {
            if (age >= earliestRetirementAge) {
                const yearsFromStart = age - earliestRetirementAge;
                const withdrawal = params.targetIncome * Math.pow(1 + params.inflationRate/100, yearsFromStart);
                return withdrawal;
            }
            return null;
        });

        // Calculate max withdrawal for zoom limits
        const maxAge = endAge;
        const maxYears = maxAge - earliestRetirementAge;
        const maxWithdrawal = params.targetIncome * Math.pow(1 + params.inflationRate/100, maxYears);

        const datasets = [{
            label: 'Retirement Withdrawals (Inflation Adjusted)',
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
                                return context.dataset.label + ': $' + (Math.round(context.parsed.y).toLocaleString());
                            }
                        }
                    },
                },
                scales: {
                    x: {
                        min: earliestRetirementAge,
                        max: endAge,
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
                        min: -params.targetIncome * 0.0475, // 4.75% buffer below zero (5% reduced by 5%)
                        max: maxWithdrawal * 1.045, // 4.5% buffer above max (10% reduced by 5%)
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
                                return '$' + (Math.round(value).toLocaleString());
                            }
                        },
                        title: {
                            display: true,
                            text: 'Retirement Withdrawals',
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

        const params = this.collectEnhancedParameters();

        // Generate net worth data using enhanced parameters
        const datasets = validScenarios.map(scenario => {
            // Create a compatible scenario object for the progression calculation
            const compatibleScenario = {
                retirementAge: scenario.retirementAge,
                targetPortfolioSize: scenario.targetPortfolioSize,
                inflatedTargetIncome: scenario.inflatedTargetIncome,
                annualContribution: scenario.monthlyContribution * 12
            };

            const progression = FinancialCalculations.generateNetWorthProgression(compatibleScenario, {
                startingAge: params.startingAge,
                startingBalance: params.startingBalance,
                annualReturn: params.accumulationReturn / 100,
                inflationRate: params.inflationRate / 100
            });

            const data = progression.map(p => ({
                x: p.age,
                y: p.netWorth
            }));

            return {
                label: `${scenario.label} (${Math.round(scenario.savingsRate*100)}% → Retire at ${scenario.retirementAge})`,
                data: data,
                borderColor: scenario.color,
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
                                return context.dataset.label + ': $' + (Math.round(context.parsed.y).toLocaleString());
                            }
                        }
                    },
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
                        min: params.startingAge,
                        max: params.endAge || 85
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
                                return '$' + (Math.round(value).toLocaleString());
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
        this.updateTargetGoalAssessment();
        this.updateSummaryTable();
        
        // Run Monte Carlo simulation and financial modeling asynchronously
        await this.runMonteCarloAnalysis();
        await this.runFinancialModeling();
        
        // Update table again with Monte Carlo results
        this.updateSummaryTable();
        
        // Generate insights after all data is available
        this.updateInsights();
        
        // Update all charts
        this.updateCharts();
    }

    updateTargetGoalAssessment() {
        const container = document.getElementById('targetGoalContent');
        if (!container) {
            console.warn('Target goal container not found');
            return;
        }
        
        if (!this.targetGoalAssessment) {
            console.warn('Target goal assessment not available');
            container.innerHTML = `
                <div class="text-terminal-green opacity-75 text-center py-4">
                    CALCULATING RETIREMENT GOAL ASSESSMENT...
                </div>
            `;
            return;
        }

        try {
            const params = this.collectEnhancedParameters();
            const assessment = this.targetGoalAssessment;
            const realismClass = this.getRealismColorClass(assessment.realismAssessment.rating);
            const requiredRate = Math.round(assessment.requiredSavingsRate * 100);
            const currentRate = Math.round(params.currentSavingsRate);
            const rateDifference = requiredRate - currentRate;
            
            // Generate confidence meter for overall assessment
            const confidenceMeter = this.generateConfidenceMeter(Math.round(assessment.realismAssessment.score));
            
            // Generate actionable recommendations
            let recommendations = [];
            if (!assessment.isRealistic) {
                if (rateDifference <= 10) {
                    recommendations.push(`Increase savings rate by ${rateDifference}% (achievable with discipline)`);
                } else {
                    recommendations.push(`Consider retiring ${Math.ceil(rateDifference / 5)} years later`);
                    recommendations.push(`Reduce target income to $${this.formatCurrency(Math.round(params.targetIncome * 0.8))}`);
                }
                
                const colTier = window.SavingsFeasibility.getStateCOLTier(params.state);
                if (colTier <= 2) {
                    recommendations.push('Consider moving to a lower cost of living area');
                }
            } else {
                recommendations.push('Your retirement goal appears achievable with your current plan');
                recommendations.push('Consider the scenarios below to potentially retire earlier');
            }

            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 class="text-terminal-green font-bold mb-3">YOUR RETIREMENT GOAL</h4>
                        <div class="space-y-2 text-sm">
                            <div><span class="opacity-75">Target Retirement Age:</span> ${params.targetRetirementAge} years old</div>
                            <div><span class="opacity-75">Target Annual Income:</span> $${this.formatCurrency(params.targetIncome)}</div>
                            <div><span class="opacity-75">Current Savings Rate:</span> ${currentRate}%</div>
                            <div><span class="opacity-75">Required Savings Rate:</span> <span class="${rateDifference > 0 ? 'text-orange-400' : 'text-green-400'}">${requiredRate}%</span></div>
                        </div>
                    </div>
                    
                    <div>
                        <h4 class="text-terminal-green font-bold mb-3">ASSESSMENT</h4>
                        <div class="space-y-3">
                            <div class="flex items-center gap-3">
                                <span class="${realismClass} font-bold">${assessment.realismAssessment.rating}</span>
                                ${confidenceMeter}
                            </div>
                            
                            <div class="text-sm space-y-1">
                                ${recommendations.map(rec => `<div class="opacity-90">• ${rec}</div>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error updating target goal assessment:', error);
            container.innerHTML = `
                <div class="text-red-400 text-center py-4">
                    ERROR: Unable to generate retirement goal assessment
                </div>
            `;
        }
    }

    // Export functions
    exportPDF() {
        // Use browser's print functionality to save as PDF
        window.print();
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

        // Generate scenario configs from our savings rate scenarios
        const scenarioConfigs = this.scenarios.filter(s => s.valid).map(scenario => ({
            retirementAge: scenario.retirementAge,
            label: scenario.label,
            savingsRate: scenario.savingsRate
        }));

        if (scenarioConfigs.length === 0) {
            console.warn('No valid scenarios for Monte Carlo analysis');
            return;
        }

        const assumptions = {
            startingAge: params.startingAge,
            startingBalance: params.startingBalance,
            targetIncome: params.targetIncome,
            inflationRate: params.inflationRate,
            accumulationReturn: params.accumulationReturn,
            retirementReturn: params.retirementReturn,
            volatility: params.volatility,
            monteCarloRuns: parseInt(params.monteCarloRuns || 1000)
        };

        // Run Monte Carlo simulation
        try {
            this.monteCarloResults = await this.runMonteCarloSimulation(scenarioConfigs, assumptions);
            
            // Update scenarios with Monte Carlo success rates
            if (this.monteCarloResults && this.monteCarloResults.scenarios) {
                this.monteCarloResults.scenarios.forEach((mcResult, index) => {
                    if (this.scenarios[index]) {
                        this.scenarios[index].monteCarloSuccessRate = mcResult.successRate;
                        this.scenarios[index].portfolioStats = mcResult.portfolioAtRetirement;
                    }
                });
            }
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
        try {
            // Try to get basic parameters from URL state manager
            let basic = {};
            try {
                basic = URLStateManager.collectParametersFromForm() || {};
            } catch (error) {
                console.warn('URLStateManager failed, using direct form access:', error);
                basic = {};
            }
            
            // Collect parameters directly from form elements with fallbacks
            const enhanced = {
                // NEW: Primary parameters
                startingAge: this.getInputValue('startingAge', 'number'),
                targetRetirementAge: this.getInputValue('targetRetirementAge', 'number'),
                currentSavingsRate: this.getInputValue('currentSavingsRate', 'number'),
                targetIncome: this.getInputValue('targetIncome', 'currency'),
                startingBalance: this.getInputValue('startingBalance', 'currency'),
                currentIncome: this.getInputValue('currentIncome', 'currency'),
                state: this.getSelectValue('state'),
                riskProfile: this.getSelectValue('riskProfile'),
                inflationRate: this.getInputValue('inflationRate', 'number'),
                endAge: this.getInputValue('endAge', 'number'),
                
                // Merge any successfully collected basic parameters
                ...basic,
                
                // Legacy compatibility
                monteCarloRuns: this.getInputValue('monteCarloRuns', 'number') || 1000,
                accountType: this.getSelectValue('accountType'),
                socialSecurityAge: this.getInputValue('socialSecurityAge', 'number') || 67,
                socialSecurityBenefit: this.getInputValue('socialSecurityBenefit', 'currency') || 2000,
                healthcareMultiplier: parseFloat(this.getSelectValue('healthcareMultiplier')) || 1.0
            };

            // Get risk profile returns
            if (typeof SavingsFeasibility !== 'undefined') {
                try {
                    const riskData = SavingsFeasibility.getRiskProfile(enhanced.riskProfile);
                    enhanced.accumulationReturn = riskData.accumulation.return * 100; // Convert to percentage
                    enhanced.retirementReturn = riskData.retirement.return * 100;
                    enhanced.volatility = riskData.accumulation.volatility * 100;
                } catch (error) {
                    console.warn('Error getting risk profile, using defaults:', error);
                    enhanced.accumulationReturn = 8;
                    enhanced.retirementReturn = 6;
                    enhanced.volatility = 12;
                }
            } else {
                console.warn('SavingsFeasibility not loaded, using default returns');
                enhanced.accumulationReturn = 8;
                enhanced.retirementReturn = 6;
                enhanced.volatility = 12;
            }

            console.log('Collected enhanced parameters:', enhanced);
            return enhanced;
        } catch (error) {
            console.error('Error collecting enhanced parameters:', error);
            // Return safe defaults
            return {
                startingAge: 25,
                targetRetirementAge: 45,
                currentSavingsRate: 15,
                targetIncome: 120000,
                startingBalance: 100000,
                currentIncome: 80000,
                state: 'TX',
                riskProfile: 'moderate',
                inflationRate: 3,
                endAge: 85,
                accumulationReturn: 8,
                retirementReturn: 6,
                volatility: 12,
                monteCarloRuns: 1000,
                accountType: 'Taxable'
            };
        }
    }

    /**
     * Helper to get input value with type conversion
     */
    getInputValue(id, type = 'number') {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with id '${id}' not found`);
            // Return default values for missing elements
            const defaults = {
                'targetRetirementAge': 45,
                'currentSavingsRate': 15,
                'currentIncome': 80000,
                'targetIncome': 120000,
                'startingBalance': 100000,
                'startingAge': 25,
                'inflationRate': 3,
                'endAge': 85
            };
            const defaultValue = defaults[id] || 0;
            
            if (type === 'currency') {
                return defaultValue;
            } else if (type === 'number') {
                return defaultValue;
            } else {
                return defaultValue.toString();
            }
        }
        
        switch (type) {
            case 'currency':
                // Use built-in currency parsing instead of FinancialCalculations
                if (typeof element.value === 'string') {
                    return parseFloat(element.value.replace(/[$,]/g, '')) || 0;
                }
                return parseFloat(element.value) || 0;
            case 'number':
                return parseFloat(element.value) || 0;
            default:
                return element.value || '';
        }
    }

    /**
     * Helper to get select value
     */
    getSelectValue(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Select element with id '${id}' not found`);
            // Return default values for missing selects
            const defaults = {
                'state': 'TX',
                'riskProfile': 'moderate',
                'accountType': 'Taxable'
            };
            return defaults[id] || '';
        }
        return element.value || '';
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
                annualReturn: validated.accumulationReturn / 100,
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
                                return context.dataset.label + ': $' + (Math.round(context.parsed.y).toLocaleString());
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
                        max: validated.endAge
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
                                return '$' + (Math.round(value).toLocaleString());
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
    // Wait for all dependencies to load
    const checkDependencies = () => {
        if (typeof FinancialCalculations === 'undefined' || 
            typeof SavingsFeasibility === 'undefined' || 
            typeof URLStateManager === 'undefined') {
            console.log('Waiting for dependencies to load...');
            setTimeout(checkDependencies, 100);
            return;
        }
        
        console.log('All dependencies loaded, initializing calculator');
        
        // Register Chart.js zoom plugin if available
        if (typeof Chart !== 'undefined' && typeof ChartZoom !== 'undefined') {
            Chart.register(ChartZoom);
        }
        
        // Initialize calculator
        new RetirementCalculator();
    };
    
    checkDependencies();
});