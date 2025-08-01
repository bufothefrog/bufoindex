/**
 * App Controller - Main orchestrator for financial tools
 * Coordinates state, UI, calculations, and worker management
 */

import { StateManager } from './state-manager.js';
import { WorkerPool } from './worker-pool.js';

export class AppController {
  constructor(config) {
    this.config = {
      name: 'BufoTool',
      version: '2.0.0',
      workerPath: null,
      autoCalculate: true,
      debounceMs: 500,
      ...config
    };
    
    this.state = new StateManager(config.defaults || {});
    this.workers = new WorkerPool();
    this.engine = null;
    this.isCalculating = false;
    this.lastCalculation = null;
    
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    // Load engine if provided
    if (this.config.engineClass) {
      this.engine = new this.config.engineClass();
    }
    
    // Setup worker pool if path provided
    if (this.config.workerPath) {
      await this.workers.initialize(this.config.workerPath, this.config.maxWorkers || 2);
    }
    
    // Load initial state from URL
    this.state.loadFromURL();
    
    // Setup auto-calculation
    if (this.config.autoCalculate) {
      this.state.subscribe('*', () => this.scheduleCalculation());
    }
    
    // Setup UI event listeners
    this.setupUIListeners();
    
    // Initial calculation
    if (this.config.autoCalculate) {
      this.calculate();
    }
    
    console.log(`🚀 ${this.config.name} initialized`);
  }

