/**
 * Terminal Form Component
 * Smart form component with validation, state binding, and terminal aesthetics
 */

export class TerminalForm extends HTMLElement {
  constructor() {
    super();
    this.sections = [];
    this.validators = {};
    this.formatters = {};
    this.stateManager = null;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  /**
   * Set state manager for automatic binding
   * @param {StateManager} stateManager - State manager instance
   */
  setStateManager(stateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Add form section
   * @param {Object} section - Section configuration
   */
  addSection(section) {
    this.sections.push({
      title: section.title,
      fields: section.fields || [],
      collapsible: section.collapsible || false,
      collapsed: section.collapsed || false
    });
  }

  /**
   * Add field validator
   * @param {string} fieldName - Field name
   * @param {Function} validator - Validation function
   */
  addValidator(fieldName, validator) {
    this.validators[fieldName] = validator;
  }

  /**
   * Add field formatter
   * @param {string} fieldName - Field name
   * @param {Function} formatter - Formatting function
   */
  addFormatter(fieldName, formatter) {
    this.formatters[fieldName] = formatter;
  }

  /**
   * Render the form
   */
  render() {
    const title = this.getAttribute('title') || 'CONFIGURATION';
    
    this.innerHTML = `
      <div class="terminal-form">
        <div class="terminal-form__header">
          <span class="terminal-form__title">[${title}]</span>
        </div>
        <div class="terminal-form__content">
          ${this.renderSections()}
        </div>
      </div>
    `;
  }

  /**
   * Render form sections
   * @returns {string} HTML for sections
   */
  renderSections() {
    return this.sections.map(section => `
      <div class="terminal-form__section" data-section="${section.title}">
        ${section.title ? `
          <h3 class="terminal-form__section-title ${section.collapsible ? 'collapsible' : ''}" 
              ${section.collapsible ? 'data-toggle="' + section.title + '"' : ''}>
            <span class="terminal-form__section-bracket">[</span>
            ${section.title}
            <span class="terminal-form__section-bracket">]</span>
            ${section.collapsible ? '<span class="terminal-form__section-arrow">▼</span>' : ''}
          </h3>
        ` : ''}
        <div class="terminal-form__section-content ${section.collapsed ? 'collapsed' : ''}" 
             ${section.collapsible ? 'data-content="' + section.title + '"' : ''}>
          ${this.renderFields(section.fields)}
        </div>
      </div>
    `).join('');
  }

  /**
   * Render form fields
   * @param {Array} fields - Array of field configurations
   * @returns {string} HTML for fields
   */
  renderFields(fields) {
    return fields.map(field => {
      switch (field.type) {
        case 'currency':
          return this.renderCurrencyField(field);
        case 'percentage':
          return this.renderPercentageField(field);
        case 'range':
          return this.renderRangeField(field);
        case 'select':
          return this.renderSelectField(field);
        case 'number':
          return this.renderNumberField(field);
        case 'checkbox':
          return this.renderCheckboxField(field);
        default:
          return this.renderTextField(field);
      }
    }).join('');
  }

  /**
   * Render currency input field
   * @param {Object} field - Field configuration
   * @returns {string} HTML for currency field
   */
  renderCurrencyField(field) {
    return `
      <div class="terminal-form__field" data-field="${field.name}">
        <label class="terminal-form__label" for="${field.name}">
          ${field.label}
        </label>
        <div class="terminal-form__input-group">
          <span class="terminal-form__input-prefix">$</span>
          <input 
            type="text" 
            id="${field.name}"
            name="${field.name}"
            class="terminal-form__input terminal-form__input--currency"
            data-state-key="${field.name}"
            data-type="currency"
            placeholder="${field.placeholder || '0'}"
            value="${field.defaultValue || ''}"
            ${field.required ? 'required' : ''}
          />
        </div>
        ${this.renderFieldMeta(field)}
      </div>
    `;
  }

  /**
   * Render percentage input field
   * @param {Object} field - Field configuration
   * @returns {string} HTML for percentage field
   */
  renderPercentageField(field) {
    return `
      <div class="terminal-form__field" data-field="${field.name}">
        <label class="terminal-form__label" for="${field.name}">
          ${field.label}
        </label>
        <div class="terminal-form__input-group">
          <input 
            type="number" 
            id="${field.name}"
            name="${field.name}"
            class="terminal-form__input terminal-form__input--percentage"
            data-state-key="${field.name}"
            data-type="percentage"
            min="${field.min || 0}"
            max="${field.max || 100}"
            step="${field.step || 0.1}"
            placeholder="${field.placeholder || '0.0'}"
            value="${field.defaultValue || ''}"
            ${field.required ? 'required' : ''}
          />
          <span class="terminal-form__input-suffix">%</span>
        </div>
        ${this.renderFieldMeta(field)}
      </div>
    `;
  }

  /**
   * Render range slider field
   * @param {Object} field - Field configuration
   * @returns {string} HTML for range field
   */
  renderRangeField(field) {
    return `
      <div class="terminal-form__field" data-field="${field.name}">
        <label class="terminal-form__label" for="${field.name}">
          ${field.label}
          <span class="terminal-form__range-value" id="${field.name}-display">
            ${field.defaultValue || field.min || 0}${field.suffix || ''}
          </span>
        </label>
        <input 
          type="range" 
          id="${field.name}"
          name="${field.name}"
          class="terminal-form__range"
          data-state-key="${field.name}"
          data-type="${field.dataType || 'number'}"
          data-suffix="${field.suffix || ''}"
          min="${field.min || 0}"
          max="${field.max || 100}"
          step="${field.step || 1}"
          value="${field.defaultValue || field.min || 0}"
        />
        <div class="terminal-form__range-labels">
          <span class="terminal-form__range-min">${field.min || 0}${field.suffix || ''}</span>
          <span class="terminal-form__range-max">${field.max || 100}${field.suffix || ''}</span>
        </div>
        ${this.renderFieldMeta(field)}
      </div>
    `;
  }

  /**
   * Render select field
   * @param {Object} field - Field configuration
   * @returns {string} HTML for select field
   */
  renderSelectField(field) {
    const options = field.options || [];
    
    return `
      <div class="terminal-form__field" data-field="${field.name}">
        <label class="terminal-form__label" for="${field.name}">
          ${field.label}
        </label>
        <select 
          id="${field.name}"
          name="${field.name}"
          class="terminal-form__input terminal-form__select"
          data-state-key="${field.name}"
          ${field.required ? 'required' : ''}
        >
          ${options.map(option => `
            <option value="${option.value}" ${option.value === field.defaultValue ? 'selected' : ''}>
              ${option.label}
            </option>
          `).join('')}
        </select>
        ${this.renderFieldMeta(field)}
      </div>
    `;
  }

  /**
   * Render number input field
   * @param {Object} field - Field configuration
   * @returns {string} HTML for number field
   */
  renderNumberField(field) {
    return `
      <div class="terminal-form__field" data-field="${field.name}">
        <label class="terminal-form__label" for="${field.name}">
          ${field.label}
        </label>
        <input 
          type="number" 
          id="${field.name}"
          name="${field.name}"
          class="terminal-form__input terminal-form__input--number"
          data-state-key="${field.name}"
          min="${field.min !== undefined ? field.min : ''}"
          max="${field.max !== undefined ? field.max : ''}"
          step="${field.step || 1}"
          placeholder="${field.placeholder || ''}"
          value="${field.defaultValue || ''}"
          ${field.required ? 'required' : ''}
        />
        ${this.renderFieldMeta(field)}
      </div>
    `;
  }

  /**
   * Render checkbox field
   * @param {Object} field - Field configuration
   * @returns {string} HTML for checkbox field
   */
  renderCheckboxField(field) {
    return `
      <div class="terminal-form__field terminal-form__field--checkbox" data-field="${field.name}">
        <label class="terminal-form__checkbox-label">
          <input 
            type="checkbox" 
            id="${field.name}"
            name="${field.name}"
            class="terminal-form__checkbox"
            data-state-key="${field.name}"
            ${field.defaultValue ? 'checked' : ''}
          />
          <span class="terminal-form__checkbox-indicator"></span>
          <span class="terminal-form__checkbox-text">${field.label}</span>
        </label>
        ${this.renderFieldMeta(field)}
      </div>
    `;
  }

  /**
   * Render text input field
   * @param {Object} field - Field configuration
   * @returns {string} HTML for text field
   */
  renderTextField(field) {
    return `
      <div class="terminal-form__field" data-field="${field.name}">
        <label class="terminal-form__label" for="${field.name}">
          ${field.label}
        </label>
        <input 
          type="text" 
          id="${field.name}"
          name="${field.name}"
          class="terminal-form__input"
          data-state-key="${field.name}"
          placeholder="${field.placeholder || ''}"
          value="${field.defaultValue || ''}"
          ${field.required ? 'required' : ''}
        />
        ${this.renderFieldMeta(field)}
      </div>
    `;
  }

  /**
   * Render field metadata (help text, error display)
   * @param {Object} field - Field configuration
   * @returns {string} HTML for field metadata
   */
  renderFieldMeta(field) {
    return `
      ${field.help ? `<div class="terminal-form__help">${field.help}</div>` : ''}
      <div class="terminal-form__error hidden" id="${field.name}-error"></div>
    `;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Input change handlers
    this.addEventListener('input', this.handleInput.bind(this));
    this.addEventListener('change', this.handleChange.bind(this));
    
    // Range slider display updates
    this.addEventListener('input', (e) => {
      if (e.target.type === 'range') {
        this.updateRangeDisplay(e.target);
      }
    });
    
    // Currency formatting
    this.addEventListener('blur', (e) => {
      if (e.target.classList.contains('terminal-form__input--currency')) {
        this.formatCurrencyInput(e.target);
      }
    });
    
    // Collapsible sections
    this.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-toggle')) {
        this.toggleSection(e.target.getAttribute('data-toggle'));
      }
    });
  }

  /**
   * Handle input events
   * @param {Event} event - Input event
   */
  handleInput(event) {
    const field = event.target;
    const fieldName = field.getAttribute('data-state-key');
    
    if (fieldName && this.stateManager) {
      const value = this.parseFieldValue(field);
      this.stateManager.setState(fieldName, value);
    }
    
    // Clear any existing errors
    this.clearFieldError(fieldName);
  }

  /**
   * Handle change events
   * @param {Event} event - Change event
   */
  handleChange(event) {
    const field = event.target;
    const fieldName = field.getAttribute('data-state-key');
    
    if (fieldName) {
      // Validate field
      this.validateField(fieldName, field);
    }
  }

  /**
   * Parse field value based on type
   * @param {HTMLElement} field - Form field
   * @returns {*} Parsed value
   */
  parseFieldValue(field) {
    const type = field.getAttribute('data-type');
    const rawValue = field.value;
    
    switch (type) {
      case 'currency':
        return parseFloat(rawValue.replace(/[$,]/g, '')) || 0;
      case 'percentage':
        return parseFloat(rawValue) / 100;
      case 'number':
        return parseFloat(rawValue) || 0;
      default:
        if (field.type === 'checkbox') {
          return field.checked;
        }
        if (field.type === 'number' || field.type === 'range') {
          return parseFloat(rawValue) || 0;
        }
        return rawValue;
    }
  }

  /**
   * Update range slider display
   * @param {HTMLElement} range - Range input
   */
  updateRangeDisplay(range) {
    const displayId = range.id + '-display';
    const display = document.getElementById(displayId);
    
    if (display) {
      let value = range.value;
      const suffix = range.getAttribute('data-suffix') || '';
      const type = range.getAttribute('data-type');
      
      if (type === 'percentage') {
        value = parseFloat(value).toFixed(1) + '%';
      } else if (type === 'currency') {
        value = '$' + parseInt(value).toLocaleString();
      } else {
        value = value + suffix;
      }
      
      display.textContent = value;
    }
  }

  /**
   * Format currency input
   * @param {HTMLElement} input - Currency input
   */
  formatCurrencyInput(input) {
    const value = parseFloat(input.value.replace(/[$,]/g, ''));
    if (!isNaN(value)) {
      input.value = value.toLocaleString();
    }
  }

  /**
   * Validate field
   * @param {string} fieldName - Field name
   * @param {HTMLElement} field - Form field
   */
  validateField(fieldName, field) {
    const validator = this.validators[fieldName];
    if (!validator) return;
    
    const value = this.parseFieldValue(field);
    const result = validator(value);
    
    if (result.error) {
      this.showFieldError(fieldName, result.error);
    } else {
      this.clearFieldError(fieldName);
    }
  }

  /**
   * Show field error
   * @param {string} fieldName - Field name
   * @param {string} message - Error message
   */
  showFieldError(fieldName, message) {
    const field = this.querySelector(`[data-state-key="${fieldName}"]`);
    const errorEl = document.getElementById(`${fieldName}-error`);
    
    if (field) {
      field.classList.add('terminal-form__input--error');
    }
    
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  /**
   * Clear field error
   * @param {string} fieldName - Field name
   */
  clearFieldError(fieldName) {
    const field = this.querySelector(`[data-state-key="${fieldName}"]`);
    const errorEl = document.getElementById(`${fieldName}-error`);
    
    if (field) {
      field.classList.remove('terminal-form__input--error');
    }
    
    if (errorEl) {
      errorEl.classList.add('hidden');
    }
  }

  /**
   * Toggle collapsible section
   * @param {string} sectionName - Section name
   */
  toggleSection(sectionName) {
    const content = this.querySelector(`[data-content="${sectionName}"]`);
    const arrow = this.querySelector(`[data-toggle="${sectionName}"] .terminal-form__section-arrow`);
    
    if (content && arrow) {
      const isCollapsed = content.classList.contains('collapsed');
      content.classList.toggle('collapsed');
      arrow.textContent = isCollapsed ? '▼' : '▶';
    }
  }

  /**
   * Get form data
   * @returns {Object} Form data
   */
  getFormData() {
    const data = {};
    const fields = this.querySelectorAll('[data-state-key]');
    
    fields.forEach(field => {
      const key = field.getAttribute('data-state-key');
      data[key] = this.parseFieldValue(field);
    });
    
    return data;
  }

  /**
   * Set form data
   * @param {Object} data - Data to populate form
   */
  setFormData(data) {
    Object.entries(data).forEach(([key, value]) => {
      const field = this.querySelector(`[data-state-key="${key}"]`);
      if (field) {
        this.setFieldValue(field, value);
      }
    });
  }

  /**
   * Set field value
   * @param {HTMLElement} field - Form field
   * @param {*} value - Value to set
   */
  setFieldValue(field, value) {
    const type = field.getAttribute('data-type');
    
    if (field.type === 'checkbox') {
      field.checked = Boolean(value);
    } else if (type === 'percentage') {
      field.value = (value * 100).toFixed(1);
    } else if (type === 'currency') {
      field.value = value.toLocaleString();
    } else {
      field.value = value;
    }
    
    // Update range display if applicable
    if (field.type === 'range') {
      this.updateRangeDisplay(field);
    }
  }
}

// Register custom element
customElements.define('terminal-form', TerminalForm);