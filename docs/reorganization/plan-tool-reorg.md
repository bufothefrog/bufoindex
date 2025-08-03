# Tool Reorganization Plan

## Overview

This plan outlines the reorganization of BufoIndex tools into self-contained, portable modules. Each tool will have all its assets (HTML, CSS, JS) in a single folder for easier management, updates, and portability.

## Current Structure

Currently, tool assets are scattered across the project:

```
bufoindex/
├── themes/bufoindex/layouts/_default/retirement-calculator.html
├── themes/bufoindex/assets/css/main.css (contains tool-specific styles)
├── static/js/
│   ├── retirement-calculator.js
│   └── utils/
│       ├── calculations.js
│       ├── export.js
│       └── url-state.js
└── content/tools/retirement-calculator/index.md
```

## Proposed Structure

Each tool will be a streamlined, self-contained module:

```
bufoindex/
├── tools/
│   ├── retirement-calculator/
│   │   ├── index.md            # Hugo content (frontmatter + documentation)
│   │   ├── tool.html           # Tool interface/calculator HTML
│   │   ├── styles.css          # Tool-specific styles only
│   │   ├── script.js           # Main calculator logic
│   │   └── lib/               # Tool-specific utilities
│   │       ├── calculations.js
│   │       ├── export.js
│   │       └── url-state.js
│   │
│   └── [future-tool]/
│       └── ... (same structure)
│
└── themes/bufoindex/
    └── layouts/tools/
        └── single.html         # Generic tool loader template
```

## Implementation Plan

### Phase 1: Create Tool Module Structure

1. **Create base directories**:
   ```
   tools/retirement-calculator/
   tools/retirement-calculator/lib/
   ```

2. **Extract and consolidate CSS**:
   - Move terminal-specific styles from main.css to `tools/retirement-calculator/styles.css`
   - Include only styles used by the retirement calculator
   - Remove external dependencies where possible

3. **Consolidate JavaScript**:
   - Move `static/js/retirement-calculator.js` to `tools/retirement-calculator/calculator.js`
   - Move utilities to `tools/retirement-calculator/lib/`
   - Update import paths and module structure

4. **Create self-contained HTML template**:
   - Combine layout and content into `tools/retirement-calculator/index.html`
   - Include inline styles or style references
   - Update script references to local paths

### Phase 2: Create Tool Loader System

1. **Generic tool layout** (`themes/bufoindex/layouts/tools/single.html`):
   ```html
   {{ define "main" }}
   {{ $toolDir := .File.Dir }}
   
   <!-- Load tool-specific styles -->
   <link rel="stylesheet" href="{{ printf "%sstyles.css" $toolDir | relURL }}">
   
   <!-- Display tool content (documentation) -->
   <div class="prose max-w-none mb-8">
       {{ .Content }}
   </div>
   
   <!-- Load tool HTML interface -->
   {{ readFile (printf "%stool.html" .File.Dir) | safeHTML }}
   
   <!-- Load tool scripts -->
   <script src="{{ printf "%slib/calculations.js" $toolDir | relURL }}"></script>
   <script src="{{ printf "%slib/export.js" $toolDir | relURL }}"></script>
   <script src="{{ printf "%slib/url-state.js" $toolDir | relURL }}"></script>
   <script src="{{ printf "%sscript.js" $toolDir | relURL }}"></script>
   {{ end }}
   ```

2. **Tool content structure** (`tools/retirement-calculator/index.md`):
   ```markdown
   ---
   title: "Retirement Planning Calculator"
   description: "Advanced retirement planning calculator"
   layout: "tools/single"
   tool_dependencies: ["chartjs", "chartjs-plugin-zoom"]
   ---

   # Retirement Planning Calculator

   Plan your financial independence with precision...

   ## How It Works
   ...rest of documentation...
   ```

### Phase 3: Migration Steps

1. **Retirement Calculator Migration**:
   - [ ] Create `tools/retirement-calculator/` directory
   - [ ] Move content from `content/tools/retirement-calculator/index.md` to `tools/retirement-calculator/index.md`
   - [ ] Extract calculator HTML to `tools/retirement-calculator/tool.html`
   - [ ] Extract CSS classes to `tools/retirement-calculator/styles.css`
   - [ ] Move JavaScript files to tool directory structure
   - [ ] Update all import/reference paths
   - [ ] Test calculator functionality
   - [ ] Remove old files

2. **Update Hugo Configuration for Clean URLs**:
   - [ ] Update `hugo.toml` to remove `/bufoindex/` from URLs
   - [ ] Configure Hugo to treat `tools/` as content directory
   - [ ] Update baseURL configuration
   - [ ] Test URL routing works correctly

