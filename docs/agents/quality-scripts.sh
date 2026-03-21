#!/bin/bash

# BufoIndex Agent Quality Assessment Scripts
#
# USAGE:
#   quick_health_check    - Fast pre-agent check for critical blockers only (~30s)
#   quality_assessment    - Comprehensive validation for pre-commit (~2-5min)
#   project_evaluation    - Full project assessment including quick check

# QUICK: Pre-Agent Health Check (Critical Blockers Only)
quick_health_check() {
    echo "=== QUICK HEALTH CHECK (PRE-AGENT) ===" 
    echo "Scanning for critical blockers only..."
    
    local has_errors=0
    
    # 1. TypeScript Critical Errors Check (Quick)
    echo "🔍 TypeScript Critical Errors Check..."
    if ! npm run type-check &>/dev/null; then
        echo "❌ BLOCKER: TypeScript compilation errors detected"
        echo "   Run 'npm run type-check' for details"
        has_errors=1
    else
        echo "✅ TypeScript compiles successfully"
    fi
    
    # 2. Basic Build Check (Quick)
    echo "🏗️  Basic Build Check..."
    if ! npm run build &>/dev/null; then
        echo "❌ BLOCKER: Build fails - cannot proceed"
        echo "   Run 'npm run build' for details"
        has_errors=1
    else
        echo "✅ Build succeeds"
    fi
    
    # 3. Philosophy Compliance Scan (Quick)
    echo "📖 Philosophy Compliance Check..."
    # Check for prohibited phrases, but allow legitimate contrarian messaging
    local violations=$(grep -ri "money guys recommend\|dave ramsey suggests\|conventional wisdom suggests\|6 months emergency fund\|12 months emergency fund" lib/ app/ components/ content/ 2>/dev/null || true)
    if [ -n "$violations" ]; then
        echo "❌ BLOCKER: Philosophy violations detected"
        echo "   Contrarian platform cannot contain conventional wisdom"
        echo "$violations"
        has_errors=1
    else
        echo "✅ Philosophy compliance verified"
    fi
    
    # 4. Critical Dependencies Check
    echo "📦 Dependencies Check..."
    local deps_ok=1
    [ ! -f package.json ] && echo "❌ package.json missing" && deps_ok=0
    [ ! -f tsconfig.json ] && echo "❌ tsconfig.json missing" && deps_ok=0
    [ ! -f vitest.config.ts ] && echo "❌ vitest.config.ts missing" && deps_ok=0
    
    if [ $deps_ok -eq 1 ]; then
        echo "✅ Critical dependencies present"
    else
        has_errors=1
    fi
    
    echo "=== QUICK HEALTH CHECK COMPLETE ==="
    
    if [ $has_errors -eq 0 ]; then
        echo "🟢 No critical blockers found - agents can proceed"
        echo "   (Comprehensive testing will happen at pre-commit)"
        return 0
    else
        echo "🚫 CRITICAL BLOCKERS FOUND - fix before spawning agents"
        return 1
    fi
}

# COMPREHENSIVE: Full Quality Assessment (Pre-Commit Level)
quality_assessment() {
    echo "=== COMPREHENSIVE QUALITY ASSESSMENT ===" 
    echo "Running full validation suite..."
    
    # 1. Build Health Verification (COMPREHENSIVE)
    echo "Build Health Check:"
    npm run type-check 2>&1 | tee quality-check.log
    npm run build 2>&1 | tee -a quality-check.log
    npm test 2>&1 | tee -a quality-check.log
    npm run lint 2>&1 | tee -a quality-check.log
    
    # 2. Philosophy Compliance Scan (COMPREHENSIVE)
    echo "Philosophy Compliance Check:"
    grep -ri "money guys\|dave ramsey\|conventional wisdom\|6 months emergency\|12 months emergency" lib/ app/ components/ content/ 2>/dev/null | tee philosophy-violations.log
    if [ -s philosophy-violations.log ]; then
        echo "❌ CRITICAL: Philosophy violations detected"
        exit 1
    else
        echo "✅ Philosophy compliance verified"
    fi
    
    # 3. Comprehensive Code Quality Scan
    echo "Code Quality Assessment:"
    find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs grep -l "TODO\|FIXME\|XXX\|HACK" | wc -l | sed 's/^/Technical debt files: /'
    find test/ -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | wc -l | sed 's/^/Test files count: /'
    
    # 4. Dependencies Verification
    echo "Dependencies Check:"
    ls -la package.json && echo "✅ Package.json exists" || echo "❌ Package.json missing"
    ls -la tsconfig.json && echo "✅ TypeScript configured" || echo "❌ TypeScript not configured"
    ls -la vitest.config.ts && echo "✅ Vitest configured" || echo "❌ Vitest not configured"
    
    # 5. Test Coverage Check
    echo "Test Coverage Check:"
    npm run test:coverage &>/dev/null && echo "✅ Coverage targets met" || echo "⚠️ Coverage below targets"
    
    # 6. Performance Benchmarks
    echo "Performance Benchmarks:"
    npm run benchmark &>/dev/null && echo "✅ Performance benchmarks pass" || echo "⚠️ Benchmarks not available"
    
    echo "=== COMPREHENSIVE ASSESSMENT COMPLETE ==="
    echo "Review quality-check.log and philosophy-violations.log for details"
}

