/**
 * Theme System - Terminal-style theme management
 * Provides consistent theming and responsive behavior
 */

export class ThemeSystem {
  constructor() {
    this.currentTheme = 'terminal';
    this.prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');
    this.breakpoints = {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280
    };
    
    this.colors = {
      terminal: {
        primary: '#00FF41',    // Terminal green
        secondary: '#FFB86C',  // Orange accent
        danger: '#FF6B6B',     // Red
        background: '#0A0E1A', // Terminal black
        surface: '#1A1F2E',    // Lighter terminal background
        text: {
          primary: '#FFFFFF',
          secondary: '#E4E4E7',
          muted: '#9CA3AF'
        }
      }
    };
  }

  /**
   * Initialize theme system
   */
  initialize() {
    this.setupCustomProperties();
    this.setupResponsiveListeners();
    this.setupPrefersColorScheme();
    this.injectGlobalStyles();
    
    console.log('🎨 Theme system initialized');
  }

  /**
   * Setup CSS custom properties
   */
  setupCustomProperties() {
    const root = document.documentElement;
    const theme = this.colors[this.currentTheme];
    
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-secondary', theme.secondary);
    root.style.setProperty('--color-danger', theme.danger);
    root.style.setProperty('--color-background', theme.background);
    root.style.setProperty('--color-surface', theme.surface);
    root.style.setProperty('--color-text-primary', theme.text.primary);
    root.style.setProperty('--color-text-secondary', theme.text.secondary);
    root.style.setProperty('--color-text-muted', theme.text.muted);
  }