  /**
   * Setup UI event listeners for forms and controls
   */
  setupUIListeners() {
    // Form input handling
    document.addEventListener('input', (e) => {
      if (e.target.matches('[data-state-key]')) {
        const key = e.target.dataset.stateKey;
        const value = this.parseInputValue(e.target);
        this.state.setState(key, value);
      }
    });
    
    // Range slider handling
    document.addEventListener('input', (e) => {
      if (e.target.matches('input[type="range"][data-state-key]')) {
        this.updateRangeDisplay(e.target);
      }
    });
    
    // Preset buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-preset]')) {
        const presetName = e.target.dataset.preset;
        this.applyPreset(presetName);
      }
    });
    
    // Action buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-action]')) {
        const action = e.target.dataset.action;
        this.handleAction(action, e.target);
      }
    });
  }

  /**
   * Parse input value based on type and attributes
   * @param {HTMLElement} input - Input element
   * @returns {*} Parsed value
   */
  parseInputValue(input) {
    const type = input.type;
    const rawValue = input.value;
    
    if (type === 'number' || type === 'range') {
      const value = parseFloat(rawValue);
      
      // Handle percentage inputs (convert to decimal)
      if (input.dataset.type === 'percentage') {
        return value / 100;
      }
      
      // Handle currency inputs (remove formatting)
      if (input.dataset.type === 'currency') {
        return parseFloat(rawValue.replace(/[$,]/g, '')) || 0;
      }
      
      return isNaN(value) ? 0 : value;
    }
    
    if (type === 'checkbox') {
      return input.checked;
    }
    
    return rawValue;
  }

  /**
   * Update range slider display value
   * @param {HTMLElement} range - Range input
   */
  updateRangeDisplay(range) {
    const displayId = range.id + '-display';
    const display = document.getElementById(displayId);
    
    if (display) {
      let value = range.value;
      
      if (range.dataset.type === 'percentage') {
        value = parseFloat(value).toFixed(1) + '%';
      } else if (range.dataset.type === 'currency') {
        value = '$' + parseInt(value).toLocaleString();
      } else if (range.dataset.suffix) {
        value = value + range.dataset.suffix;
      }
      
      display.textContent = value;
    }
  }

  /**
   * Apply preset configuration
   * @param {string} presetName - Name of preset to apply
   */
  applyPreset(presetName) {
    const presets = this.config.presets || {};
    const preset = presets[presetName];
    
    if (preset) {
      this.state.setState(preset);
      this.showMessage(`Applied ${presetName} preset`);
    }
  }

  /**
   * Handle action button clicks
   * @param {string} action - Action name
   * @param {HTMLElement} button - Button element
   */
  async handleAction(action, button) {
    switch (action) {
      case 'share':
        await this.shareResults();
        break;
      case 'export-csv':
        this.exportResults('csv');
        break;
      case 'export-json':
        this.exportResults('json');
        break;
      case 'reset':
        this.reset();
        break;
      case 'calculate':
        this.calculate();
        break;
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }

  /**
   * Schedule calculation with debouncing
   */
  scheduleCalculation() {
    if (this.calculationTimer) {
      clearTimeout(this.calculationTimer);
    }
    
    this.calculationTimer = setTimeout(() => {
      this.calculate();
    }, this.config.debounceMs);
  }

  /**
   * Perform calculation
   */
  async calculate() {
    if (this.isCalculating || !this.engine) return;
    
    this.isCalculating = true;
    this.showLoading(true);
    
    try {
      const params = this.state.getState();
      
      // Validate inputs
      if (this.config.validators) {
        const validation = this.state.validate(this.config.validators);
        if (!validation.isValid) {
          this.showValidationErrors(validation.errors);
          return;
        }
      }
      
      // Use worker for heavy calculations
      let results;
      if (this.config.useWorker && this.workers.isReady()) {
        results = await this.workers.execute('calculate', params);
      } else {
        results = await this.engine.calculate(params);
      }
      
      this.lastCalculation = {
        params: { ...params },
        results,
        timestamp: Date.now()
      };
      
      // Update UI
      this.updateResults(results);
      this.hideValidationErrors();
      
    } catch (error) {
      console.error('Calculation error:', error);
      this.showError('Calculation failed. Please check your inputs.');
    } finally {
      this.isCalculating = false;
      this.showLoading(false);
    }
  }

  /**
   * Update UI with calculation results
   * @param {Object} results - Calculation results
   */
  updateResults(results) {
    // Dispatch custom event for result updates
    const event = new CustomEvent('bufo:results-updated', {
      detail: { results, params: this.lastCalculation.params }
    });
    document.dispatchEvent(event);
    
    // Update terminal displays
    const displays = document.querySelectorAll('terminal-display');
    displays.forEach(display => {
      if (display.updateResults) {
        display.updateResults(results);
      }
    });
  }

  /**
   * Share results via Web Share API or clipboard
   */
  async shareResults() {
    const url = this.state.getShareableURL();
    const shareData = {
      title: `${this.config.name} - Financial Analysis`,
      url: url
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        this.showMessage('Shared successfully!');
      } catch (error) {
        if (error.name !== 'AbortError') {
          this.fallbackShare(url);
        }
      }
    } else {
      this.fallbackShare(url);
    }
  }

  /**
   * Fallback share method using clipboard
   * @param {string} url - URL to share
   */
  async fallbackShare(url) {
    try {
      await navigator.clipboard.writeText(url);
      this.showMessage('URL copied to clipboard!');
    } catch (error) {
      // Final fallback - show URL in prompt
      prompt('Copy this URL to share:', url);
    }
  }

  /**
   * Export results in specified format
   * @param {string} format - Export format ('csv' or 'json')
   */
  exportResults(format) {
    if (!this.lastCalculation) {
      this.showMessage('No results to export. Run calculation first.');
      return;
    }
    
    const { params, results } = this.lastCalculation;
    const filename = `${this.config.name.toLowerCase()}-${Date.now()}`;
    
    if (format === 'csv') {
      this.exportCSV(params, results, filename);
    } else if (format === 'json') {
      this.exportJSON(params, results, filename);
    }
    
    this.showMessage(`Results exported as ${format.toUpperCase()}`);
  }

  /**
   * Export as CSV
   * @param {Object} params - Input parameters
   * @param {Object} results - Calculation results
   * @param {string} filename - Base filename
   */
  exportCSV(params, results, filename) {
    // Implementation depends on specific tool
    console.log('CSV export not implemented for this tool');
  }

  /**
   * Export as JSON
   * @param {Object} params - Input parameters
   * @param {Object} results - Calculation results
   * @param {string} filename - Base filename
   */
  exportJSON(params, results, filename) {
    const data = {
      metadata: {
        tool: this.config.name,
        version: this.config.version,
        timestamp: new Date().toISOString()
      },
      parameters: params,
      results: results
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, `${filename}.json`);
  }

  /**
   * Download blob as file
   * @param {Blob} blob - Data blob
   * @param {string} filename - Filename
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.state.reset();
    this.showMessage('Reset to defaults');
  }

  /**
   * Show loading state
   * @param {boolean} show - Whether to show loading
   */
  showLoading(show) {
    const loadingEls = document.querySelectorAll('[data-loading]');
    loadingEls.forEach(el => {
      el.classList.toggle('hidden', !show);
    });
    
    const contentEls = document.querySelectorAll('[data-loading-hide]');
    contentEls.forEach(el => {
      el.classList.toggle('hidden', show);
    });
  }

  /**
   * Show validation errors
   * @param {Object} errors - Validation errors
   */
  showValidationErrors(errors) {
    Object.entries(errors).forEach(([key, message]) => {
      const input = document.querySelector(`[data-state-key="${key}"]`);
      if (input) {
        input.classList.add('border-red-500');
        
        // Show error message
        const errorEl = document.getElementById(`${key}-error`);
        if (errorEl) {
          errorEl.textContent = message;
          errorEl.classList.remove('hidden');
        }
      }
    });
  }

  /**
   * Hide validation errors
   */
  hideValidationErrors() {
    const inputs = document.querySelectorAll('[data-state-key]');
    inputs.forEach(input => {
      input.classList.remove('border-red-500');
    });
    
    const errorEls = document.querySelectorAll('[id$="-error"]');
    errorEls.forEach(el => {
      el.classList.add('hidden');
    });
  }

  /**
   * Show message to user
   * @param {string} message - Message to show
   * @param {string} type - Message type ('info', 'success', 'warning', 'error')
   */
  showMessage(message, type = 'info') {
    const messageEl = document.getElementById('message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.className = `message message-${type}`;
      messageEl.classList.remove('hidden');
      
      setTimeout(() => {
        messageEl.classList.add('hidden');
      }, 3000);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.showMessage(message, 'error');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.calculationTimer) {
      clearTimeout(this.calculationTimer);  
    }
    
    this.workers.terminate();
  }
}