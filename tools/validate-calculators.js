#!/usr/bin/env node

/**
 * Build-time validation for retirement calculator
 * Checks for common errors before deployment
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

let errors = 0;
let warnings = 0;

function log(level, message) {
    const prefix = {
        error: `${colors.red}ERROR${colors.reset}`,
        warning: `${colors.yellow}WARNING${colors.reset}`,
        success: `${colors.green}SUCCESS${colors.reset}`,
        info: 'INFO'
    };
    
    console.log(`[${prefix[level]}] ${message}`);
    
    if (level === 'error') errors++;
    if (level === 'warning') warnings++;
}

/**
 * Check JavaScript syntax using basic parsing
 */
function checkJavaScriptSyntax(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Basic syntax checks
        const checks = [
            {
                name: 'Unmatched braces',
                test: () => {
                    const openBraces = (content.match(/{/g) || []).length;
                    const closeBraces = (content.match(/}/g) || []).length;
                    return openBraces === closeBraces;
                }
            },
            {
                name: 'Unmatched parentheses',
                test: () => {
                    // More sophisticated parentheses checking - ignoring comments and strings
                    let depth = 0;
                    let inString = false;
                    let inComment = false;
                    let stringChar = '';
                    
                    for (let i = 0; i < content.length; i++) {
                        const char = content[i];
                        const nextChar = content[i + 1];
                        
                        // Handle comments
                        if (!inString && char === '/' && nextChar === '/') {
                            inComment = true;
                            continue;
                        }
                        if (inComment && char === '\n') {
                            inComment = false;
                            continue;
                        }
                        if (inComment) continue;
                        
                        // Handle strings
                        if (!inString && (char === '"' || char === "'" || char === '`')) {
                            inString = true;
                            stringChar = char;
                            continue;
                        }
                        if (inString && char === stringChar && content[i-1] !== '\\') {
                            inString = false;
                            continue;
                        }
                        if (inString) continue;
                        
                        // Count parentheses
                        if (char === '(') depth++;
                        if (char === ')') depth--;
                        
                        if (depth < 0) return false; // More closing than opening
                    }
                    
                    return depth === 0;
                }
            },
            {
                name: 'Static methods outside class',
                test: () => {
                    // Look for "static" keyword after class closing brace
                    const classEndPattern = /^}\s*$/gm;
                    const lines = content.split('\n');
                    
                    for (let i = 0; i < lines.length - 1; i++) {
                        if (classEndPattern.test(lines[i])) {
                            // Check next non-empty line for static keyword
                            let j = i + 1;
                            while (j < lines.length && lines[j].trim() === '') j++;
                            if (j < lines.length && lines[j].includes('static ')) {
                                log('error', `${filePath}: Static method found outside class at line ${j + 1}`);
                                return false;
                            }
                        }
                    }
                    return true;
                }
            }
        ];
        
        checks.forEach(check => {
            if (!check.test()) {
                log('error', `${filePath}: ${check.name} detected`);
            }
        });
        
        // Check for common issues
        if (content.includes('window.') && content.includes('= class')) {
            log('warning', `${filePath}: Class exposed to window - may cause redeclaration errors`);
        }
        
    } catch (error) {
        log('error', `Failed to read ${filePath}: ${error.message}`);
    }
}

/**
 * Check for duplicate script includes
 */
