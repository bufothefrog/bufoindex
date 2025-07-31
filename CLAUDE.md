# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

BufoIndex is a personal finance education platform built with Hugo static site generator. It combines educational articles with interactive JavaScript calculators, using a custom theme with terminal-style aesthetics for financial tools and academic paper styling for content.

## Common Development Commands

### Development Workflow
```bash
# Start development server with CSS watching
npm run dev

# Build CSS only
npm run build:css

# Watch CSS changes
npm run watch:css

# Production build
npm run build

# Hugo server alone (CSS must be built separately)
hugo server -D
```

### Build Process
The site uses a two-step build process:
1. Tailwind CSS compilation from `themes/bufoindex/assets/css/main.css` to `themes/bufoindex/static/css/style.css`
2. Hugo static site generation with minification

## Architecture

### Content Structure
- `/content/articles/` - Educational articles organized in three categories:
  - `concepts/` - Foundational financial concepts
  - `strategies/` - Intermediate financial strategies  
  - `advanced/` - Advanced techniques (leverage, optimization)
- `/content/tools/` - Interactive financial calculators
- `/content/about.md` - Site mission and information

### Theme System
- Custom Hugo theme located in `/themes/bufoindex/`
- Terminal-style aesthetics for tools and data displays
- Academic paper styling for articles
- Tailwind CSS with custom color palette and typography

### Color Palette
- Primary: Sage green (#7FB069) 
- Terminal: Black (#0A0E1A) and green (#00FF41)
- Accent: Orange (#FFB86C)
- Background: Off-white (#FAFAF9)

### Typography
- Articles: Serif fonts (Charter, Crimson Pro) for readability
- Tools/Data: Monospace fonts (IBM Plex Mono, Fira Code) for terminal aesthetic
- UI: Sans-serif (Inter) for navigation

### Interactive Tools
- Pure vanilla JavaScript with no framework dependencies
- URL hash-based state persistence for sharing scenarios
- Terminal-style interfaces with monospace layouts
- Static data files in `/static/js/data/` and `/data/`

### JavaScript Architecture
- Modular utility functions in `/static/js/utils/`
- Individual calculator scripts in `/static/js/`
- No build process required - vanilla ES6+ JavaScript

## Content Guidelines

### Article Writing
- Use percentages rather than dollar amounts in examples
- Include mathematical formulas using HTML/CSS (KaTeX integration available)
- Terminal-style callouts for important calculations
- Focus on methodology over specific recommendations

### Tool Development
- Terminal aesthetic with dark backgrounds and green text
- Dense data layouts similar to financial terminals
- Export functionality for results (JSON/CSV)
- State persistence via URL hash for sharing scenarios

## Development Notes

### Hugo Configuration
- Base URL: `https://bufothefrog.github.io/bufoindex/`
- Theme: Custom `bufoindex` theme
- Markdown rendering with unsafe HTML enabled for calculators
- Syntax highlighting configured for code blocks

### CSS Development
- Tailwind CSS with extensive custom configuration
- Typography plugin for article styling
- Custom color scheme matching financial terminal aesthetics
- Responsive design with mobile-first approach

### Deployment
- Automated deployment via GitHub Actions to GitHub Pages
- Build process includes CSS compilation and Hugo generation
- Static site with no server-side dependencies

### File Locations
- Theme templates: `/themes/bufoindex/layouts/`
- Static assets: `/themes/bufoindex/static/`
- Content: `/content/`
- Configuration: `/hugo.toml`
- CSS source: `/themes/bufoindex/assets/css/main.css`
- Tailwind config: `/tailwind.config.js`

## AI Agent Development Guide

### For Claude Code Acting as Project Manager
When using the bufoindex-project-manager agent, always evaluate project state first and utilize parallel execution whenever possible.

#### Project Manager Workflow
1. **EVALUATE** - Read all documentation and assess current state
2. **PLAN** - Identify parallel execution opportunities 
3. **DEFINE** - Create clear task boundaries and contracts
4. **SPAWN** - Launch multiple agents simultaneously
5. **MONITOR** - Track progress via `/docs/agents/agent-communication/`
6. **INTEGRATE** - Coordinate handoffs and resolve conflicts
7. **DOCUMENT** - Update feature backlog with completion status

#### Initial Project Evaluation (Mandatory)
Before spawning agents, assess project health:
```bash
ls -la && hugo version && cat hugo.toml
cat docs/prd.md && cat docs/feature-backlog.md
find content -name "*.md" | wc -l
hugo --gc --minify  # Check build status
```

#### Task Prioritization Rules
1. **CRITICAL** - Broken builds, non-rendering pages, deployment failures
2. **IN PROGRESS - HIGH** - Partially complete features 
3. **NOT STARTED - NORMAL** - New features that can be built in parallel
4. **COMPLETED - LOW** - Enhancements to completed features

#### Agent Communication
Agents coordinate via `/docs/agents/agent-communication/` directory:
- Assessment files for project state evaluation
- Coordination files for parallel execution planning
- Completion summaries after agent sessions

#### File Ownership Matrix
When running parallel agents, establish clear file ownership:
- Content agents: Own specific articles in `/content/`
- Frontend agents: Own templates in `/layouts/`
- Tool agents: Own calculators in `/static/js/`
- DevOps agents: Own build/deployment files

### Multi-Agent Coordination Best Practices
- **Default to parallel execution** unless dependencies require sequential work
- **Define interfaces early** - frontmatter format, data schemas, API contracts
- **Monitor via documentation** - agents update communication files asynchronously
- **Test continuously** with `hugo server -D` during development
- **Update feature backlog immediately** when tasks complete

## Testing
No formal test framework is currently configured. Verify tool calculations manually and test responsive design across devices.

### Testing Requirements
- Manual calculation verification for all financial tools
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile responsiveness validation
- URL hash persistence functionality
- Accessibility compliance (WCAG 2.1 AA)