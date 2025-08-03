/**
 * Retirement Calculator Main Script
 * Orchestrates the terminal-style retirement planning calculator
 */

class RetirementCalculator {
    constructor() {
        this.scenarios = [];
        this.insights = [];
        this.netWorthData = [];
        this.withdrawalData = [];
        this.withdrawalsChart = null;
        this.netWorthChart = null;
        
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
        const inputs = document.querySelectorAll('.retirement-calculator input');
        inputs.forEach(input => {
            if (input.id === 'targetIncome' || input.id === 'startingBalance') {
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
    }

    updateWithdrawalsChart() {
        const validScenarios = this.scenarios.filter(s => s.valid);
        if (validScenarios.length === 0) return;

        const params = URLStateManager.collectParametersFromForm();
        const validated = URLStateManager.validateParameters(params);

        // Generate withdrawal data
        const labels = [];
        for (let age = 35; age <= 100; age += 5) {
            labels.push(age);
        }

        const datasets = validScenarios.map(scenario => {
            const data = labels.map(age => {
                if (age >= scenario.retirementAge) {
                    const yearsFromRetirement = age - scenario.retirementAge;
                    const withdrawal = scenario.inflatedTargetIncome * Math.pow(1 + validated.inflationRate/100, yearsFromRetirement);
                    return withdrawal;
                }
                return null;
            });

            return {
                label: `Scenario ${scenario.label} (Retire at ${scenario.retirementAge})`,
                data: data,
                borderColor: scenario.label === 'A' ? '#e74c3c' : scenario.label === 'B' ? '#f39c12' : '#27ae60',
                backgroundColor: 'transparent',
                borderWidth: 3,
                pointRadius: 4,
                tension: 0.1,
                spanGaps: false
            };
        });

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
                                min: 30,
                                max: 105,
                                minRange: 10
                            },
                            y: {
                                min: 0,
                                max: 'original',
                                minRange: 50000
                            }
                        }
                    }
                },
                scales: {
                    x: {
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

    updateAll() {
        this.calculateScenarios();
        this.updateSummaryTable();
        this.updateInsights();
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
            params
        );
        ExportUtility.exportJSON(data);
    }

    exportCSV() {
        ExportUtility.exportCSV(this.scenarios);
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
}

// Initialize calculator when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Register Chart.js zoom plugin if available
    if (typeof Chart !== 'undefined' && typeof ChartZoom !== 'undefined') {
        Chart.register(ChartZoom);
    }
    
    new RetirementCalculator();
});