# MANDATORY: Initial Project Evaluation
project_evaluation() {
    # 1. MANDATORY: Quick Health Check (Streamlined for Agent Spawning)
    echo "Running quick health check before project evaluation..."
    if ! quick_health_check; then
        echo "❌ CRITICAL BLOCKERS DETECTED - resolve before spawning agents"
        return 1
    fi
    
    # 2. Check project structure and health
    ls -la
    hugo version || next --version  # Check framework
    cat hugo.toml || cat config.toml || cat next.config.js  # Check config
    
    # 3. Read current project status  
    cat docs/prd.md || echo "No PRD found"                    # Project vision
    cat docs/feature-backlog.md || echo "No backlog found"   # Feature statuses 
    ls -la docs/agents/agent-communication/  # Previous agent work
    
    # 4. Evaluate codebase state
    find content -type f -name "*.md" 2>/dev/null | wc -l || echo "0"        # Article count
    find static/js -type f -name "*.js" 2>/dev/null | wc -l || echo "0"      # Tool count  
    find layouts -type f -name "*.html" 2>/dev/null | wc -l || echo "0"      # Template count
    find lib -type f -name "*.ts" 2>/dev/null | wc -l || echo "0"            # Calculation files
    find app -type f -name "*.tsx" 2>/dev/null | wc -l || echo "0"           # Next.js components
    grep -r "TODO\|FIXME\|XXX" --include="*.md" --include="*.js" --include="*.ts" --include="*.tsx" lib/ app/ components/ 2>/dev/null | wc -l  # Tech debt
    
    # 5. Check build status  
    npm run build && echo "✅ Build successful" || echo "❌ Build failed"
    ls -la public/ || ls -la .next/ || ls -la dist/     # Check generated files
    
    # 6. Quality-specific checks (Sprint 8 additions)
    grep -ri "money guys\|dave ramsey\|conventional wisdom" lib/ app/ components/ && echo "❌ Philosophy violations detected" || echo "✅ Philosophy compliant"
    find test/ -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | wc -l && echo "test files found" || echo "No test files"
}

# Hugo Build Coordination
hugo_coordination() {
    # Check current state
    hugo version
    ls -la content/
    ls -la layouts/
    hugo --gc --minify  # Test build
}

# Verify Environment
verify_environment() {
    hugo version  # Ensure Hugo is available
    ls -la content/  # Check existing content
    ls -la layouts/  # Check existing templates
    cat hugo.toml || cat config.toml  # Review configuration
}

# Article Development Workflow
article_workflow() {
    echo "Article Development Steps:"
    echo "1. Create content file: content/{section}/{slug}.md"
    echo "2. Add frontmatter with title, date, description"
    echo "3. Write content with KaTeX math where needed"
    echo "4. Test locally: hugo server -D"
    echo "5. Verify rendering and math formulas"
}

# Tool Development Workflow  
tool_workflow() {
    echo "Tool Development Steps:"
    echo "1. Create tool file: static/js/{tool-name}.js"
    echo "2. Write vanilla JavaScript (no frameworks)"
    echo "3. Create test page to verify calculations"
    echo "4. Add URL hash persistence"
    echo "5. Test on mobile devices"
}

# Validation Before Handoff
validate_handoff() {
    # Automated Checks
    hugo --gc --minify  # Build should succeed
    ls -la public/  # Verify output generated
    
    echo "Manual Verification Checklist:"
    echo "- [ ] Content renders correctly"
    echo "- [ ] Math formulas display properly"
    echo "- [ ] Tools calculate accurately"
    echo "- [ ] Mobile layout works"
    echo "- [ ] Links are not broken"
}

# Usage: Call functions as needed
# quality_assessment
# project_evaluation
# hugo_coordination
# verify_environment
# article_workflow
# tool_workflow
# validate_handoff