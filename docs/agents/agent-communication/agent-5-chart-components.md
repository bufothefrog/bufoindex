# Agent 5: Chart Components (Recharts) - Sprint 2B

## Agent Assignment
**Role:** Data Visualization & Chart Components Specialist
**Sprint:** Sprint 2B - UI Components & Visualization  
**Duration:** 3-4 hours
**Status:** READY TO LAUNCH

## Specific Deliverables

### Primary Objective
Create comprehensive data visualization components using Recharts library for retirement planning data, with focus on Monte Carlo result visualization, net worth progression, withdrawal timelines, and scenario comparisons with mobile-responsive design.

### File Ownership (EXCLUSIVE)
- `app/tools/retirement-calculator/components/charts/NetWorthChart.tsx` (create new)
- `app/tools/retirement-calculator/components/charts/WithdrawalChart.tsx` (create new)
- `app/tools/retirement-calculator/components/charts/ScenarioChart.tsx` (create new)
- `app/tools/retirement-calculator/components/charts/MonteCarloChart.tsx` (enhance existing)
- `app/tools/retirement-calculator/components/charts/index.ts` (create export barrel)

### Technical Requirements

#### 1. Net Worth Progression Chart
```typescript
interface NetWorthChartProps {
  data: {
    age: number;
    median: number;
    p10: number;
    p25: number; 
    p75: number;
    p90: number;
    phase: 'accumulation' | 'retirement';
  }[];
  scenario: RetirementScenario;
  loading?: boolean;
  height?: number;
}

export function NetWorthChart(props: NetWorthChartProps): JSX.Element {
  // Area chart with percentile bands
  // Distinct accumulation vs retirement phases
  // Interactive tooltips with detailed information
  // Mobile-responsive with touch interactions
}
```

#### 2. Withdrawal Timeline Chart
```typescript
interface WithdrawalChartProps {
  data: {
    year: number;
    withdrawalAmount: number;
    inflationAdjusted: number;
    remainingBalance: number;
    successProbability: number;
  }[];
  scenario: RetirementScenario;
  loading?: boolean;
  height?: number;
}

export function WithdrawalChart(props: WithdrawalChartProps): JSX.Element {
  // Combined area/line chart showing withdrawals and balance
  // Inflation-adjusted vs nominal values
  // Success probability overlay
  // Interactive exploration of different years
}
```

#### 3. Scenario Comparison Chart
```typescript
interface ScenarioChartProps {
  scenarios: {
    name: string;
    retirementAge: number;
    successProbability: number;
    finalNetWorth: number;
    totalWithdrawals: number;
  }[];
  currentScenario: string;
  onScenarioSelect: (scenarioName: string) => void;
  loading?: boolean;
}

export function ScenarioChart(props: ScenarioChartProps): JSX.Element {
  // Bar chart comparing different retirement ages/strategies
  // Interactive scenario selection
  // Success rate visualization with color coding
  // Mobile-optimized touch interactions
}
```

#### 4. Enhanced Monte Carlo Chart
```typescript
// Enhance existing MonteCarloChart.tsx 
interface EnhancedMonteCarloChartProps {
  results: MonteCarloResults; // From Agent 1
  displayMode: 'percentiles' | 'distribution' | 'failure-analysis';
  interactiveMode: boolean;
  height?: number;
  onDataPointHover?: (data: any) => void;
}

export function MonteCarloChart(props: EnhancedMonteCarloChartProps): JSX.Element {
  // Multiple visualization modes
  // Percentile bands with proper statistical representation
  // Distribution histograms for failure analysis
  // Interactive exploration with detailed tooltips
}
```

### Recharts Integration Requirements

#### Library Setup & Optimization
```typescript
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

// Performance optimizations for large datasets
const chartOptimizations = {
  connectNulls: false,
  isAnimationActive: false, // Disable on mobile for performance
  dot: false, // Remove dots for performance on large datasets
  strokeWidth: 2,
  fillOpacity: 0.6
};
```

#### Color Scheme & Styling
```typescript
// MUST use BufoIndex brand colors and accessibility-friendly palette
const chartColors = {
  primary: '#7FB069',      // BufoIndex sage green
  secondary: '#6B7280',    // Neutral gray
  success: '#10B981',      // Success green  
  warning: '#F59E0B',      // Warning amber
  danger: '#EF4444',       // Danger red
  percentiles: {
    p10: '#EF4444',        // Lower percentile (red)
    p25: '#F59E0B',        // 25th percentile (amber)
    p50: '#7FB069',        // Median (sage green)
    p75: '#3B82F6',        // 75th percentile (blue)
    p90: '#8B5CF6'         // Higher percentile (purple)
  }
};

// Accessibility considerations
const accessibleChartProps = {
  'aria-label': 'Retirement projection chart',
  role: 'img',
  tabIndex: 0,
  onKeyDown: handleKeyboardNavigation
};
```

### Mobile-Responsive Design

