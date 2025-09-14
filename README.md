# BufoIndex - Personal Finance Optimization Platform

**For Those Who Want Financial Control, Not Financial Comfort**

A modern Next.js application providing interactive financial calculators that challenge conventional wisdom with math-driven strategies for aggressive wealth accumulation.

## 🚀 Features

### **Paycheck Allocator**
- Smart monthly allocation optimization
- Tax bracket optimization
- Account prioritization algorithm  
- Contrarian recommendations (emergency fund, debt strategy)
- Real-time calculation with instant results
- URL sharing via compressed hash state

### **Retirement Calculator**  
- Comprehensive retirement planning
- Monte Carlo simulations for success probability
- Multiple retirement age scenarios
- Social Security benefit calculations
- Healthcare cost modeling
- Interactive visualizations
- URL sharing for scenario planning

## 🛠 Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: Zustand
- **Charts**: Chart.js with react-chartjs-2
- **Deployment**: Vercel

## 🏗 Architecture

```
site-rework/
├── app/                          # Next.js App Router
│   ├── globals.css
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Homepage
│   └── tools/
│       ├── paycheck-allocator/
│       └── retirement-calculator/
├── components/
│   ├── calculator/              # Paycheck allocator components
│   ├── retirement/              # Retirement calculator components
│   ├── shared/                  # Reusable components
│   └── ui/                      # shadcn/ui components
├── lib/
│   ├── calculations/            # Calculation engines
│   ├── constants/               # Financial constants
│   ├── types/                   # TypeScript definitions
│   └── utils/                   # Helper functions
└── hooks/                       # Custom React hooks
```

## 🎯 Key Principles

1. **Transparency** - Show actual strategies being used
2. **Sophistication** - Go beyond basic financial advice  
3. **Accessibility** - Explain complex concepts clearly
4. **Practicality** - Focus on actionable strategies
5. **Optimization** - Mathematical over emotional decisions

## 💻 Development

### Prerequisites
- Node.js 18+ 
- npm

### Setup
```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to see the application.

### Build
```bash
npm run build
npm start
```

## 📱 Features

### **URL State Sharing**
Both calculators support sharing scenarios via compressed URL hashes:
- Automatic URL updates as you change inputs
- Share button copies shareable link
- Bookmarkable scenarios
- No data transmission - complete client-side privacy

### **Mobile Optimized**
- Touch-friendly interfaces
- Responsive design
- Progressive enhancement
- Works without JavaScript frameworks

### **Contrarian Insights**
- Challenge conventional "safe" financial advice
- Show opportunity costs of conservative strategies
- Mathematical optimization over emotional comfort
- Educational explanations for non-traditional recommendations

## 🚀 Deployment

Optimized for Vercel deployment with:
- Static generation for performance
- CDN delivery
- Automatic HTTPS
- Custom domain support

## 📄 License

Educational use only. Not financial advice.

---

*Built for financial optimizers who want control, not comfort.*