  /**
   * Setup responsive design listeners
   */
  setupResponsiveListeners() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.handleResize();
      }, 100);
    });
    
    // Initial call
    this.handleResize();
  }

  /**
   * Handle window resize
   */
  handleResize() {
    const width = window.innerWidth;
    let breakpoint = 'sm';
    
    if (width >= this.breakpoints.xl) breakpoint = 'xl';
    else if (width >= this.breakpoints.lg) breakpoint = 'lg';
    else if (width >= this.breakpoints.md) breakpoint = 'md';
    
    document.body.setAttribute('data-breakpoint', breakpoint);
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('bufo:breakpoint-change', {
      detail: { breakpoint, width }
    }));
  }

  /**
   * Setup prefers-color-scheme listener
   */
  setupPrefersColorScheme() {
    this.prefersDarkMode.addEventListener('change', (e) => {
      this.handleColorSchemeChange(e.matches);
    });
    
    // Initial call
    this.handleColorSchemeChange(this.prefersDarkMode.matches);
  }

  /**
   * Handle color scheme change
   * @param {boolean} isDark - Whether dark mode is preferred
   */
  handleColorSchemeChange(isDark) {
    document.body.setAttribute('data-color-scheme', isDark ? 'dark' : 'light');
  }

  /**
   * Inject global styles for terminal components
   */
  injectGlobalStyles() {
    const styles = `
      /* Terminal Form Styles */
      .terminal-form {
        background: var(--color-background);
        border: 1px solid #374151;
        border-radius: 0.5rem;
        padding: 1.5rem;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      }
      
      .terminal-form__section {
        margin-bottom: 1.5rem;
      }
      
      .terminal-form__label {
        display: block;
        color: var(--color-primary);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.5rem;
      }
      
      .terminal-form__input {
        width: 100%;
        background: var(--color-surface);
        border: 1px solid #4B5563;
        border-radius: 0.375rem;
        padding: 0.75rem;
        color: var(--color-text-primary);
        font-family: inherit;
        font-size: 0.875rem;
        transition: border-color 0.2s ease;
      }
      
      .terminal-form__input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(0, 255, 65, 0.1);
      }
      
      .terminal-form__input--error {
        border-color: var(--color-danger);
      }
      
      .terminal-form__range {
        width: 100%;
        height: 6px;
        background: var(--color-surface);
        border-radius: 3px;
        outline: none;
        margin: 0.5rem 0;
      }
      
      .terminal-form__range::-webkit-slider-thumb {
        appearance: none;
        width: 18px;
        height: 18px;
        background: var(--color-primary);
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid var(--color-background);
      }
      
      .terminal-form__range::-moz-range-thumb {
        width: 18px;
        height: 18px;
        background: var(--color-primary);
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid var(--color-background);
      }
      
      /* Terminal Display Styles */
      .terminal-display {
        background: var(--color-background);
        border: 1px solid #374151;
        border-radius: 0.5rem;
        padding: 1.5rem;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      }
      
      .terminal-display__header {
        display: flex;
        align-items: center;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #374151;
      }
      
      .terminal-display__title {
        color: var(--color-primary);
        font-size: 0.875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .terminal-display__content {
        color: var(--color-text-primary);
        font-size: 0.875rem;
        line-height: 1.5;
      }
      
      .terminal-display__grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }
      
      .terminal-display__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0;
        border-bottom: 1px solid #374151;
      }
      
      .terminal-display__row:last-child {
        border-bottom: none;
      }
      
      .terminal-display__label {
        color: var(--color-text-secondary);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .terminal-display__value {
        color: var(--color-text-primary);
        font-weight: 600;
        font-size: 0.875rem;
      }
      
      .terminal-display__value--positive {
        color: var(--color-primary);
      }
      
      .terminal-display__value--negative {
        color: var(--color-danger);
      }
      
      .terminal-display__value--accent {
        color: var(--color-secondary);
      }
      
      /* Terminal Button Styles */
      .terminal-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1.5rem;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border: 1px solid;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
      }
      
      .terminal-btn--primary {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: var(--color-background);
      }
      
      .terminal-btn--primary:hover {
        background: transparent;
        color: var(--color-primary);
      }
      
      .terminal-btn--secondary {
        background: transparent;
        border-color: var(--color-secondary);
        color: var(--color-secondary);
      }
      
      .terminal-btn--secondary:hover {
        background: var(--color-secondary);
        color: var(--color-background);
      }
      
      .terminal-btn--ghost {
        background: transparent;
        border-color: #4B5563;
        color: var(--color-text-secondary);
      }
      
      .terminal-btn--ghost:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      
      /* Loading States */
      .loading {
        position: relative;
        color: transparent !important;
      }
      
      .loading::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 16px;
        height: 16px;
        margin: -8px 0 0 -8px;
        border: 2px solid var(--color-primary);
        border-radius: 50%;
        border-top-color: transparent;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      /* Error States */
      .error-message {
        background: rgba(255, 107, 107, 0.1);
        border: 1px solid var(--color-danger);
        border-radius: 0.375rem;
        padding: 0.75rem;
        color: var(--color-danger);
        font-size: 0.875rem;
        margin: 1rem 0;
      }
      
      /* Success Messages */
      .success-message {
        background: rgba(0, 255, 65, 0.1);
        border: 1px solid var(--color-primary);
        border-radius: 0.375rem;
        padding: 0.75rem;
        color: var(--color-primary);
        font-size: 0.875rem;
        margin: 1rem 0;
      }
      
      /* Mobile Responsive */
      @media (max-width: 768px) {
        .terminal-form,
        .terminal-display {
          padding: 1rem;
        }
        
        .terminal-display__grid {
          grid-template-columns: 1fr;
        }
        
        .terminal-btn {
          width: 100%;
          margin-bottom: 0.5rem;
        }
      }
      
      /* Touch-friendly interactions */
      @media (pointer: coarse) {
        .terminal-btn {
          min-height: 44px;
          padding: 0.875rem 1.5rem;
        }
        
        .terminal-form__input {
          min-height: 44px;
          padding: 0.875rem;
        }
        
        .terminal-form__range::-webkit-slider-thumb {
          width: 24px;
          height: 24px;
        }
      }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  /**
   * Get current breakpoint
   * @returns {string} Current breakpoint
   */
  getCurrentBreakpoint() {
    return document.body.getAttribute('data-breakpoint') || 'sm';
  }

  /**
   * Check if mobile breakpoint
   * @returns {boolean} Whether current breakpoint is mobile
   */
  isMobile() {
    return ['sm'].includes(this.getCurrentBreakpoint());
  }

  /**
   * Check if tablet breakpoint
   * @returns {boolean} Whether current breakpoint is tablet
   */
  isTablet() {
    return ['md'].includes(this.getCurrentBreakpoint());
  }

  /**
   * Check if desktop breakpoint
   * @returns {boolean} Whether current breakpoint is desktop
   */
  isDesktop() {
    return ['lg', 'xl'].includes(this.getCurrentBreakpoint());
  }
}