/**
 * Modern Chart Configuration Helper
 * Provides modern-themed chart configurations for all visualizations
 */

class ChartThemes {
    /**
     * Get modern chart configuration
     */
    static getBaseConfig() {
        const colors = ThemeConfig.getChartColors();
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: colors.text,
                        font: {
                            family: ThemeConfig.fonts.primary,
                            size: 12
                        },
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: colors.background + 'F0', // 94% opacity
                    borderColor: colors.primary,
                    borderWidth: 1,
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    cornerRadius: 8,
                    titleFont: {
                        family: ThemeConfig.fonts.primary,
                        weight: '600',
                        size: 13
                    },
                    bodyFont: {
                        family: ThemeConfig.fonts.primary,
                        size: 12
                    },
                    padding: 12,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: colors.text,
                        font: {
                            family: ThemeConfig.fonts.primary,
                            size: 11
                        }
                    },
                    grid: {
                        color: colors.grid + '30',
                        borderColor: colors.grid,
                        lineWidth: 1,
                        drawTicks: true
                    },
                    border: {
                        color: colors.grid
                    }
                },
                y: {
                    ticks: {
                        color: colors.text,
                        font: {
                            family: ThemeConfig.fonts.primary,
                            size: 11
                        }
                    },
                    grid: {
                        color: colors.grid + '30',
                        borderColor: colors.grid,
                        lineWidth: 1,
                        drawTicks: true
                    },
                    border: {
                        color: colors.grid
                    }
                }
            }
        };
    }

    /**
     * Get color palette for charts
     */
    static getColorPalette() {
        const colors = ThemeConfig.getChartColors();
        
        return [
            colors.primary,
            colors.secondary,
            colors.accent,
            colors.success,
            colors.warning,
            colors.error
        ];
    }

    /**
     * Create Monte Carlo success probability bar chart configuration
     */
    static createMonteCarloSuccessChart(data) {
        const { scenarios } = data;
        
        if (!scenarios || scenarios.length === 0) {
            return this.createEmptyChartConfig('No Monte Carlo data available');
        }

        const baseConfig = this.getBaseConfig();
        const colors = this.getColorPalette();
        const chartColors = ThemeConfig.getChartColors();
        
        const labels = scenarios.map((s, index) => {
            const labelText = s.label || s.scenario || (index + 1);
            return `${labelText}`;
        });
        const successRates = scenarios.map(s => s.successRate * 100);
        const scenarioColors = scenarios.map((s, index) => colors[index % colors.length]);

        return {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'SUCCESS_PROBABILITY',
                    data: successRates,
                    backgroundColor: scenarioColors,
                    borderColor: scenarioColors,
                    borderWidth: 2,
                    barThickness: 60
                }]
            },
            options: {
                ...baseConfig,
                plugins: {
                    ...baseConfig.plugins,
                    legend: {
                        display: false
                    }
                },
                scales: {
                    ...baseConfig.scales,
                    y: {
                        ...baseConfig.scales.y,
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            ...baseConfig.scales.y.ticks,
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        };
    }

    /**
     * Create net worth progression line chart configuration
     */
    static createNetWorthChart(data) {
        if (!data || !data.scenarios || data.scenarios.length === 0) {
            return this.createEmptyChartConfig('No net worth data available');
        }

        const baseConfig = this.getBaseConfig();
        const colors = this.getColorPalette();
        const chartColors = ThemeConfig.getChartColors();

        // Use specific scenario colors for consistency
        const scenarioColors = ['#27ae60', '#f39c12', '#e74c3c']; // Green, Orange, Red

        // Extract years from first scenario
        const years = data.scenarios[0].projections.map(p => p.age);
        
        const datasets = data.scenarios.map((scenario, index) => {
            // Use scenario label or fall back to scenario number
            const labelText = scenario.label || scenario.scenario || (index + 1);
            const scenarioLabel = `${labelText}`;
            const color = scenarioColors[index] || colors[index % colors.length]; // Use scenario colors first
            
            // Create point styling to show dots only at retirement age for this scenario
            const retirementAge = scenario.retirementAge || data.targetRetirementAge;
            
            // Find the closest age in our data to the retirement age
            const closestAgeIndex = years.reduce((closestIndex, currentAge, index) => {
                const currentDiff = Math.abs(currentAge - retirementAge);
                const closestDiff = Math.abs(years[closestIndex] - retirementAge);
                return currentDiff < closestDiff ? index : closestIndex;
            }, 0);
            
            const pointRadii = years.map((age, index) => index === closestAgeIndex ? 4 : 0);
            const pointBackgroundColors = years.map((age, index) => index === closestAgeIndex ? chartColors.background : 'transparent');
            const pointBorderColors = years.map((age, index) => index === closestAgeIndex ? color : 'transparent');
            
            return {
            label: scenarioLabel,
            data: scenario.projections.map(p => p.netWorth),
            borderColor: color,
            backgroundColor: color + '20', // Add transparency
            borderWidth: 3,
            fill: false,
            tension: 0.1,
            pointRadius: pointRadii,
            pointBackgroundColor: pointBackgroundColors,
            pointBorderColor: pointBorderColors,
            pointBorderWidth: 3,
            pointHoverRadius: years.map((age, index) => index === closestAgeIndex ? 6 : 0),
            pointHoverBackgroundColor: chartColors.background,
            pointHoverBorderColor: color,
            pointHoverBorderWidth: 3
            };
        });

        return {
            type: 'line',
            data: {
                labels: years,
                datasets: datasets
            },
            options: {
                ...baseConfig,
                plugins: {
                    ...baseConfig.plugins,
                    legend: {
                        display: false
                    },
                    tooltip: {
                        ...baseConfig.plugins.tooltip,
                        callbacks: {
                            title: function(context) {
                                const datasetLabel = context[0].dataset.label;
                                return `${datasetLabel}`;
                            },
                            label: function(context) {
                                const age = context.label;
                                const value = Math.round(context.parsed.y);
                                return `Age: ${age}, $${value.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    ...baseConfig.scales,
                    x: {
                        ...baseConfig.scales.x,
                        title: {
                            display: true,
                            text: 'Age',
                            color: chartColors.text,
                            font: {
                                family: ThemeConfig.fonts.primary,
                                weight: '600'
                            }
                        }
                    },
                    y: {
                        ...baseConfig.scales.y,
                        title: {
                            display: true,
                            text: 'Net Worth ($)',
                            color: chartColors.text,
                            font: {
                                family: ThemeConfig.fonts.primary,
                                weight: '600'
                            }
                        },
                        ticks: {
                            ...baseConfig.scales.y.ticks,
                            callback: function(value) {
                                return '$' + (value / 1000000).toFixed(1) + 'M';
                            }
                        }
                    }
                }
            }
        };
    }

    /**
     * Create retirement withdrawals chart configuration
     */
    static createWithdrawalsChart(data) {
        if (!data || !data.scenarios || data.scenarios.length === 0) {
            return this.createEmptyChartConfig('No withdrawal data available');
        }

        const baseConfig = this.getBaseConfig();
        const colors = this.getColorPalette();
        const chartColors = ThemeConfig.getChartColors();

        // Find the scenario with retirement data
        const retirementScenario = data.scenarios.find(s => s.retirementData && s.retirementData.length > 0);
        
        if (!retirementScenario) {
            return this.createEmptyChartConfig('No retirement withdrawal data available', themeName);
        }

        const years = retirementScenario.retirementData.map(d => d.age);
        const balances = retirementScenario.retirementData.map(d => d.balance);
        const withdrawals = retirementScenario.retirementData.map(d => d.withdrawal);
        
        // Create point styling array to show ONLY key points: target + 3 scenarios
        const targetRetirementAge = data.targetRetirementAge;
        const savingsScenarios = data.savingsScenarios || [];
        const scenarioColors = ['#27ae60', '#f39c12', '#e74c3c']; // Green, Orange, Red
        
        const pointRadii = years.map(age => {
            if (age === targetRetirementAge) return 4; // Target retirement age - same size as savings chart
            const scenarioIndex = savingsScenarios.findIndex(s => s.retirementAge === age);
            return scenarioIndex >= 0 ? 4 : 0; // Only show dots for scenarios and target, hide others
        });
        
        const pointBackgroundColors = years.map(age => 'transparent'); // Hollow dots
        
        const pointBorderColors = years.map(age => {
            if (age === targetRetirementAge) return colors[2]; // Special color for target age
            const scenarioIndex = savingsScenarios.findIndex(s => s.retirementAge === age);
            return scenarioIndex >= 0 ? scenarioColors[scenarioIndex] : 'transparent'; // Only color key points
        });

        return {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Retirement Withdrawals (Inflation Adjusted)',
                        data: withdrawals,
                        borderColor: colors[0],
                        backgroundColor: colors[0] + '20',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.1,
                        pointRadius: pointRadii,
                        pointHoverRadius: years.map(age => {
                            if (age === targetRetirementAge) return 6;
                            const scenarioIndex = savingsScenarios.findIndex(s => s.retirementAge === age);
                            return scenarioIndex >= 0 ? 6 : 0;
                        }),
                        pointBackgroundColor: chartColors.background, // White/theme background for hollow center
                        pointBorderColor: pointBorderColors,
                        pointBorderWidth: 3, // Match line thickness
                        pointHoverBackgroundColor: chartColors.background, // White/theme background for hover too
                        pointHoverBorderColor: pointBorderColors,
                        pointHoverBorderWidth: 3
                    }
                ]
            },
            options: {
                ...baseConfig,
                plugins: {
                    ...baseConfig.plugins,
                    legend: {
                        display: false
                    },
                    tooltip: {
                        ...baseConfig.plugins.tooltip,
                        callbacks: {
                            title: function(context) {
                                const age = context[0].label;
                                const targetRetirementAge = data.targetRetirementAge;
                                const savingsScenarios = data.savingsScenarios || [];
                                
                                // Check if this age corresponds to a scenario
                                const scenario = savingsScenarios.find(s => s.retirementAge == age);
                                if (scenario) {
                                    return `${scenario.label}: Age ${age}`;
                                } else if (age == targetRetirementAge) {
                                    return `Target Retirement: Age ${age}`;
                                }
                                return `Age ${age}`;
                            },
                            label: function(context) {
                                const value = Math.round(context.parsed.y);
                                return `Retirement Withdrawals (Inflation Adjusted): $${value.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    ...baseConfig.scales,
                    x: {
                        ...baseConfig.scales.x,
                        title: {
                            display: true,
                            text: 'Age',
                            color: chartColors.text,
                            font: {
                                family: ThemeConfig.fonts.primary,
                                weight: '600'
                            }
                        }
                    },
                    y: {
                        ...baseConfig.scales.y,
                        title: {
                            display: true,
                            text: 'Annual Withdrawal ($)',
                            color: chartColors.text,
                            font: {
                                family: ThemeConfig.fonts.primary,
                                weight: '600'
                            }
                        },
                        ticks: {
                            ...baseConfig.scales.y.ticks,
                            callback: function(value) {
                                return '$' + (value / 1000).toFixed(0) + 'K';
                            }
                        }
                    }
                }
            }
        };
    }

    /**
     * Create savings vs retirement age chart configuration (line chart)
     */
    static createSavingsVsRetirementChart(data) {
        if (!data || !data.scenarios || data.scenarios.length === 0) {
            return this.createEmptyChartConfig('No savings vs retirement data available');
        }

        const baseConfig = this.getBaseConfig();
        const colors = this.getColorPalette();
        const chartColors = ThemeConfig.getChartColors();

        // Convert scenarios data to x,y points for line chart
        const chartPoints = data.scenarios.map(s => ({
            x: s.retirementAge,
            y: s.savingsRate
        }));

        return {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Required Savings Rate',
                    data: chartPoints,
                    borderColor: colors[0],
                    backgroundColor: colors[0] + '20',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: chartColors.background, // White/theme background for hollow center
                    pointBorderColor: colors[0],
                    pointBorderWidth: 3, // Match line thickness
                    pointHoverBackgroundColor: chartColors.background, // White/theme background for hover too
                    pointHoverBorderColor: colors[0],
                    pointHoverBorderWidth: 3
                }]
            },
            options: {
                ...baseConfig,
                plugins: {
                    ...baseConfig.plugins,
                    legend: {
                        display: false
                    },
                    tooltip: {
                        ...baseConfig.plugins.tooltip,
                        callbacks: {
                            title: function(context) {
                                return 'Required Savings Rate';
                            },
                            label: function(context) {
                                const age = Math.round(context.parsed.x);
                                const savingsRate = Math.round(context.parsed.y);
                                return `Age: ${age}, ${savingsRate}%`;
                            }
                        }
                    }
                },
                scales: {
                    ...baseConfig.scales,
                    x: {
                        ...baseConfig.scales.x,
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'Retirement Age',
                            color: chartColors.text,
                            font: {
                                family: ThemeConfig.fonts.primary,
                                weight: '600'
                            }
                        },
                        ticks: {
                            ...baseConfig.scales.x.ticks,
                            callback: function(value) {
                                return Math.round(value) + ' yrs';
                            }
                        }
                    },
                    y: {
                        ...baseConfig.scales.y,
                        title: {
                            display: true,
                            text: 'Required Savings Rate',
                            color: chartColors.text,
                            font: {
                                family: ThemeConfig.fonts.primary,
                                weight: '600'
                            }
                        },
                        ticks: {
                            ...baseConfig.scales.y.ticks,
                            callback: function(value) {
                                return Math.round(value * 10) / 10 + '%';
                            }
                        }
                    }
                }
            }
        };
    }

    /**
     * Create empty chart configuration for error states
     */
    static createEmptyChartConfig(message) {
        const chartColors = ThemeConfig.getChartColors();
        
        return {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                },
                elements: {
                    point: {
                        radius: 0
                    }
                },
                layout: {
                    padding: 20
                }
            },
            plugins: [{
                id: 'empty-chart-message',
                afterDraw: function(chart) {
                    const { ctx, width, height } = chart;
                    ctx.restore();
                    ctx.font = `16px ${ThemeConfig.fonts.primary}`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = chartColors.text;
                    ctx.fillText(message, width / 2, height / 2);
                    ctx.save();
                }
            }]
        };
    }
}

// Make globally available
if (typeof window !== 'undefined') {
    window.ChartThemes = ChartThemes;
}