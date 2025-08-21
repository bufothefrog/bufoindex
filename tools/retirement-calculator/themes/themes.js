/**
 * Modern Theme Configuration for Retirement Calculator
 * Simplified single-theme system for BufoIndex design
 */

const ThemeConfig = {
    // Theme detection
    getCurrentTheme() {
        if (typeof window !== 'undefined') {
            return document.documentElement.getAttribute('data-theme') || 'light';
        }
        return 'light';
    },
    
    // BufoIndex modern theme configuration
    colors: {
        light: {
            // Primary colors - BufoIndex palette
            primary: '#FAFAF9',         // Off-white background
            secondary: '#F8F9FA',       // Light grey
            accent: '#7FB069',          // Sage green primary
            success: '#7FB069',         // Sage green
            warning: '#FFB86C',         // Orange accent
            error: '#dc2626',           // Red for errors
            
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
        dark: {
            // Primary colors - Dark theme equivalents
            primary: '#111827',         // Dark grey background
            secondary: '#1F2937',       // Darker grey
            accent: '#7FB069',          // Sage green (same as light)
            success: '#7FB069',         // Sage green
            warning: '#FFB86C',         // Orange accent
            error: '#EF4444',           // Red for errors
            
            // Text colors - Light colors for dark backgrounds
            textPrimary: '#F9FAFB',     // Very light grey for text
            textSecondary: '#D1D5DB',   // Light grey
            textAccent: '#7FB069',      // Sage green accent
            textMuted: '#9CA3AF',       // Medium grey
            
            // Border and surface - Dark theme styling
            border: '#374151',          // Dark border
            borderHover: '#7FB069',     // Sage green on hover
            borderFocus: '#7FB069',     // Sage green focus
            surface: '#1F2937',         // Dark surface
            surfaceHover: '#374151',    // Darker grey hover
            surfaceAlt: '#374151',      // Dark grey alternate
            
            // Chart colors - Adjusted for dark backgrounds
            chartPrimary: '#7FB069',    // Sage green primary
            chartSecondary: '#FFB86C',  // Orange secondary
            chartAccent: '#8FBF7A',     // Lighter sage green for contrast
            chartSuccess: '#10B981',    // Success green
            chartWarning: '#F59E0B',    // Warning orange
            chartError: '#EF4444',      // Error red
            chartGrid: '#4B5563',       // Medium grey grid
            chartText: '#F9FAFB'        // Light text
        }
    },
    
    // Get current theme colors
    getColors() {
        const theme = this.getCurrentTheme();
        return this.colors[theme] || this.colors.light;
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
        focusShadow: '0 0 0 2px rgba(127, 176, 105, 0.5)',
        hoverShadow: '0 2px 8px rgba(127, 176, 105, 0.15)'
    },
    
    /**
     * Apply modern theme to CSS variables
     */
    applyTheme() {
        const root = document.documentElement;
        const colors = this.getColors();
        
        // Apply color variables for current theme
        Object.entries(colors).forEach(([key, value]) => {
            root.style.setProperty(`--color-${this.camelToKebab(key)}`, value);
        });
        
        // Apply font variables
        Object.entries(this.fonts).forEach(([key, value]) => {
            root.style.setProperty(`--font-${key}`, value);
        });
        
        // Apply spacing variables
        Object.entries(this.spacing).forEach(([key, value]) => {
            root.style.setProperty(`--${this.camelToKebab(key)}`, value);
        });
        
        // Apply effect variables
        Object.entries(this.effects).forEach(([key, value]) => {
            root.style.setProperty(`--${this.camelToKebab(key)}`, value);
        });
        
        // Apply modern theme class to body
        document.body.classList.add('theme-modern');
        
        // Apply modern theme class to calculator
        const calculator = document.querySelector('.retirement-calculator');
        if (calculator) {
            calculator.classList.add('theme-modern');
        }
        
        // Listen for theme changes from parent document
        this.setupThemeListener();
    },
    
    /**
     * Get chart colors for current theme
     */
    getChartColors() {
        const colors = this.getColors();
        return {
            primary: colors.chartPrimary,
            secondary: colors.chartSecondary,
            accent: colors.chartAccent,
            success: colors.chartSuccess,
            warning: colors.chartWarning,
            error: colors.chartError,
            grid: colors.chartGrid,
            text: colors.chartText,
            background: colors.surface
        };
    },
    
    /**
     * Setup theme change listener for coordination with parent document
     */
    setupThemeListener() {
        if (typeof window !== 'undefined') {
            // Listen for theme changes on the root document
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && 
                        mutation.attributeName === 'data-theme') {
                        // Re-apply theme when it changes
                        this.applyTheme();
                    }
                });
            });
            
            observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme']
            });
        }
    },
    
    /**
     * Convert camelCase to kebab-case
     */
    camelToKebab(str) {
        return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    },
    
    /**
     * Initialize theme on page load
     */
    init() {
        // Apply theme immediately
        this.applyTheme();
        
        // Set up DOM ready handler if needed
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.applyTheme();
            });
        }
    }
};

// Initialize theme immediately
ThemeConfig.init();

// Make globally available
if (typeof window !== 'undefined') {
    window.ThemeConfig = ThemeConfig;
}