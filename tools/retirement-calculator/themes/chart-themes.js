/**
 * Theme-Aware Chart Configuration Helper
 * Provides theme-responsive chart configurations for all visualizations
 */

class ChartThemes {
    /**
     * Get theme-aware base chart configuration
     */
    static getBaseConfig(themeName = 'modern') {
        const colors = ThemeConfig.getChartColors(themeName);
        const theme = ThemeConfig.getTheme(themeName);
        const isModern = themeName === 'modern';
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: colors.text,
                        font: {
                            family: isModern ? theme.fonts.primary : theme.fonts.secondary,
                            size: isModern ? 12 : 11
                        },
                        usePointStyle: isModern,
                        padding: isModern ? 20 : 12
                    }
                },
                tooltip: {
                    backgroundColor: isModern ? 'rgba(255, 255, 255, 0.95)' : colors.primary,
                    borderColor: colors.chartPrimary,
                    borderWidth: isModern ? 1 : 1,
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    cornerRadius: isModern ? 8 : 0,
                    titleFont: {
                        family: theme.fonts.primary,
                        weight: isModern ? '600' : 'bold',
                        size: isModern ? 13 : 12
                    },
                    bodyFont: {
                        family: theme.fonts.primary,
                        size: isModern ? 12 : 11
                    },
                    padding: isModern ? 12 : 8,
                    boxShadow: isModern ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: colors.text,
                        font: {
                            family: isModern ? theme.fonts.primary : theme.fonts.secondary,
                            size: isModern ? 11 : 10
                        }
                    },
                    grid: {
                        color: colors.grid + (isModern ? '30' : '40'),
                        borderColor: colors.grid,
                        lineWidth: isModern ? 1 : 1,
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
                            family: isModern ? theme.fonts.primary : theme.fonts.secondary,
                            size: isModern ? 11 : 10
                        }
                    },
                    grid: {
                        color: colors.grid + (isModern ? '30' : '40'),
                        borderColor: colors.grid,
                        lineWidth: isModern ? 1 : 1,
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
     * Get theme-aware color palette for charts
     */
    static getColorPalette(themeName = 'modern') {
        const colors = ThemeConfig.getChartColors(themeName);
        
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
    static createMonteCarloSuccessChart(data, themeName = 'modern') {
        const { scenarios } = data;
        
        if (!scenarios || scenarios.length === 0) {
            return this.createEmptyChartConfig('No Monte Carlo data available', themeName);
        }

        const baseConfig = this.getBaseConfig(themeName);
        const colors = this.getColorPalette(themeName);
        const chartColors = ThemeConfig.getChartColors(themeName);
        
        const isModern = themeName === 'modern';
        const labels = scenarios.map((s, index) => {
            const labelText = s.label || s.scenario || (index + 1);
            return isModern ? `${labelText}` : `SCENARIO_${s.scenario || (index + 1)}`;
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
    static createNetWorthChart(data, themeName = 'modern') {
        if (!data || !data.scenarios || data.scenarios.length === 0) {
            return this.createEmptyChartConfig('No net worth data available', themeName);
        }

        const baseConfig = this.getBaseConfig(themeName);
        const colors = this.getColorPalette(themeName);
        const chartColors = ThemeConfig.getChartColors(themeName);

        // Extract years from first scenario
        const years = data.scenarios[0].projections.map(p => p.age);
        
        const datasets = data.scenarios.map((scenario, index) => {
            const isModern = themeName === 'modern';
            // Use scenario label or fall back to scenario number
            const labelText = scenario.label || scenario.scenario || (index + 1);
            const scenarioLabel = isModern ? `${labelText}` : `SCENARIO_${scenario.scenario || (index + 1)}`;
            
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
                            text: 'AGE',
                            color: chartColors.text,
                            font: {
                                family: ThemeConfig.getTheme(themeName).fonts.secondary,
                                weight: 'bold'
                            }
                        }
                    },
                    y: {
                        ...baseConfig.scales.y,
                        title: {
                            display: true,
                            text: 'NET_WORTH ($)',
                            color: chartColors.text,
                            font: {
                                family: ThemeConfig.getTheme(themeName).fonts.secondary,
                                weight: 'bold'
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
    static createWithdrawalsChart(data, themeName = 'modern') {
        if (!data || !data.scenarios || data.scenarios.length === 0) {
            return this.createEmptyChartConfig('No withdrawal data available', themeName);
        }

        const baseConfig = this.getBaseConfig(themeName);
        const colors = this.getColorPalette(themeName);
        const chartColors = ThemeConfig.getChartColors(themeName);
        const isModern = themeName === 'modern';

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
                        label: isModern ? 'Retirement Withdrawals (Inflation Adjusted)' : 'RETIREMENT_WITHDRAWALS',
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
                            text: isModern ? 'Age' : 'AGE',
                            color: chartColors.text,
                            font: {
                                family: isModern ? ThemeConfig.getTheme(themeName).fonts.primary : ThemeConfig.getTheme(themeName).fonts.secondary,
                                weight: isModern ? '600' : 'bold'
                            }
                        }
                    },
                    y: {
                        ...baseConfig.scales.y,
                        title: {
                            display: true,
                            text: isModern ? 'Annual Withdrawal ($)' : 'WITHDRAWAL ($)',
                            color: chartColors.text,
                            font: {
                                family: isModern ? ThemeConfig.getTheme(themeName).fonts.primary : ThemeConfig.getTheme(themeName).fonts.secondary,
                                weight: isModern ? '600' : 'bold'
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
    static createSavingsVsRetirementChart(data, themeName = 'modern') {
        if (!data || !data.scenarios || data.scenarios.length === 0) {
            return this.createEmptyChartConfig('No savings vs retirement data available', themeName);
        }

        const baseConfig = this.getBaseConfig(themeName);
        const colors = this.getColorPalette(themeName);
        const chartColors = ThemeConfig.getChartColors(themeName);
        const isModern = themeName === 'modern';

        // Convert scenarios data to x,y points for line chart
        const chartPoints = data.scenarios.map(s => ({
            x: s.retirementAge,
            y: s.savingsRate
        }));

        return {
            type: 'line',
            data: {
                datasets: [{
                    label: isModern ? 'Required Savings Rate' : 'REQUIRED_SAVINGS_RATE',
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
                            text: isModern ? 'Retirement Age' : 'RETIREMENT_AGE',
                            color: chartColors.text,
                            font: {
                                family: isModern ? ThemeConfig.getTheme(themeName).fonts.primary : ThemeConfig.getTheme(themeName).fonts.secondary,
                                weight: isModern ? '600' : 'bold'
                            }
                        },
                        ticks: {
                            ...baseConfig.scales.x.ticks,
                            callback: function(value) {
                                return Math.round(value) + (isModern ? ' yrs' : 'y');
                            }
                        }
                    },
                    y: {
                        ...baseConfig.scales.y,
                        title: {
                            display: true,
                            text: isModern ? 'Required Savings Rate' : 'SAVINGS_RATE',
                            color: chartColors.text,
                            font: {
                                family: isModern ? ThemeConfig.getTheme(themeName).fonts.primary : ThemeConfig.getTheme(themeName).fonts.secondary,
                                weight: isModern ? '600' : 'bold'
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
    static createEmptyChartConfig(message, themeName = 'modern') {
        const chartColors = ThemeConfig.getChartColors(themeName);
        
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
                    ctx.font = `16px ${ThemeConfig.getTheme(themeName).fonts.secondary}`;
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