3. **Update Build Process**:
   - [ ] Ensure Hugo copies tools/ directory to public/
   - [ ] Update any build scripts to handle tool modules
   - [ ] Update GitHub Pages deployment for new URL structure
   - [ ] Test production build

### Phase 4: Benefits & Future Considerations

#### Benefits:
1. **Portability**: Tools can be easily moved between projects
2. **Maintainability**: All tool code in one location
3. **Versioning**: Each tool can be versioned independently
4. **Testing**: Easier to test tools in isolation
5. **Development**: Faster development with clear boundaries

#### Future Enhancements:
1. **Tool Gallery**: Auto-generate tool listing from config files
2. **Lazy Loading**: Load tool assets only when needed
3. **Tool Templates**: Create starter templates for new tools
4. **NPM Packages**: Publish tools as standalone packages
5. **Web Components**: Convert tools to web components

## Migration Checklist

### Pre-Migration:
- [ ] Backup current implementation
- [ ] Document current file locations
- [ ] List all dependencies

### During Migration:
- [ ] Create directory structure
- [ ] Move and update HTML
- [ ] Extract and move CSS
- [ ] Consolidate JavaScript
- [ ] Update import paths
- [ ] Test functionality

### Post-Migration:
- [ ] Update documentation
- [ ] Remove old files
- [ ] Update build process
- [ ] Test production build
- [ ] Update deployment scripts

## Tool Module Template

For future tools, create this streamlined structure:

```
tools/[tool-name]/
├── index.md        # Hugo content with frontmatter + documentation
├── tool.html       # Tool HTML interface
├── styles.css      # Tool-specific styles
├── script.js       # Main tool logic
└── lib/           # Tool utilities (as needed)
    ├── calculations.js
    ├── export.js
    └── url-state.js
```

**Just 5 files maximum per tool!**

## Considerations

1. **CDN vs Local Dependencies**: 
   - Current: Chart.js loaded from CDN
   - Option 1: Keep CDN for common libraries
   - Option 2: Bundle dependencies locally
   - Recommendation: Use CDN with local fallback

2. **Shared Utilities**:
   - Keep tools truly independent - avoid shared dependencies
   - Duplicate small utility functions if needed
   - Only create `tools/shared/` if we have 3+ tools using identical large libraries

3. **Hugo Content Structure & URLs**:
   - Hugo will treat `tools/[tool-name]/index.md` as content automatically
   - Target URL: `/tools/[tool-name]/` (clean, no /bufoindex/ prefix)
   - Current URL: `/bufoindex/tools/retirement-calculator/` → New URL: `/tools/retirement-calculator/`
   - No need for separate `content/tools/` directory

4. **Performance**:
   - Consider lazy loading for heavy tools
   - Minimize initial page load
   - Use code splitting where appropriate

## URL Configuration Changes

### Current Configuration (`hugo.toml`):
```toml
baseURL = 'https://bufothefrog.github.io/bufoindex/'
```

### Required Changes:
```toml
baseURL = 'https://bufothefrog.github.io/'

# Add content mount for tools directory
[module]
  [[module.mounts]]
    source = "tools"
    target = "content/tools"
  [[module.mounts]]  
    source = "content"
    target = "content"
  [[module.mounts]]
    source = "static"
    target = "static"
  [[module.mounts]]
    source = "themes/bufoindex/static"
    target = "static"
```

### URL Impact:
- **Before**: `/bufoindex/tools/retirement-calculator/`
- **After**: `/tools/retirement-calculator/`

### Local Development URLs:
- **Current**: `http://localhost:1313/bufoindex/tools/retirement-calculator/`
- **After**: `http://localhost:1313/tools/retirement-calculator/`

Hugo's development server will automatically use the clean URLs locally, making testing straightforward.

### GitHub Pages Configuration:
- Repository settings may need to be updated to serve from root instead of `/bufoindex/`
- Update any hardcoded links in navigation menus
- Update any canonical URLs or sitemaps

## Next Steps

1. Review and approve this plan
2. Update Hugo configuration for clean URLs
3. Create proof-of-concept with retirement calculator
4. Test in development environment
5. Update GitHub Pages settings
6. Document any issues or changes needed
7. Proceed with full migration
8. Create template for future tools

## Success Criteria

- [ ] Tools load and function identically to current implementation
- [ ] Build time remains reasonable
- [ ] No increase in page load time
- [ ] Easier to add new tools
- [ ] Simplified maintenance workflow