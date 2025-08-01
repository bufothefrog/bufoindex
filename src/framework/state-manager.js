/**
 * State Manager - Reactive state with URL persistence
 * Handles form state, URL synchronization, and change notifications
 */

export class StateManager {
  constructor(defaults = {}) {
    this.defaults = defaults;
    this.state = { ...defaults };
    this.listeners = new Map();
    this.urlParams = new URLSearchParams();
    this.debounceTimer = null;
    
    // Listen for browser navigation
    window.addEventListener('hashchange', () => this.loadFromURL());
    window.addEventListener('popstate', () => this.loadFromURL());
  }

  /**
   * Subscribe to state changes
   * @param {string} key - State key to watch ('*' for all changes)
   * @param {Function} callback - Called when state changes
   */
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Update state and notify listeners
   * @param {string|Object} key - State key or object of key-value pairs
   * @param {*} value - New value (if key is string)
   * @param {boolean} skipURL - Skip URL update (for loading from URL)
   */
  setState(key, value, skipURL = false) {
    const changes = {};
    
    if (typeof key === 'object') {
      Object.assign(this.state, key);
      Object.assign(changes, key);
    } else {
      const oldValue = this.state[key];
      this.state[key] = value;
      changes[key] = { from: oldValue, to: value };
    }
    
    // Notify specific listeners
    Object.keys(changes).forEach(changedKey => {
      const callbacks = this.listeners.get(changedKey);
      if (callbacks) {
        callbacks.forEach(callback => callback(this.state[changedKey], changedKey));
      }
    });
    
    // Notify global listeners
    const globalCallbacks = this.listeners.get('*');
    if (globalCallbacks) {
      globalCallbacks.forEach(callback => callback(this.state, changes));
    }
    
    // Update URL (debounced)
    if (!skipURL) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.saveToURL(), 300);
    }
  }

  /**
   * Get state value
   * @param {string} key - State key
   * @returns {*} State value
   */
  getState(key) {
    return key ? this.state[key] : this.state;
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.setState({ ...this.defaults });
  }

  /**
   * Validate state values
   * @param {Object} validators - Object with validation functions
   * @returns {Object} Validation results
   */
  validate(validators) {
    const errors = {};
    const warnings = {};
    
    Object.entries(validators).forEach(([key, validator]) => {
      const value = this.state[key];
      const result = validator(value, this.state);
      
      if (result.error) {
        errors[key] = result.error;
      }
      if (result.warning) {
        warnings[key] = result.warning;
      }
    });
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings
    };
  }

  /**
   * Compress state to URL hash
   */
  saveToURL() {
    try {
      const compressed = this.compressState(this.state);
      const hash = btoa(JSON.stringify(compressed));
      
      const newURL = `${window.location.pathname}${window.location.search}#${hash}`;
      history.replaceState(null, '', newURL);
    } catch (error) {
      console.warn('Failed to save state to URL:', error);
    }
  }

  /**
   * Load state from URL hash
   */
  loadFromURL() {
    try {
      const hash = window.location.hash.slice(1);
      if (!hash) {
        this.setState({ ...this.defaults }, true);
        return;
      }
      
      const compressed = JSON.parse(atob(hash));
      const state = this.decompressState(compressed);
      const validatedState = this.validateStateValues(state);
      
      this.setState(validatedState, true);
    } catch (error) {
      console.warn('Failed to load state from URL:', error);
      this.setState({ ...this.defaults }, true);
    }
  }

  /**
   * Compress state for URL storage
   * @param {Object} state - State to compress
   * @returns {Object} Compressed state
   */
  compressState(state) {
    const compressed = {};
    
    Object.entries(state).forEach(([key, value]) => {
      // Skip default values to keep URL short
      if (value !== this.defaults[key]) {
        // Compress common patterns
        if (typeof value === 'number') {
          if (key.includes('Rate') || key.includes('Percent')) {
            compressed[key] = Math.round(value * 10000); // Store as basis points
          } else {
            compressed[key] = Math.round(value);
          }
        } else {
          compressed[key] = value;
        }
      }
    });
    
    return compressed;
  }

  /**
   * Decompress state from URL storage
   * @param {Object} compressed - Compressed state
   * @returns {Object} Decompressed state
   */
  decompressState(compressed) {
    const state = { ...this.defaults };
    
    Object.entries(compressed).forEach(([key, value]) => {
      if (typeof value === 'number' && (key.includes('Rate') || key.includes('Percent'))) {
        state[key] = value / 10000; // Convert from basis points
      } else {
        state[key] = value;
      }
    });
    
    return state;
  }

  /**
   * Validate state values against constraints
   * @param {Object} state - State to validate
   * @returns {Object} Validated state
   */
  validateStateValues(state) {
    const validated = {};
    
    Object.entries(state).forEach(([key, value]) => {
      const defaultValue = this.defaults[key];
      
      if (defaultValue !== undefined) {
        if (typeof defaultValue === 'number') {
          validated[key] = isNaN(value) ? defaultValue : Number(value);
        } else if (typeof defaultValue === 'string') {
          validated[key] = String(value || defaultValue);
        } else {
          validated[key] = value;
        }
      } else {
        validated[key] = value;
      }
    });
    
    return validated;
  }

  /**
   * Generate shareable URL
   * @returns {string} Complete shareable URL
   */
  getShareableURL() {
    this.saveToURL();
    return window.location.href;
  }
}