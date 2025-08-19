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
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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

        // Extract years from first scenario
        const years = data.scenarios[0].projections.map(p => p.age);
        
        const datasets = data.scenarios.map((scenario, index) => {
            // Use scenario label or fall back to scenario number
            const labelText = scenario.label || scenario.scenario || (index + 1);
            const scenarioLabel = `${labelText}`;
            
            return {
            label: scenarioLabel,
            data: scenario.projections.map(p => p.netWorth),
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20', // Add transparency
            borderWidth: 3,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: colors[index % colors.length],
            pointHoverBorderColor: chartColors.background,
            pointHoverBorderWidth: 2
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
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: colors[0],
                        pointBorderColor: chartColors.background,
                        pointBorderWidth: 2,
                        pointHoverBackgroundColor: colors[0],
                        pointHoverBorderColor: chartColors.background,
                        pointHoverBorderWidth: 2
                    }
                ]
            },
            options: {
                ...baseConfig,
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
                    pointBackgroundColor: colors[0],
                    pointBorderColor: chartColors.background,
                    pointBorderWidth: 2,
                    pointHoverBackgroundColor: colors[0],
                    pointHoverBorderColor: chartColors.background,
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                ...baseConfig,
                plugins: {
                    ...baseConfig.plugins,
                    legend: {
                        ...baseConfig.plugins.legend,
                        display: true
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