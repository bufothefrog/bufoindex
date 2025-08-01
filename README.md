# BufoIndex

![Build Status](https://github.com/bufothefrog/bufoindex/actions/workflows/hugo.yml/badge.svg)

A personal finance education platform focused on practical strategies and interactive tools.

## About

BufoIndex provides educational content and interactive calculators to help people make informed financial decisions. Content covers foundational concepts, practical strategies, and advanced techniques.

## Features

- **Educational Articles**: Comprehensive guides on financial concepts and strategies
- **Interactive Tools**: Calculators and optimization tools for financial decision-making
- **Terminal Aesthetics**: Clean, data-focused design optimized for readability
- **Static Site**: Fast, secure, and accessible without JavaScript dependencies

## Local Development

### Prerequisites

- Hugo (extended version)
- Node.js and npm

### Setup

```bash
# Clone the repository
git clone https://github.com/bufothefrog/bufoindex.git
cd bufoindex

# Install dependencies
npm install

# Build CSS
npm run build:css

# Start development server
npm run dev
```

The site will be available at `http://localhost:1313`

### Available Scripts

- `npm run build:css` - Build Tailwind CSS
- `npm run watch:css` - Watch for CSS changes
- `npm run build` - Build production site
- `npm run dev` - Start development server with CSS watching

## Deployment

The site is automatically deployed to GitHub Pages via GitHub Actions when changes are pushed to the main branch.

## Contributing

This is a personal educational project. For questions or suggestions, please open an issue.

## License

MIT License - see [LICENSE](LICENSE) for details.