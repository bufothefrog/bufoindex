/**
 * Error Logger for Retirement Calculator
 * Provides centralized error handling, dependency tracking, and debugging capabilities
 */

class ErrorLogger {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.dependencyStatus = {};
        this.initializationStatus = {};
        this.startTime = Date.now();
        this.debugMode = this.isDebugMode();
        
        // Set up global error handler
        this.setupGlobalErrorHandler();
        
        // Create debug panel if in debug mode
        if (this.debugMode) {
            this.createDebugPanel();
        }
    }
    
    /**
     * Check if debug mode is enabled
     */
    isDebugMode() {
        return window.location.search.includes('debug=true');
    }
    
    /**
     * Set up global error handler to catch all JavaScript errors
     */
    setupGlobalErrorHandler() {
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'RUNTIME_ERROR',
                message: event.message,
                file: event.filename,
                line: event.lineno,
                column: event.colno,
                stack: event.error?.stack,
                timestamp: new Date().toISOString()
            });
            
            // Prevent default error handling in debug mode
            if (this.debugMode) {
                event.preventDefault();
            }
        });
        
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'PROMISE_REJECTION',
                message: event.reason?.message || event.reason,
                stack: event.reason?.stack,
                timestamp: new Date().toISOString()
            });
        });
    }
    
    /**
     * Log an error
     */
    logError(error) {
        this.errors.push(error);
        
        // Console output with styling
        console.error(
            `%c[ERROR] ${error.type || 'GENERAL'}%c ${error.message}`,
            'background: #ff0000; color: white; padding: 2px 4px; border-radius: 2px;',
            'color: #ff0000;'
        );
        
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        
        // Update debug panel if available
        this.updateDebugPanel();
        
        // Notify UI if critical error
        if (this.isCriticalError(error)) {
            this.showErrorInUI(error);
        }
    }
    
    /**
     * Log a warning
     */
    logWarning(warning) {
        this.warnings.push(warning);
        
        console.warn(
            `%c[WARNING]%c ${warning.message}`,
            'background: #ff9800; color: white; padding: 2px 4px; border-radius: 2px;',
            'color: #ff9800;'
        );
        
        this.updateDebugPanel();
    }
    
    /**
     * Log successful operations
     */
    logSuccess(message, details = {}) {
        if (this.debugMode) {
            console.log(
                `%c[SUCCESS]%c ${message}`,
                'background: #4caf50; color: white; padding: 2px 4px; border-radius: 2px;',
                'color: #4caf50;',
                details
            );
        }
        
        this.updateDebugPanel();
    }
    
    /**
     * Track dependency loading status
     */
    trackDependency(name, status, details = {}) {
        this.dependencyStatus[name] = {
            status,
            details,
            timestamp: Date.now() - this.startTime
        };
        
        const statusColors = {
            'loading': '#2196f3',
            'loaded': '#4caf50',
            'failed': '#f44336',
            'missing': '#ff9800'
        };
        
        console.log(
            `%c[DEPENDENCY]%c ${name}: ${status}`,
            `background: ${statusColors[status]}; color: white; padding: 2px 4px; border-radius: 2px;`,
            `color: ${statusColors[status]};`,
            details
        );
        
        this.updateDebugPanel();
    }
    
    /**
     * Track component initialization
     */
    trackInitialization(component, status, details = {}) {
        this.initializationStatus[component] = {
            status,
            details,
            timestamp: Date.now() - this.startTime
        };
        
        this.logSuccess(`Component ${component} ${status}`, details);
        this.updateDebugPanel();
    }
    
    /**
     * Check if all required dependencies are loaded
     */
    checkDependencies(required) {
        const results = {
            allLoaded: true,
            missing: [],
            failed: []
        };
        
        required.forEach(dep => {
            // Check if the dependency exists in window
            const exists = this.resolveDependency(dep);
            
            if (!exists) {
                results.allLoaded = false;
                results.missing.push(dep);
                this.trackDependency(dep, 'missing');
            } else {
                this.trackDependency(dep, 'loaded', { type: typeof exists });
            }
        });
        
        // Check for duplicates
        this.checkForDuplicates();
        
        return results;
    }
    
    /**
     * Resolve dependency from window object
     */
    resolveDependency(path) {
        const parts = path.split('.');
        let current = window;
        
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return null;
            }
        }
        
        return current;
    }
    
    /**
     * Check for duplicate declarations
     */
    checkForDuplicates() {
        // This would need to be called before scripts load to be effective
        // For now, we'll check if certain globals were already defined
        const globals = ['FinancialCalculations', 'URLStateManager', 'ExportUtility', 'RetirementCalculator'];
        
        globals.forEach(global => {
            if (window[global] && window[`__${global}_duplicate`]) {
                this.logWarning({
                    message: `Duplicate declaration detected for ${global}`,
                    type: 'DUPLICATE_DECLARATION'
                });
            }
        });
    }
    
    /**
     * Determine if error is critical
     */
    isCriticalError(error) {
        const criticalTypes = ['SYNTAX_ERROR', 'DEPENDENCY_MISSING', 'INITIALIZATION_FAILED'];
        const criticalKeywords = ['undefined', 'null', 'Cannot read', 'is not a function'];
        
        return criticalTypes.includes(error.type) ||
               criticalKeywords.some(keyword => error.message?.includes(keyword));
    }
    
    /**
     * Show error in UI
     */
    showErrorInUI(error) {
        // Find calculator container
        const calculator = document.querySelector('.retirement-calculator');
        if (!calculator) return;
        
        // Check if error display already exists
        let errorDisplay = document.getElementById('calculator-error-display');
        if (!errorDisplay) {
            errorDisplay = document.createElement('div');
            errorDisplay.id = 'calculator-error-display';
            errorDisplay.className = 'bg-red-900 border border-red-400 text-red-200 p-4 mb-4 rounded font-mono text-sm';
            calculator.insertBefore(errorDisplay, calculator.firstChild);
        }
        
        errorDisplay.innerHTML = `
            <div class="font-bold mb-2">⚠️ CALCULATOR ERROR</div>
            <div>${error.message}</div>
            ${error.file ? `<div class="text-xs mt-1 subtitle-text">${error.file}:${error.line}:${error.column}</div>` : ''}
            <div class="text-xs mt-2">Check console for details</div>
        `;
    }
    
    /**
     * Create debug panel for development
     */
    createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 400px;
            max-height: 500px;
            background: #000;
            border: 2px solid #00ff41;
            color: #00ff41;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            overflow-y: auto;
            z-index: 10000;
            box-shadow: 0 0 20px rgba(0, 255, 65, 0.5);
        `;
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="font-weight: bold;">DEBUG CONSOLE</div>
                <button onclick="document.getElementById('debug-panel').remove()" style="background: none; border: none; color: #00ff41; cursor: pointer;">✕</button>
            </div>
            <div id="debug-content"></div>
        `;
        
        document.body.appendChild(panel);
        this.updateDebugPanel();
    }
    
    /**
     * Update debug panel content
     */
    updateDebugPanel() {
        const content = document.getElementById('debug-content');
        if (!content) return;
        
        const html = `
            <div style="margin-bottom: 10px;">
                <strong>ERRORS: ${this.errors.length}</strong> | 
                <strong>WARNINGS: ${this.warnings.length}</strong> | 
                <strong>TIME: ${((Date.now() - this.startTime) / 1000).toFixed(2)}s</strong>
            </div>
            
            <div style="margin-bottom: 10px;">
                <div style="font-weight: bold; margin-bottom: 5px;">DEPENDENCIES:</div>
                ${Object.entries(this.dependencyStatus).map(([name, status]) => `
                    <div style="color: ${this.getStatusColor(status.status)};">
                        • ${name}: ${status.status} (${status.timestamp}ms)
                    </div>
                `).join('')}
            </div>
            
            <div style="margin-bottom: 10px;">
                <div style="font-weight: bold; margin-bottom: 5px;">INITIALIZATION:</div>
                ${Object.entries(this.initializationStatus).map(([component, status]) => `
                    <div style="color: ${this.getStatusColor(status.status)};">
                        • ${component}: ${status.status} (${status.timestamp}ms)
                    </div>
                `).join('')}
            </div>
            
            ${this.errors.length > 0 ? `
                <div style="margin-bottom: 10px;">
                    <div style="font-weight: bold; margin-bottom: 5px; color: #ff0000;">RECENT ERRORS:</div>
                    ${this.errors.slice(-3).map(error => `
                        <div style="color: #ff6666; margin-bottom: 5px;">
                            ${error.type}: ${error.message}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
        
        content.innerHTML = html;
    }
    
    /**
     * Get color for status
     */
    getStatusColor(status) {
        const colors = {
            'loaded': '#4caf50',
            'initialized': '#4caf50',
            'loading': '#2196f3',
            'failed': '#f44336',
            'missing': '#ff9800',
            'error': '#f44336'
        };
        
        return colors[status] || '#00ff41';
    }
    
    /**
     * Export error log for debugging
     */
    exportLog() {
        const log = {
            timestamp: new Date().toISOString(),
            duration: Date.now() - this.startTime,
            errors: this.errors,
            warnings: this.warnings,
            dependencies: this.dependencyStatus,
            initialization: this.initializationStatus,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        return log;
    }
}

// Initialize error logger as soon as possible
window.calculatorErrorLogger = new ErrorLogger();

// Export for use in other modules
window.ErrorLogger = ErrorLogger;