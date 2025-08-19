/**
 * Theme Configuration for Retirement Calculator
 * Hugo-standard theme system with complete theming support
 */

const ThemeConfig = {
    // Available themes
    themes: {
        modern: {
            name: 'Modern',
            description: 'Clean BufoIndex design with sage green and orange accents',
            colors: {
                // Primary colors - BufoIndex palette
                primary: '#FAFAF9',         // Off-white background
                secondary: '#F8F9FA',       // Light grey
                accent: '#7FB069',          // Sage green primary
                success: '#7FB069',         // Sage green
                warning: '#FFB86C',         // Orange accent
                error: '#dc2626',           // Keep red for errors
                
                // Text colors - High contrast for readability
                textPrimary: '#1F2937',     // Dark grey for text
                textSecondary: '#6B7280',   // Medium grey
                textAccent: '#7FB069',      // Sage green accent
                textMuted: '#9CA3AF',       // Light grey
                
                // Border and surface - BufoIndex styling
                border: '#E5E7EB',          // Light border
                borderHover: '#7FB069',     // Sage green on hover
                borderFocus: '#7FB069',     // Sage green focus
                surface: '#FFFFFF',         // White surface
                surfaceHover: '#F9FAFB',    // Very light grey hover
                surfaceAlt: '#F3F4F6',      // Light grey alternate
                
                // Chart colors - BufoIndex palette for data visualization
                chartPrimary: '#7FB069',    // Sage green primary
                chartSecondary: '#FFB86C',  // Orange secondary
                chartAccent: '#6B8E5A',     // Darker sage green
                chartSuccess: '#10B981',    // Success green
                chartWarning: '#F59E0B',    // Warning orange
                chartError: '#EF4444',      // Error red
                chartGrid: '#E5E7EB',       // Light grey grid
                chartText: '#374151'        // Dark grey text
            },
            fonts: {
                primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                secondary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
            },
            spacing: {
                borderRadius: '0.75rem',
                inputRadius: '0.5rem',
                cardRadius: '1rem',
                buttonRadius: '0.5rem',
                containerPadding: '2rem'
            },
            effects: {
                shadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                cardShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                focusShadow: '0 0 0 2px rgba(37, 99, 235, 0.5)',
                hoverShadow: '0 2px 8px rgba(37, 99, 235, 0.15)'
            }
        },
        
        terminal: {
            name: 'Terminal',
            description: 'Classic green-on-black terminal aesthetic',
            colors: {
                // Primary colors
                primary: '#0A0E1A',
                secondary: '#000000',
                accent: '#00FF41',
                success: '#00FF41',
                warning: '#FFB86C',
                error: '#FF5555',
                
                // Text colors
                textPrimary: '#00FF41',
                textSecondary: '#00FF41',
                textAccent: '#FFB86C',
                textMuted: '#00FF4180',
                
                // Border and surface
                border: '#00FF41',
                borderHover: '#00FF41',
                surface: '#000000',
                surfaceHover: '#0A0E1A',
                
                // Chart colors
                chartPrimary: '#00FF41',
                chartSecondary: '#FFB86C',
                chartAccent: '#FF79C6',
                chartSuccess: '#50FA7B',
                chartWarning: '#F1FA8C',
                chartError: '#FF5555',
                chartGrid: '#00FF41',
                chartText: '#00FF41'
            },
            fonts: {
                primary: 'IBM Plex Mono, "Fira Code", "Courier New", monospace',
                secondary: 'IBM Plex Mono, "Fira Code", "Courier New", monospace',
                mono: 'IBM Plex Mono, "Fira Code", "Courier New", monospace'
            },
            spacing: {
                borderRadius: '0',
                inputRadius: '0',
                cardRadius: '0'
            },
            effects: {
                shadow: 'none',
                cardShadow: 'none',
                focusShadow: '0 0 0 2px #00FF41, 0 0 10px rgba(0, 255, 65, 0.3)'
            }
        }
    },
    
    // Default theme
    defaultTheme: 'modern',
    
    // Storage key for theme preference
    storageKey: 'retirement-calculator-theme',
    
    /**
     * Get theme configuration
     */
    getTheme(themeName) {
        return this.themes[themeName] || this.themes[this.defaultTheme];
    },
    
    /**
     * Get all available theme names
     */
    getThemeNames() {
        return Object.keys(this.themes);
    },
    
    /**
     * Apply theme to CSS variables
     */
    applyTheme(themeName) {
        const theme = this.getTheme(themeName);
        const root = document.documentElement;
        
        // Apply color variables
        Object.entries(theme.colors).forEach(([key, value]) => {
            root.style.setProperty(`--color-${this.camelToKebab(key)}`, value);
        });
        
        // Apply font variables
        Object.entries(theme.fonts).forEach(([key, value]) => {
            root.style.setProperty(`--font-${key}`, value);
        });
        
        // Apply spacing variables
        Object.entries(theme.spacing).forEach(([key, value]) => {
            root.style.setProperty(`--${this.camelToKebab(key)}`, value);
        });
        
        // Apply effect variables
        Object.entries(theme.effects).forEach(([key, value]) => {
            root.style.setProperty(`--${this.camelToKebab(key)}`, value);
        });
        
        // Apply theme-specific classes to body for conditional styling
        document.body.classList.remove('theme-terminal', 'theme-modern');
        document.body.classList.add(`theme-${themeName}`);
        
        // Apply theme class to calculator
        const calculator = document.querySelector('.retirement-calculator');
        if (calculator) {
            // Remove all theme classes
            this.getThemeNames().forEach(name => {
                calculator.classList.remove(`theme-${name}`);
            });
            // Add current theme class
            calculator.classList.add(`theme-${themeName}`);
        }
        
        // Reset any corrupted toggle buttons before applying transformations
        this.resetCorruptedToggles();
        
        // Apply text transformations for modern theme
        this.applyTextTransformations(themeName);
        
        // Refresh any dynamic content that might have been generated
        this.refreshDynamicContent(themeName);
    },
    
    /**
     * Reset corrupted toggle buttons to clean state
     */
    resetCorruptedToggles() {
        const toggleButtons = document.querySelectorAll('.terminal-toggle, #assumptionsToggle');
        toggleButtons.forEach(toggle => {
            const text = toggle.textContent.trim();
            
            // If text contains repeated words or is corrupted, reset it
            if (text.length > 20 || text.match(/(\w+)\1+/)) {
                // Determine if section is currently hidden to set appropriate state
                const section = document.getElementById('assumptionsSection');
                if (section && section.classList.contains('hidden')) {
                    toggle.textContent = '([EXPAND])';
                } else {
                    toggle.textContent = '([COLLAPSE])';
                }
            }
        });
    },
    
    /**
     * Apply text transformations based on theme
     */
    applyTextTransformations(themeName) {
        if (themeName === 'modern') {
            // Convert terminal-style text to modern format
            const textMappings = {
                'RETIREMENT CALCULATOR v2.0': 'Retirement Calculator v2.0',
                'RETIREMENT_CALCULATOR': 'Retirement Calculator',
                'USER_DECISIONS': 'User Decisions', 
                'ASSUMPTIONS': 'Assumptions',
                'RETIREMENT_GOAL_ASSESSMENT': 'Retirement Goal Assessment',
                'SAVINGS_RATE_SCENARIOS': 'Savings Rate Scenarios',
                'VISUALIZATIONS': 'Visualizations',
                'KEY_INSIGHTS': 'Key Insights',
                'TARGET_RETIREMENT_INCOME': 'Target Retirement Income',
                'CURRENT_RETIREMENT_SAVINGS': 'Current Retirement Savings',
                'CURRENT_INCOME': 'Current Income',
                'CURRENT_AGE': 'Current Age',
                'TARGET_RETIREMENT_AGE': 'Target Retirement Age',
                'CURRENT_SAVINGS_RATE': 'Current Savings Rate',
                'STATE': 'State',
                'RISK_PROFILE': 'Risk Profile',
                'INFLATION_RATE': 'Inflation Rate',
                'END_AGE': 'End Age',
                'ACCUMULATION_RETURN': 'Accumulation Return',
                'RETIREMENT_RETURN': 'Retirement Return',
                'RETURN_VOLATILITY': 'Return Volatility',
                'Market Parameters': 'Market Parameters',
                'Calculation Parameters': 'Calculation Parameters',
                'PRESENT_VALUE': 'Present Value',
                'FUTURE_VALUE': 'Future Value',
                'MONTHLY_PAYMENTS': 'Monthly Payments',
                'INVESTMENT_GROWTH': 'Investment Growth',
                'RETIREMENT_WITHDRAWALS': 'Retirement Withdrawals',
                'YOUR_RETIREMENT_GOAL': 'Your Retirement Goal',
                'YOUR RETIREMENT GOAL': 'Your Retirement Goal',
                'ASSESSMENT': 'Assessment',
                'Enter parameters below. Press ENTER to calculate.': 'Enter parameters below. Press ENTER to calculate.',
                'Compare retirement ages achievable with different savings rates': 'Compare retirement ages achievable with different savings rates',
                '[EXPAND]': 'Expand',
                '[COLLAPSE]': 'Collapse',
                '([EXPAND])': '(Expand)',
                '([COLLAPSE])': '(Collapse)',
                'EXPAND': 'Expand',
                'COLLAPSE': 'Collapse',
                'NET_WORTH_PROGRESSION': 'Net Worth Progression',
                'SAVINGS_VS_RETIREMENT': 'Savings vs Retirement',
                'RETIREMENT_WITHDRAWALS': 'Retirement Withdrawals',
                'SAVINGS_RATE_IMPACT': 'Savings Rate Impact',
                'LOCATION_IMPACT': 'Location Impact',
                'PORTFOLIO_DURABILITY': 'Portfolio Durability',
                'SCENARIO_A': 'A',
                'SCENARIO_B': 'B', 
                'SCENARIO_C': 'C',
                'SCENARIO_Current': 'Current',
                'SCENARIO_Moderate': 'Moderate',
                'SCENARIO_Aggressive': 'Aggressive',
                'Financial projections over time': 'Financial projections over time'
            };
            
            // Apply transformations to text content
            this.transformTextContent(textMappings);
            
            // Apply transformations to headers and titles specifically
            this.transformHeaders(textMappings);
            
            // Transform assumptions text specifically
            const assumptionsElement = document.querySelector('.assumptions-text');
            if (assumptionsElement) {
                assumptionsElement.textContent = 'Assumptions';
            }
            
        } else {
            // For terminal theme, restore original terminal format
            const modernToTerminalMappings = {
                'Retirement Calculator v2.0': 'RETIREMENT CALCULATOR v2.0',
                'Retirement Calculator': 'RETIREMENT_CALCULATOR',
                'User Decisions': 'USER_DECISIONS',
                'Assumptions': 'ASSUMPTIONS',
                'Retirement Goal Assessment': 'RETIREMENT_GOAL_ASSESSMENT',
                'Savings Rate Scenarios': 'SAVINGS_RATE_SCENARIOS',
                'Visualizations': 'VISUALIZATIONS',
                'Key Insights': 'KEY_INSIGHTS',
                'Target Retirement Income': 'TARGET_RETIREMENT_INCOME',
                'Current Retirement Savings': 'CURRENT_RETIREMENT_SAVINGS',
                'Current Income': 'CURRENT_INCOME',
                'Current Age': 'CURRENT_AGE',
                'Target Retirement Age': 'TARGET_RETIREMENT_AGE',
                'Current Savings Rate': 'CURRENT_SAVINGS_RATE',
                'State': 'STATE',
                'Risk Profile': 'RISK_PROFILE',
                'Inflation Rate': 'INFLATION_RATE',
                'End Age': 'END_AGE',
                'Accumulation Return': 'ACCUMULATION_RETURN',
                'Retirement Return': 'RETIREMENT_RETURN',
                'Return Volatility': 'RETURN_VOLATILITY',
                'Present Value': 'PRESENT_VALUE',
                'Future Value': 'FUTURE_VALUE',
                'Monthly Payments': 'MONTHLY_PAYMENTS',
                'Investment Growth': 'INVESTMENT_GROWTH',
                'Retirement Withdrawals': 'RETIREMENT_WITHDRAWALS',
                'Your Retirement Goal': 'YOUR RETIREMENT GOAL',
                'Assessment': 'ASSESSMENT',
                'Enter parameters below. Press ENTER to calculate.': 'Enter parameters below. Press ENTER to calculate.',
                'Compare retirement ages achievable with different savings rates': 'Compare retirement ages achievable with different savings rates',
                'Expand': '[EXPAND]',
                'Collapse': '[COLLAPSE]',
                '(Expand)': '([EXPAND])',
                '(Collapse)': '([COLLAPSE])',
                'Net Worth Progression': 'NET_WORTH_PROGRESSION',
                'Savings vs Retirement': 'SAVINGS_VS_RETIREMENT',
                'Retirement Withdrawals': 'RETIREMENT_WITHDRAWALS',
                'Savings Rate Impact': 'SAVINGS_RATE_IMPACT',
                'Location Impact': 'LOCATION_IMPACT',
                'Portfolio Durability': 'PORTFOLIO_DURABILITY',
                'A': 'SCENARIO_A',
                'B': 'SCENARIO_B',
                'C': 'SCENARIO_C',
                'Current': 'SCENARIO_Current',
                'Moderate': 'SCENARIO_Moderate',
                'Aggressive': 'SCENARIO_Aggressive',
                'Financial projections over time': 'Financial projections over time'
            };
            
            this.transformTextContent(modernToTerminalMappings);
            this.transformHeaders(modernToTerminalMappings);
            
            // Transform assumptions text back to terminal format
            const assumptionsElement = document.querySelector('.assumptions-text');
            if (assumptionsElement) {
                assumptionsElement.textContent = 'ASSUMPTIONS';
            }
        }
    },
    
    /**
     * Transform text content in text nodes
     */
    transformTextContent(textMappings) {
        Object.entries(textMappings).forEach(([originalText, newText]) => {
            const walker = document.createTreeWalker(
                document.querySelector('.retirement-calculator') || document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes(originalText)) {
                    textNodes.push(node);
                }
            }

            textNodes.forEach(textNode => {
                const parent = textNode.parentElement;
                if (!parent || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(parent.tagName)) {
                    return;
                }
                
                // Skip text nodes within interactive elements or toggle buttons
                if (parent.classList.contains('terminal-toggle') || 
                    parent.id === 'assumptionsToggle' ||
                    parent.closest('[onclick]') ||
                    parent.closest('.terminal-toggle') ||
                    parent.closest('.toggle-button')) {
                    return;
                }

                textNode.textContent = textNode.textContent.replace(new RegExp(originalText, 'g'), newText);
            });
        });
    },
    
    /**
     * Transform headers and chart titles specifically
     */
    transformHeaders(textMappings) {
        // Transform headers (h1, h2, h3, etc.)
        const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headers.forEach(header => {
            // Skip headers that contain interactive elements like toggle buttons
            if (header.querySelector('.terminal-toggle, .toggle-button, [onclick]')) {
                return;
            }
            
            Object.entries(textMappings).forEach(([originalText, newText]) => {
                if (header.textContent.includes(originalText)) {
                    header.innerHTML = header.innerHTML.replace(new RegExp(originalText, 'g'), newText);
                }
            });
        });
        
        // Handle toggle buttons separately to ensure proper theme text
        this.updateToggleButtons(textMappings);
        
        // Transform chart titles and widget headers
        const chartTitles = document.querySelectorAll('.chart-title, .widget-title, .section-title, .terminal-insight-title');
        chartTitles.forEach(title => {
            Object.entries(textMappings).forEach(([originalText, newText]) => {
                if (title.textContent.includes(originalText)) {
                    title.innerHTML = title.innerHTML.replace(new RegExp(originalText, 'g'), newText);
                }
            });
        });
        
        // Transform labels
        const labels = document.querySelectorAll('label.terminal-label');
        labels.forEach(label => {
            Object.entries(textMappings).forEach(([originalText, newText]) => {
                if (label.textContent.includes(originalText)) {
                    label.innerHTML = label.innerHTML.replace(new RegExp(originalText, 'g'), newText);
                }
            });
        });
        
        // Transform comment/hint texts
        const hintTexts = document.querySelectorAll('.terminal-comment, .opacity-75');
        hintTexts.forEach(hint => {
            Object.entries(textMappings).forEach(([originalText, newText]) => {
                if (hint.textContent.includes(originalText)) {
                    hint.innerHTML = hint.innerHTML.replace(new RegExp(originalText, 'g'), newText);
                }
            });
        });
    },
    
    /**
     * Update toggle buttons with correct theme text
     */
    updateToggleButtons(textMappings) {
        const toggleButtons = document.querySelectorAll('.terminal-toggle, #assumptionsToggle');
        toggleButtons.forEach(toggle => {
            let currentText = toggle.textContent.trim();
            
            // Reset corrupted toggle text to a clean state first
            if (currentText.includes('Collapse') && currentText.length > 10) {
                // Corrupted with multiple "Collapse" - reset to collapsed state
                currentText = '[COLLAPSE]';
            } else if (currentText.includes('Expand') && currentText.length > 10) {
                // Corrupted with multiple "Expand" - reset to expanded state  
                currentText = '[EXPAND]';
            }
            
            // Clean transformation based on state
            if (currentText === '[EXPAND]' || currentText === '([EXPAND])' || currentText === 'Expand' || currentText === '(Expand)' || currentText.includes('EXPAND')) {
                toggle.textContent = textMappings['([EXPAND])'] || textMappings['[EXPAND]'] || textMappings['EXPAND'] || '([EXPAND])';
            } else if (currentText === '[COLLAPSE]' || currentText === '([COLLAPSE])' || currentText === 'Collapse' || currentText === '(Collapse)' || currentText.includes('COLLAPSE')) {
                toggle.textContent = textMappings['([COLLAPSE])'] || textMappings['[COLLAPSE]'] || textMappings['COLLAPSE'] || '([COLLAPSE])';
            }
        });
    },
    
    /**
     * Refresh dynamic content after theme change
     */
    refreshDynamicContent(themeName) {
        // Trigger a recalculation if the calculator exists
        // This will regenerate the dynamic content with the new theme
        if (typeof window.retirementCalculator !== 'undefined' && window.retirementCalculator.displayGoalAssessment) {
            // Check if we have assessment data to refresh
            const container = document.getElementById('goalAssessment');
            if (container && container.innerHTML.trim() !== '') {
                // Force refresh of the goal assessment display
                setTimeout(() => {
                    if (typeof window.retirementCalculator.calculate === 'function') {
                        // Don't trigger full calculation, just refresh display if possible
                        const event = new Event('input');
                        const firstInput = document.querySelector('input[type="text"]');
                        if (firstInput) {
                            firstInput.dispatchEvent(event);
                        }
                    }
                }, 100);
            }
        }
    },
    
    /**
     * Transform underscored text to readable format
     */
    transformText(text, toModern = true) {
        if (toModern) {
            return text
                .toLowerCase()
                .replace(/_/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
        }
        return text.toUpperCase().replace(/ /g, '_');
    },
    
    /**
     * Apply modern styling to form labels
     */
    applyModernLabels() {
        const labels = document.querySelectorAll('.theme-modern .terminal-label');
        labels.forEach(label => {
            const textContent = label.textContent;
            if (textContent.includes('_')) {
                const transformedText = this.transformText(textContent, true);
                label.innerHTML = label.innerHTML.replace(textContent, transformedText);
            }
        });
    },
    
    /**
     * Get current theme from storage or default
     */
    getCurrentTheme() {
        return localStorage.getItem(this.storageKey) || this.defaultTheme;
    },
    
    /**
     * Save theme preference
     */
    saveTheme(themeName) {
        localStorage.setItem(this.storageKey, themeName);
    },
    
    /**
     * Convert camelCase to kebab-case
     */
    camelToKebab(str) {
        return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    },
    
    /**
     * Get theme-aware chart colors
     */
    getChartColors(themeName) {
        const theme = this.getTheme(themeName);
        return {
            primary: theme.colors.chartPrimary,
            secondary: theme.colors.chartSecondary,
            accent: theme.colors.chartAccent,
            success: theme.colors.chartSuccess,
            warning: theme.colors.chartWarning,
            error: theme.colors.chartError,
            grid: theme.colors.chartGrid,
            text: theme.colors.chartText,
            background: theme.colors.surface
        };
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.ThemeConfig = ThemeConfig;
}