#### Responsive Chart Behavior
```typescript
interface ResponsiveChartConfig {
  mobile: {
    height: 300,
    showLegend: false,     // Hide legend on mobile
    fontSize: 12,
    margin: { top: 5, right: 5, left: 5, bottom: 5 }
  };
  tablet: {
    height: 400,
    showLegend: true,
    fontSize: 14,
    margin: { top: 20, right: 30, left: 20, bottom: 5 }
  };
  desktop: {
    height: 500,
    showLegend: true,
    fontSize: 16,
    margin: { top: 20, right: 30, left: 20, bottom: 5 }
  };
}

// Use responsive container with breakpoint-specific configurations
function useResponsiveChart() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  return isMobile ? config.mobile : isTablet ? config.tablet : config.desktop;
}
```

#### Touch-Friendly Interactions
```typescript
// Mobile-optimized tooltip and interaction handling
const mobileTooltipProps = {
  trigger: 'click',        // Touch-friendly trigger
  position: { x: 'auto', y: 'auto' },
  allowEscapeViewBox: { x: true, y: true },
  formatter: (value: number, name: string) => [
    formatCurrency(value), 
    name
  ],
  labelFormatter: (label: string) => `Age: ${label}`
};
```

### Chart Performance Optimization

#### Data Processing Optimization
```typescript
// Optimize large datasets for chart rendering
function optimizeChartData<T>(
  data: T[], 
  maxPoints: number = 100
): T[] {
  if (data.length <= maxPoints) return data;
  
  // Use time-based sampling for large datasets
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, index) => index % step === 0);
}

// Memory-efficient data structures
interface OptimizedChartPoint {
  x: number;
  y: number;
  metadata?: Record<string, any>; // Only include when needed
}
```

#### Rendering Performance
```typescript
// Performance targets for chart rendering
const PERFORMANCE_TARGETS = {
  initialRender: 500,    // <500ms initial render
  interactionResponse: 50, // <50ms tooltip/hover response
  dataUpdate: 200,       // <200ms when data changes
  maxDataPoints: 1000    // Optimize if more than 1000 points
};

// Implement performance monitoring
function useChartPerformance(chartName: string) {
  const startTime = performance.now();
  
  useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    if (renderTime > PERFORMANCE_TARGETS.initialRender) {
      console.warn(`Chart ${chartName} render time: ${renderTime}ms exceeds target`);
    }
  }, [chartName, startTime]);
}
```

### Data Integration Strategy

#### Mock Data for Development
```typescript
// Create mock data generators for development without Agent 1 dependency
export const mockMonteCarloResults: MonteCarloResults = {
  successProbability: 0.85,
  percentiles: {
    p10: Array.from({length: 40}, (_, i) => 100000 * (1.05 ** i) * 0.6),
    p25: Array.from({length: 40}, (_, i) => 100000 * (1.07 ** i) * 0.8),
    p50: Array.from({length: 40}, (_, i) => 100000 * (1.08 ** i)),
    p75: Array.from({length: 40}, (_, i) => 100000 * (1.09 ** i) * 1.2),
    p90: Array.from({length: 40}, (_, i) => 100000 * (1.11 ** i) * 1.4)
  },
  failureDistribution: Array.from({length: 40}, () => Math.random() * 0.3),
  yearsToFailure: Array.from({length: 150}, () => 25 + Math.random() * 10),
  statisticalMoments: {
    mean: 2500000,
    variance: 250000,
    skewness: 0.5,
    kurtosis: 3.2
  }
};
```

#### Real Data Integration Points
```typescript
// Integration interfaces for real data from Agent 1
interface ChartDataProcessor {
  processMonteCarloResults(results: MonteCarloResults): NetWorthChartData[];
  processWithdrawalData(scenario: RetirementScenario, results: MonteCarloResults): WithdrawalChartData[];
  processScenarioComparison(scenarios: RetirementScenario[]): ScenarioChartData[];
}
```

### Success Criteria ✅
- [ ] NetWorthChart displays Monte Carlo percentile bands correctly
- [ ] WithdrawalChart shows inflation-adjusted withdrawal timeline  
- [ ] ScenarioChart enables interactive comparison of retirement strategies
- [ ] Enhanced MonteCarloChart supports multiple visualization modes
- [ ] All charts are fully responsive on mobile, tablet, desktop
- [ ] Touch-friendly interactions work correctly on mobile devices
- [ ] Chart rendering performance meets all targets (<500ms initial)
- [ ] Accessibility compliance verified (WCAG 2.1 AA)
- [ ] BufoIndex brand colors and styling applied consistently
- [ ] Charts integrate with mock data during development
- [ ] Real data integration points defined for Agent 1 outputs

### Agent Communication
**Progress Updates:** Update this file every hour with completion status
**Performance Results:** Include chart rendering performance measurements
**Mobile Testing:** Document testing results on actual mobile devices
**Integration Status:** Document mock vs real data integration progress
**Completion Status:** Mark complete only when ALL success criteria met

### Quality Validation Required
```bash
# MUST pass before marking complete
npm run test:charts
npm run test:performance:charts  
npm run test:accessibility
npm run type-check
npm run build
# Manual testing on mobile devices required
```

**Agent 5 Ready for Launch** ✅