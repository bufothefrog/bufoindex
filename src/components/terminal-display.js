/**
 * Terminal Display Component
 * Data output component with terminal aesthetics and responsive layouts
 */

export class TerminalDisplay extends HTMLElement {
  constructor() {
    super();
    this.dataRows = [];
    this.charts = [];
    this.refreshInterval = null;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  disconnectedCallback() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  /**
   * Add data row to display
   * @param {Object} row - Row configuration
   */
  addDataRow(row) {
    this.dataRows.push({
      label: row.label,
      value: row.value,
      format: row.format || 'text',
      trend: row.trend || null, // 'up', 'down', 'neutral'
      status: row.status || null, // 'positive', 'negative', 'warning', 'info'
      action: row.action || null, // Optional click action
      id: row.id || row.label.toLowerCase().replace(/\s+/g, '-')
    });
  }

  /**
   * Add chart to display
   * @param {Object} chart - Chart configuration
   */
  addChart(chart) {
    this.charts.push({
      id: chart.id,
      title: chart.title,
      type: chart.type || 'line',
      data: chart.data || [],
      options: chart.options || {}
    });
  }

  /**
   * Update results data
   * @param {Object} results - New results data
   */
  updateResults(results) {
    // Update data rows
    this.dataRows.forEach(row => {
      if (typeof row.value === 'function') {
        const newValue = row.value(results);
        this.updateRowValue(row.id, newValue);
      } else if (results[row.id] !== undefined) {
        this.updateRowValue(row.id, results[row.id]);
      }
    });
    
    // Update charts
    this.charts.forEach(chart => {
      if (results[chart.id]) {
        this.updateChart(chart.id, results[chart.id]);
      }
    });
    
    // Trigger update animations
    this.animateUpdate();
  }

  /**
   * Render the display
   */
  render() {
    const title = this.getAttribute('title') || 'RESULTS';
    const layout = this.getAttribute('layout') || 'grid'; // 'grid', 'list', 'table'
    
    this.innerHTML = `
      <div class="terminal-display">
        <div class="terminal-display__header">
          <span class="terminal-display__title">[${title}]</span>
          <div class="terminal-display__controls">
            ${this.renderControls()}
          </div>
        </div>
        <div class="terminal-display__content">
          ${this.renderContent(layout)}
        </div>
      </div>
    `;
  }

  /**
   * Render display controls
   * @returns {string} HTML for controls
   */
  renderControls() {
    const showExport = this.hasAttribute('export');
    const showRefresh = this.hasAttribute('refresh');
    
    return `
      ${showRefresh ? '<button class="terminal-display__control" data-action="refresh">⟳</button>' : ''}
      ${showExport ? '<button class="terminal-display__control" data-action="export">↓</button>' : ''}
      <button class="terminal-display__control" data-action="fullscreen">⛶</button>
    `;
  }

  /**
   * Render content based on layout
   * @param {string} layout - Layout type
   * @returns {string} HTML for content
   */
  renderContent(layout) {
    switch (layout) {
      case 'table':
        return this.renderTableLayout();
      case 'list':
        return this.renderListLayout();
      case 'chart':
        return this.renderChartLayout();
      default:
        return this.renderGridLayout();
    }
  }

  /**
   * Render grid layout
   * @returns {string} HTML for grid layout
   */
  renderGridLayout() {
    return `
      <div class="terminal-display__grid">
        ${this.dataRows.map(row => `
          <div class="terminal-display__card" data-row-id="${row.id}">
            <div class="terminal-display__card-label">${row.label}</div>
            <div class="terminal-display__card-value ${this.getValueClasses(row)}">
              <span class="terminal-display__value" data-value="${row.id}">
                ${this.formatValue(row.value, row.format)}
              </span>
              ${row.trend ? `<span class="terminal-display__trend terminal-display__trend--${row.trend}">
                ${this.getTrendIcon(row.trend)}
              </span>` : ''}
            </div>
            ${row.action ? `<button class="terminal-display__card-action" data-action="${row.action}">VIEW</button>` : ''}
          </div>
        `).join('')}
        ${this.charts.map(chart => `
          <div class="terminal-display__chart-container" data-chart-id="${chart.id}">
            <h4 class="terminal-display__chart-title">${chart.title}</h4>
            <div class="terminal-display__chart" id="chart-${chart.id}"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render table layout
   * @returns {string} HTML for table layout
   */
  renderTableLayout() {
    return `
      <div class="terminal-display__table-container">
        <table class="terminal-display__table">
          <thead>
            <tr>
              <th class="terminal-display__th">METRIC</th>
              <th class="terminal-display__th">VALUE</th>
              <th class="terminal-display__th">TREND</th>
              <th class="terminal-display__th">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${this.dataRows.map(row => `
              <tr class="terminal-display__row" data-row-id="${row.id}">
                <td class="terminal-display__td terminal-display__td--label">${row.label}</td>
                <td class="terminal-display__td terminal-display__td--value ${this.getValueClasses(row)}">
                  <span data-value="${row.id}">${this.formatValue(row.value, row.format)}</span>
                </td>
                <td class="terminal-display__td terminal-display__td--trend">
                  ${row.trend ? `<span class="terminal-display__trend terminal-display__trend--${row.trend}">
                    ${this.getTrendIcon(row.trend)}
                  </span>` : '—'}
                </td>
                <td class="terminal-display__td terminal-display__td--action">
                  ${row.action ? `<button class="terminal-btn terminal-btn--ghost" data-action="${row.action}">VIEW</button>` : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render list layout
   * @returns {string} HTML for list layout
   */
  renderListLayout() {
    return `
      <div class="terminal-display__list">
        ${this.dataRows.map(row => `
          <div class="terminal-display__row" data-row-id="${row.id}">
            <div class="terminal-display__row-content">
              <div class="terminal-display__row-label">${row.label}</div>
              <div class="terminal-display__row-value ${this.getValueClasses(row)}">
                <span data-value="${row.id}">${this.formatValue(row.value, row.format)}</span>
                ${row.trend ? `<span class="terminal-display__trend terminal-display__trend--${row.trend}">
                  ${this.getTrendIcon(row.trend)}
                </span>` : ''}
              </div>
            </div>
            ${row.action ? `<button class="terminal-display__row-action" data-action="${row.action}">→</button>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render chart layout
   * @returns {string} HTML for chart layout
   */
  renderChartLayout() {
    return `
      <div class="terminal-display__charts">
        ${this.charts.map(chart => `
          <div class="terminal-display__chart-container" data-chart-id="${chart.id}">
            <h4 class="terminal-display__chart-title">${chart.title}</h4>
            <div class="terminal-display__chart" id="chart-${chart.id}"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Get CSS classes for value styling
   * @param {Object} row - Data row
   * @returns {string} CSS classes
   */
  getValueClasses(row) {
    const classes = ['terminal-display__value-wrapper'];
    
    if (row.status) {
      classes.push(`terminal-display__value--${row.status}`);
    }
    
    return classes.join(' ');
  }

  /**
   * Get trend icon
   * @param {string} trend - Trend direction
   * @returns {string} Trend icon
   */
  getTrendIcon(trend) {
    switch (trend) {
      case 'up': return '▲';
      case 'down': return '▼';
      case 'neutral': return '▶';
      default: return '';
    }
  }

  /**
   * Format value based on format type
   * @param {*} value - Value to format
   * @param {string} format - Format type
   * @returns {string} Formatted value
   */
  formatValue(value, format) {
    if (value === null || value === undefined) return '—';
    
    switch (format) {
      case 'currency':
        return '$' + Number(value).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        });
      
      case 'percentage':
        return (Number(value) * 100).toFixed(1) + '%';
      
      case 'decimal':
        return Number(value).toFixed(2);
      
      case 'integer':
        return Math.round(Number(value)).toLocaleString();
      
      case 'years':
        return Number(value).toFixed(1) + ' years';
      
      case 'boolean':
        return value ? 'YES' : 'NO';
      
      default:
        return String(value);
    }
  }

  /**
   * Update row value
   * @param {string} rowId - Row ID
   * @param {*} value - New value
   */
  updateRowValue(rowId, value) {
    const valueEl = this.querySelector(`[data-value="${rowId}"]`);
    if (valueEl) {
      const row = this.dataRows.find(r => r.id === rowId);
      if (row) {
        const formattedValue = this.formatValue(value, row.format);
        valueEl.textContent = formattedValue;
        
        // Add update animation
        valueEl.classList.add('terminal-display__value--updating');
        setTimeout(() => {
          valueEl.classList.remove('terminal-display__value--updating');
        }, 300);
      }
    }
  }

  /**
   * Update chart
   * @param {string} chartId - Chart ID
   * @param {Object} data - New chart data
   */
  updateChart(chartId, data) {
    // Chart implementation would depend on chart library (Chart.js, etc.)
    const chartContainer = this.querySelector(`#chart-${chartId}`);
    if (chartContainer) {
      // Simple ASCII chart for now
      this.renderASCIIChart(chartContainer, data);
    }
  }

  /**
   * Render simple ASCII chart
   * @param {HTMLElement} container - Chart container
   * @param {Object} data - Chart data
   */
  renderASCIIChart(container, data) {
    if (!data.values || !Array.isArray(data.values)) return;
    
    const max = Math.max(...data.values);
    const barWidth = Math.floor(40 / data.values.length);
    
    const chart = data.values.map((value, index) => {
      const height = Math.round((value / max) * 10);
      const bar = '█'.repeat(Math.max(1, height));
      const label = data.labels ? data.labels[index] : index;
      
      return `<div class="terminal-display__ascii-bar">
        <div class="terminal-display__ascii-value">${this.formatValue(value, data.format || 'integer')}</div>
        <div class="terminal-display__ascii-bar-visual">${bar}</div>
        <div class="terminal-display__ascii-label">${label}</div>
      </div>`;
    }).join('');
    
    container.innerHTML = `<div class="terminal-display__ascii-chart">${chart}</div>`;
  }

  /**
   * Animate update
   */
  animateUpdate() {
    this.classList.add('terminal-display--updating');
    setTimeout(() => {
      this.classList.remove('terminal-display--updating');
    }, 500);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Control button clicks
    this.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-action')) {
        const action = e.target.getAttribute('data-action');
        this.handleAction(action, e.target);
      }
    });
    
    // Listen for result updates
    document.addEventListener('bufo:results-updated', (e) => {
      this.updateResults(e.detail.results);
    });
  }

  /**
   * Handle action button clicks
   * @param {string} action - Action name
   * @param {HTMLElement} button - Button element
   */
  handleAction(action, button) {
    switch (action) {
      case 'refresh':
        this.refresh();
        break;
      case 'export':
        this.export();
        break;
      case 'fullscreen':
        this.toggleFullscreen();
        break;
      default:
        // Dispatch custom event for app to handle
        this.dispatchEvent(new CustomEvent('bufo:display-action', {
          detail: { action, button },
          bubbles: true
        }));
    }
  }

  /**
   * Refresh display
   */
  refresh() {
    this.dispatchEvent(new CustomEvent('bufo:refresh-requested', {
      bubbles: true
    }));
  }

  /**
   * Export display data
   */
  export() {
    const data = {
      title: this.getAttribute('title'),
      timestamp: new Date().toISOString(),
      data: this.dataRows.map(row => ({
        label: row.label,
        value: this.querySelector(`[data-value="${row.id}"]`)?.textContent || row.value,
        format: row.format
      }))
    };
    
    this.dispatchEvent(new CustomEvent('bufo:export-requested', {
      detail: { data },
      bubbles: true
    }));
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    this.classList.toggle('terminal-display--fullscreen');
    
    if (this.classList.contains('terminal-display--fullscreen')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  /**
   * Set auto-refresh interval
   * @param {number} interval - Refresh interval in milliseconds
   */
  setAutoRefresh(interval) {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    if (interval > 0) {
      this.refreshInterval = setInterval(() => {
        this.refresh();
      }, interval);
    }
  }

  /**
   * Clear all data
   */
  clear() {
    this.dataRows = [];
    this.charts = [];
    this.render();
  }

  /**
   * Get display data
   * @returns {Object} Current display data
   */
  getData() {
    return {
      rows: this.dataRows,
      charts: this.charts
    };
  }
}

// Register custom element
customElements.define('terminal-display', TerminalDisplay);