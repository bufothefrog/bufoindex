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
     * Export comprehensive data package
     */
    static exportComprehensiveData(scenarios, netWorthData, withdrawalData, insights, params) {
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                calculatorVersion: '1.0',
                description: 'BufoIndex Retirement Planning Calculator Results'
            },
            parameters: params,
            scenarios: scenarios,
            projections: {
                netWorth: netWorthData,
                withdrawals: withdrawalData
            },
            insights: insights,
            calculations: {
                fourPercentRule: 'Portfolio Size = Annual Income ÷ 0.04',
                compoundGrowth: 'Future Value = Present Value × (1 + rate)^years',
                requiredPayment: 'PMT = (FV - PV × (1 + r)^n) ÷ (((1 + r)^n - 1) ÷ r)'
            }
        };

        return exportData;
    }
}

// Export for use in other modules
window.ExportUtility = ExportUtility;