# BufoIndex Developer Guide

Personal finance education platform with terminal aesthetics and academic rigor.

## Quick Start

```bash
# Development server with live reload
npm run dev

# Build CSS only
npm run build:css

# Production build
npm run build
```

## Architecture

### Stack
- **Static Site**: Hugo v0.142.0+extended
- **CSS**: Tailwind CSS with custom design system
- **JS**: Vanilla JavaScript (no frameworks)
- **Hosting**: GitHub Pages via Actions

### Key Directories
```
/
├── content/          # Markdown articles
│   ├── articles/     # Main content (concepts/strategies/advanced)
│   └── tools/        # Interactive calculator pages
├── themes/bufoindex/ # Custom theme
│   ├── assets/css/   # Tailwind source
│   ├── layouts/      # Hugo templates
│   └── static/       # Compiled assets
├── static/js/        # Calculator scripts
└── docs/             # Project documentation
```

## Common Tasks

### Writing Articles
```bash
# Create new article
hugo new content/articles/concepts/my-article.md

# Article frontmatter
---
title: "Understanding X"
date: 2025-08-01
description: "Brief description"
categories: ["concepts"]
tags: ["investing", "strategy"]
math: true  # Enable KaTeX
---
```

### Using Shortcodes
```markdown
# Terminal-style callout
{{< terminal title="KEY CONCEPT" desc="Important takeaway" >}}
Your content here
{{< /terminal >}}

# Mathematical formula
{{< formula >}}
FV = PV \times (1 + r)^n
{{< /formula >}}

# Calculation display
{{< calculation >}}
Monthly Investment: $500
Annual Return: 8%
30 Year Value: $679,699
{{< /calculation >}}

# Note box
{{< note type="info" >}}
Additional context
{{< /note >}}
```

### Building Tools
1. Create tool page: `content/tools/my-tool/index.md`
2. Add calculator script: `static/js/my-tool.js`
3. Use terminal styling classes from Tailwind config
4. Implement URL hash persistence for sharing

### Design System

#### Colors
- Primary: `#7FB069` (sage green)
- Terminal Black: `#0A0E1A`
- Terminal Green: `#00FF41`
- Accent Orange: `#FFB86C`

#### Typography
- Articles: `font-article` (Charter, Crimson Pro)
- Tools/Data: `font-mono` (IBM Plex Mono, Fira Code)
- UI: `font-sans` (Inter)

#### Terminal Components
```html
<!-- Terminal box -->
<div class="bg-terminal-black text-terminal-green p-6 rounded-lg font-mono">
  <h3 class="terminal-title">CALCULATOR</h3>
  <p class="terminal-desc">Description</p>
</div>

<!-- Data table -->
<div class="terminal-table">
  <!-- Use ASCII-style borders -->
</div>
```

## Testing & Deployment

### Local Testing
```bash
# Full build test
npm run build && hugo server -D

# Check for broken links
hugo --gc --minify --logLevel debug

# Mobile testing
# Use browser dev tools responsive mode
```

### Deployment
- Push to `main` branch triggers GitHub Actions
- Automatic build and deploy to GitHub Pages
- Check Actions tab for build status

## Performance Guidelines

### Articles
- Use `{{ .Content | truncate 160 }}` for descriptions
- Optimize images before adding (WebP preferred)
- Lazy load images with `loading="lazy"`

### Tools
- Keep calculations under 50ms
- Use `requestAnimationFrame` for smooth updates
- Implement debouncing for input handlers
- Cache expensive calculations

## Development Commands

```bash
# Start fresh
rm -rf public/ resources/ && npm run dev

# Update dependencies
npm update

# Hugo commands
hugo new content/articles/category/title.md
hugo list all
hugo list drafts

# Git workflow
git add .
git commit -m "Add feature X"
git push origin main
```

## Project Documentation

- `/docs/prd.md` - Product requirements and vision
- `/docs/design-system.md` - Complete design specifications
- `/docs/feature-backlog.md` - Task tracking and status
- `/CLAUDE.md` - AI assistant instructions

## Common Patterns

### URL Hash State
```javascript
// Save state
const state = { param1: value1, param2: value2 };
window.location.hash = btoa(JSON.stringify(state));

// Load state
const hash = window.location.hash.slice(1);
const state = hash ? JSON.parse(atob(hash)) : {};
```

### Terminal Styling
```javascript
// Format currency
const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0
});

// Terminal output
element.innerHTML = `
  <span class="text-terminal-green">></span> Result: ${fmt.format(value)}
`;
```

## Debugging

### Build Issues
```bash
# Verbose build
hugo --gc --minify --verbose

# Check config
hugo config

# List all content
hugo list all
```

### CSS Not Updating
```bash
# Rebuild CSS
npm run build:css

# Clear cache
rm -rf resources/_gen/
```

### Common Fixes
- Math not rendering: Ensure `math: true` in frontmatter
- Broken links: Use `{{< ref "/path/to/page" >}}`
- CSS changes not showing: Restart dev server

---

**Remember**: This is a static site - no backend, no databases, no user tracking. Keep it fast, accessible, and focused on education.