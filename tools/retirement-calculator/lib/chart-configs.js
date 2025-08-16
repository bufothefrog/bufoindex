/**
 * Chart.js Configuration Templates
 * Terminal-style chart configurations for retirement calculator visualizations
 */

class ChartConfigs {
    /**
     * Create Monte Carlo success probability bar chart configuration
     * @param {Object} data - Success rate data for each scenario
     * @returns {Object} Chart.js configuration
     */
    static createMonteCarloSuccessChart(data) {
        const { scenarios } = data;
        
        if (!scenarios || scenarios.length === 0) {
            return this.createEmptyChartConfig('No Monte Carlo data available');
        }

        const labels = scenarios.map(s => `SCENARIO_${s.scenario}`);
        const successRates = scenarios.map(s => s.successRate * 100); // Convert to percentage
        const scenarioColors = ['#e74c3c', '#f39c12', '#27ae60']; // Match main chart colors
        const colors = scenarios.map((s, index) => scenarioColors[index % scenarioColors.length]);

        return {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'SUCCESS_PROBABILITY',
                    data: successRates,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 2,
                    barThickness: 60
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#0A0E1A',
                        borderColor: '#00FF41',
                        borderWidth: 1,
                        titleColor: '#00FF41',
                        bodyColor: '#00FF41',
                        titleFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace',
                            size: 12
                        },
                        bodyFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace',
                            size: 11
                        },
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const scenario = scenarios[context.dataIndex];
                                return [
                                    `SUCCESS_RATE: ${Math.round(context.parsed.y)}%`,
                                    `SIMULATIONS: ${scenario.allSimulations ? scenario.allSimulations.length : 'N/A'}`,
                                    `RETIREMENT_AGE: ${scenario.retirementAge}`
                                ];
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
                                family: 'IBM Plex Mono, Fira Code, monospace',
                                size: 11
                            }
                        }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace',
                                size: 11
                            },
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'SUCCESS_PROBABILITY',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace',
                                size: 12
                            }
                        }
                    }
                }
            }
        };
    }

    /**
     * Create portfolio distribution line chart configuration
     * @param {Object} data - Portfolio distribution data
     * @returns {Object} Chart.js configuration
     */
    static createPortfolioDistributionChart(data) {
        const { scenarios } = data;
        
        if (!scenarios || scenarios.length === 0) {
            return this.createEmptyChartConfig('No portfolio distribution data available');
        }

        const datasets = scenarios.map((scenario, index) => {
            const scenarioLetter = scenario.scenario;
            const portfolioData = scenario.portfolioAtRetirement;
            
            // Generate percentile distribution curve
            const percentiles = [];
            const values = [];
            
            // Create smooth curve from 0% to 100% percentiles
            for (let p = 0; p <= 100; p += 2) {
                percentiles.push(p);
                
                // Interpolate between known percentiles
                let value;
                if (p <= 10) {
                    // Interpolate between min and 10th percentile
                    const weight = p / 10;
                    value = portfolioData.min * (1 - weight) + portfolioData.percentile10 * weight;
                } else if (p <= 25) {
                    const weight = (p - 10) / 15;
                    value = portfolioData.percentile10 * (1 - weight) + portfolioData.percentile25 * weight;
                } else if (p <= 50) {
                    const weight = (p - 25) / 25;
                    value = portfolioData.percentile25 * (1 - weight) + portfolioData.median * weight;
                } else if (p <= 75) {
                    const weight = (p - 50) / 25;
                    value = portfolioData.median * (1 - weight) + portfolioData.percentile75 * weight;
                } else if (p <= 90) {
                    const weight = (p - 75) / 15;
                    value = portfolioData.percentile75 * (1 - weight) + portfolioData.percentile90 * weight;
                } else {
                    // Interpolate between 90th percentile and max
                    const weight = (p - 90) / 10;
                    value = portfolioData.percentile90 * (1 - weight) + portfolioData.max * weight;
                }
                
                values.push(value);
            }

            const colors = ['#e74c3c', '#f39c12', '#27ae60'];
            
            return {
                label: `SCENARIO_${scenarioLetter}`,
                data: percentiles.map((p, i) => ({ x: p, y: values[i] })),
                borderColor: colors[index % colors.length],
                backgroundColor: 'transparent',
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 6,
                tension: 0.4
            };
        });

        // Add median markers
        scenarios.forEach((scenario, index) => {
            const colors = ['#e74c3c', '#f39c12', '#27ae60'];
            datasets.push({
                label: `MEDIAN_${scenario.scenario}`,
                data: [{ x: 50, y: scenario.portfolioAtRetirement.median }],
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length],
                borderWidth: 0,
                pointRadius: 8,
                pointHoverRadius: 10,
                showLine: false
            });
        });

        return {
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
                                family: 'IBM Plex Mono, Fira Code, monospace',
                                size: 11
                            },
                            filter: function(legendItem) {
                                // Only show main scenarios in legend, not median points
                                return !legendItem.text.startsWith('MEDIAN_');
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0A0E1A',
                        borderColor: '#00FF41',
                        borderWidth: 1,
                        titleColor: '#00FF41',
                        bodyColor: '#00FF41',
                        titleFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace',
                            size: 12
                        },
                        bodyFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace',
                            size: 11
                        },
                        callbacks: {
                            title: function(context) {
                                const scenario = context[0].dataset.label.replace('SCENARIO_', '').replace('MEDIAN_', '');
                                return `SCENARIO_${scenario}`;
                            },
                            label: function(context) {
                                const percentile = Math.round(context.parsed.x);
                                const value = context.parsed.y;
                                return [
                                    `PERCENTILE: ${percentile}%`,
                                    `PORTFOLIO_VALUE: $${StatisticalAnalysis.formatCurrency(value)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: 100,
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace',
                                size: 11
                            },
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'PERCENTILE',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace',
                                size: 12
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
                                family: 'IBM Plex Mono, Fira Code, monospace',
                                size: 11
                            },
                            callback: function(value) {
                                return '$' + StatisticalAnalysis.formatCurrency(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'PORTFOLIO_VALUE_AT_RETIREMENT',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace',
                                size: 12
                            }
                        }
                    }
                }
            }
        };
    }


    /**
     * Create empty chart configuration for when no data is available
     * @param {string} message - Message to display
     * @returns {Object} Chart.js configuration
     */
    static createEmptyChartConfig(message) {
        return {
            type: 'line',
            data: {
                labels: ['NO_DATA'],
                datasets: [{
                    label: 'WAITING_FOR_DATA',
                    data: [0],
                    borderColor: '#00FF41',
                    backgroundColor: 'transparent',
                    borderWidth: 2
                }]
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
                afterDraw: function(chart) {
                    const ctx = chart.ctx;
                    const width = chart.width;
                    const height = chart.height;
                    
                    ctx.restore();
                    ctx.font = '16px IBM Plex Mono, Fira Code, monospace';
                    ctx.fillStyle = '#00FF41';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(message, width / 2, height / 2);
                    ctx.save();
                }
            }]
        };
    }

    /**
     * Get base terminal chart styling options
     * @returns {Object} Base chart options
     */
    static getBaseTerminalStyle() {
        return {
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
                    titleFont: {
                        family: 'IBM Plex Mono, Fira Code, monospace'
                    },
                    bodyFont: {
                        family: 'IBM Plex Mono, Fira Code, monospace'
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
                        }
                    },
                    title: {
                        color: '#00FF41',
                        font: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
                        }
                    }
                }
            }
        };
    }
}

// Export for use in other modules
window.ChartConfigs = ChartConfigs;