function checkDuplicateIncludes() {
    const toolHtmlPath = path.join(__dirname, 'retirement-calculator/tool.html');
    const hugoLayoutPath = path.join(__dirname, '../themes/bufoindex/layouts/tools/single.html');
    
    try {
        const toolHtml = fs.readFileSync(toolHtmlPath, 'utf-8');
        const hugoLayout = fs.readFileSync(hugoLayoutPath, 'utf-8');
        
        // Extract script tags
        const toolScripts = [...toolHtml.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
        const hugoScripts = [...hugoLayout.matchAll(/src="\{\{[^}]*"([^"]+)"[^}]*\}\}"/g)].map(m => m[1]);
        
        // Check for scripts in both places
        toolScripts.forEach(script => {
            if (script.includes('.js')) {
                const scriptName = path.basename(script);
                if (hugoScripts.some(h => h.includes(scriptName))) {
                    log('error', `Duplicate script include detected: ${scriptName}`);
                }
            }
        });
        
        // Check if tool.html has any script tags (it shouldn't)
        if (toolScripts.length > 0) {
            log('warning', `tool.html contains ${toolScripts.length} script tags - these should be in Hugo layout`);
        }
        
    } catch (error) {
        log('warning', `Could not check for duplicate includes: ${error.message}`);
    }
}

/**
 * Check dependency order
 */
function checkDependencyOrder() {
    const hugoLayoutPath = path.join(__dirname, '../themes/bufoindex/layouts/tools/single.html');
    
    try {
        const content = fs.readFileSync(hugoLayoutPath, 'utf-8');
        const scriptMatches = [...content.matchAll(/src="\{\{[^}]*"([^"]*\.js)"[^}]*\}\}"/g)];
        const scriptOrder = scriptMatches.map(m => {
            const fullPath = m[1];
            // Remove Hugo template variables like %s
            const cleanPath = fullPath.replace(/%s/g, '');
            return path.basename(cleanPath);
        });
        
        // Debug: Found scripts in order: scriptOrder
        
        // Define expected order
        const expectedOrder = {
            'error-logger.js': 0,
            'calculations.js': 1,
            'url-state.js': 2,
            'export.js': 3,
            'script.js': 999 // Should be last
        };
        
        let lastIndex = -1;
        scriptOrder.forEach((script, index) => {
            if (expectedOrder[script] !== undefined) {
                if (expectedOrder[script] < lastIndex) {
                    log('error', `Script ${script} is loaded out of order`);
                }
                lastIndex = Math.max(lastIndex, expectedOrder[script]);
            }
        });
        
        // Check that script.js is last
        if (scriptOrder.length > 0 && scriptOrder[scriptOrder.length - 1] !== 'script.js') {
            log('error', `script.js should be loaded last, but found ${scriptOrder[scriptOrder.length - 1]}`);
        } else if (scriptOrder.includes('script.js')) {
            log('success', 'script.js is correctly loaded last');
        }
        
    } catch (error) {
        log('warning', `Could not check dependency order: ${error.message}`);
    }
}

/**
 * Check for missing files
 */
function checkMissingFiles() {
    const requiredFiles = [
        'retirement-calculator/lib/calculations.js',
        'retirement-calculator/lib/url-state.js',
        'retirement-calculator/lib/export.js',
        'retirement-calculator/lib/error-logger.js',
        'retirement-calculator/lib/savings-feasibility.js',
        'retirement-calculator/lib/monte-carlo.js',
        'retirement-calculator/lib/financial-modeling.js',
        'retirement-calculator/lib/statistical-analysis.js',
        'retirement-calculator/lib/insights-engine.js',
        'retirement-calculator/lib/chart-configs.js',
        'retirement-calculator/script.js',
        'retirement-calculator/tool.html',
        'retirement-calculator/styles.css'
    ];
    
    requiredFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (!fs.existsSync(filePath)) {
            log('error', `Missing required file: ${file}`);
        }
    });
}

/**
 * Check for console.log statements (optional)
 */
function checkConsoleStatements() {
    const jsFiles = [
        'retirement-calculator/lib/calculations.js',
        'retirement-calculator/lib/url-state.js',
        'retirement-calculator/lib/export.js',
        'retirement-calculator/script.js'
    ];
    
    jsFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const consoleCount = (content.match(/console\.(log|warn|error)/g) || []).length;
            if (consoleCount > 25) {
                log('warning', `${file} contains ${consoleCount} console statements - consider reducing for production`);
            }
        }
    });
}

/**
 * Main validation function
 */
function validate() {
    console.log('Validating retirement calculator...\n');
    
    // Check for missing files
    checkMissingFiles();
    
    // Check JavaScript syntax
    const jsFiles = [
        'retirement-calculator/lib/calculations.js',
        'retirement-calculator/lib/url-state.js',
        'retirement-calculator/lib/export.js',
        'retirement-calculator/lib/error-logger.js',
        'retirement-calculator/lib/savings-feasibility.js',
        'retirement-calculator/lib/monte-carlo.js',
        'retirement-calculator/lib/financial-modeling.js',
        'retirement-calculator/lib/statistical-analysis.js',
        'retirement-calculator/lib/insights-engine.js',
        'retirement-calculator/lib/chart-configs.js',
        'retirement-calculator/script.js'
    ];
    
    jsFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            checkJavaScriptSyntax(filePath);
        }
    });
    
    // Check for duplicate includes
    checkDuplicateIncludes();
    
    // Check dependency order
    checkDependencyOrder();
    
    // Check console statements
    checkConsoleStatements();
    
    // Summary
    console.log('\n' + '='.repeat(50));
    if (errors === 0 && warnings === 0) {
        log('success', 'All validations passed!');
    } else {
        console.log(`Found ${errors} errors and ${warnings} warnings`);
        if (errors > 0) {
            log('error', 'Build validation failed');
            process.exit(1);
        }
    }
}

// Run validation
validate();