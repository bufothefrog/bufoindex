# Financial Dashboard Technical Implementation Plan

**Version:** 2.0  
**Date:** January 2025  
**Tech Stack:** Next.js 14 + Supabase + Vercel + TypeScript  
**Deployment:** Path-based routing (/dashboard) with performance-limited calculations

---

## 1. Architecture Overview

### 1.1 Technology Stack

#### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS (maintaining current design system)
- **State Management**: Zustand for client state + React Query for server state
- **Charts**: Chart.js (reusing existing patterns)
- **Workers**: Web Workers for heavy calculations (performance limited)

#### Backend & Database
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth (magic link)
- **Storage**: Supabase for profile data and calculation results
- **API**: Next.js API routes + Supabase client

#### Deployment & Infrastructure
- **Hosting**: Vercel (optimal Next.js integration)
- **Domain**: Path-based routing from main domain (/dashboard)
- **CDN**: Vercel Edge Network
- **Analytics**: Vercel Analytics (privacy-focused)

### 1.2 Routing Strategy

```
bufoindex.com/              # Hugo site (existing)
├── about/                  # Hugo content
├── articles/               # Hugo content
├── tools/                  # Hugo tools (legacy)
└── dashboard/              # Next.js app (new)
    ├── profile/            # Profile builder
    ├── calculators/        # Enhanced calculators
    │   ├── cost-of-conservative/
    │   ├── retirement-planner/
    │   ├── account-optimizer/
    │   └── tax-strategist/
    └── auth/               # Authentication flows
```

---

## 2. Database Schema Design (Simplified)

### 2.1 Supabase Tables

#### Profiles Table
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Profile versioning (simple)
  profile_version INTEGER DEFAULT 1,
  completion_percentage INTEGER DEFAULT 0,
  
  -- Core profile data (JSONB for flexibility)
  demographics JSONB DEFAULT '{}',
  income JSONB DEFAULT '{}',
  benefits JSONB DEFAULT '{}',
  assets JSONB DEFAULT '{}',
  debts JSONB DEFAULT '{}',
  goals JSONB DEFAULT '{}',
  behaviors JSONB DEFAULT '{}',
  
  -- Optimization results
  optimization_score INTEGER,
  last_analysis_at TIMESTAMP WITH TIME ZONE,
  
  -- Preferences
  risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive', 'optimizer'))
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own profile" ON profiles
  FOR ALL USING (auth.uid() = id);
```

#### Calculation Results Table
```sql
CREATE TABLE calculation_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  calculator_type TEXT NOT NULL,
  profile_version INTEGER NOT NULL, -- Cache key based on profile version
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_calculation_results_user_type_version 
ON calculation_results(user_id, calculator_type, profile_version);

-- RLS
ALTER TABLE calculation_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own calculations" ON calculation_results
  FOR ALL USING (auth.uid() = user_id);
```

#### Profile History Table (Simplified Versioning)
```sql
CREATE TABLE profile_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_version INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_profile_history_user ON profile_history(user_id, created_at DESC);

-- RLS
ALTER TABLE profile_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own history" ON profile_history
  FOR SELECT USING (auth.uid() = user_id);
  
-- Trigger to invalidate calculations when profile changes
CREATE OR REPLACE FUNCTION invalidate_calculations_on_profile_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete cached calculations when profile is updated
  DELETE FROM calculation_results WHERE user_id = NEW.id;
  
  -- Insert history record
  INSERT INTO profile_history (user_id, profile_version)
  VALUES (NEW.id, NEW.profile_version);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_change_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at)
  EXECUTE FUNCTION invalidate_calculations_on_profile_change();
```

---

## 3. Calculator Logic Migration Strategy

### 3.1 Migrating Existing Retirement Calculator

```typescript
// src/lib/migration/retirement-calculator-migration.ts

// Extract and adapt existing retirement calculator logic
import { FinancialCalculations } from '../legacy/retirement-calculator';

// Migrate core calculation functions
export class MigratedRetirementCalculations {
  // Adapt existing futureValue, requiredPayment, etc. functions
  static futureValue = FinancialCalculations.futureValue;
  static calculateRequiredPayment = FinancialCalculations.calculateRequiredPayment;
  
  // Enhance with new profile-based calculations
  static calculateWithProfile(profile: FinancialProfile) {
    const income = profile.income.primarySalary || 0;
    const currentAge = profile.demographics.age || 30;
    const retirementAge = profile.goals.retirementAge || 65;
    
    // Use existing logic with profile data
    return this.calculateRequiredPayment(
      profile.assets.traditional401k || 0,
      profile.goals.targetRetirementIncome || income * 0.8,
      0.08, // return rate
      retirementAge - currentAge
    );
  }
}

// URL parameter compatibility for SEO
export function migrateURLParameters(searchParams: URLSearchParams): Partial<FinancialProfile> {
  return {
    demographics: {
      age: parseInt(searchParams.get('age') || '30'),
    },
    goals: {
      retirementAge: parseInt(searchParams.get('retirementAge') || '65'),
      targetRetirementIncome: parseInt(searchParams.get('targetIncome') || '0'),
    },
    // ... map other URL params to profile structure
  };
}
```

---

## 4. Performance-Limited Web Workers

### 4.1 Monte Carlo Worker (Performance Limited)

```typescript
// public/workers/monte-carlo.worker.ts
self.onmessage = function(e) {
  const { params, simulations } = e.data;
  
  // Limit complexity for performance
  const maxSimulations = Math.min(simulations, 5000); // Cap at 5k simulations
  const results = runMonteCarloSimulation(params, maxSimulations);
  
  self.postMessage({ results, actualSimulations: maxSimulations });
};

function runMonteCarloSimulation(params: any, simulations: number) {
  const results = [];
  const startTime = Date.now();
  const maxDuration = 10000; // 10 second timeout
  
  for (let i = 0; i < simulations; i++) {
    // Check for timeout every 100 simulations
    if (i % 100 === 0 && Date.now() - startTime > maxDuration) {
      console.warn(`Monte Carlo timeout after ${i} simulations`);
      break;
    }
    
    // Monte Carlo simulation logic
    const simulation = {
      finalBalance: Math.random() * 1000000 + 500000,
      successProbability: Math.random(),
      worstYear: Math.random() * 40 + 1,
    };
    
    results.push(simulation);
    
    // Report progress every 250 simulations (more frequent for shorter runs)
    if (i % 250 === 0) {
      self.postMessage({ 
        progress: (i / simulations) * 100,
        type: 'progress' 
      });
    }
  }
  
  return {
    simulations: results,
    summary: {
      medianBalance: results.sort((a, b) => a.finalBalance - b.finalBalance)[Math.floor(results.length / 2)].finalBalance,
      successRate: results.filter(r => r.successProbability > 0.9).length / results.length,
      actualCount: results.length,
    }
  };
}
```

### 4.2 Calculation Performance Limits

```typescript
// src/lib/calculations/performance-limits.ts

export const PERFORMANCE_LIMITS = {
  monteCarloSimulations: {
    max: 5000,
    timeout: 10000, // 10 seconds
    progressInterval: 250,
  },
  
  taxProjections: {
    maxYears: 50,
    timeout: 5000, // 5 seconds
  },
  
  optimizationIterations: {
    max: 1000,
    timeout: 3000, // 3 seconds
  }
};

export function limitCalculationComplexity<T>(
  calculation: () => T,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    new Promise<T>((resolve) => {
      const result = calculation();
      resolve(result);
    }),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Calculation timeout')), timeoutMs);
    })
  ]).catch(() => {
    console.warn('Calculation exceeded time limit, using fallback');
    return fallback;
  });
}
```

---

## 5. Smart Calculation Caching Strategy

### 5.1 Profile Version-Based Caching

```typescript
// src/lib/calculations/cache.ts
export async function getCachedCalculation<T>(
  userId: string,
  calculatorType: string,
  profileVersion: number
): Promise<T | null> {
  // Check if we have cached results for current profile version
  const { data } = await supabase
    .from('calculation_results')
    .select('results, created_at')
    .eq('user_id', userId)
    .eq('calculator_type', calculatorType)
    .eq('profile_version', profileVersion) // Use profile version as cache key
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  return data?.results || null;
}

export async function setCachedCalculation<T>(
  userId: string,
  calculatorType: string,
  profileVersion: number,
  results: T
): Promise<void> {
  await supabase
    .from('calculation_results')
    .upsert({
      user_id: userId,
      calculator_type: calculatorType,
      profile_version: profileVersion,
      results,
      updated_at: new Date().toISOString(),
    });
}

// Automatic cache invalidation happens via database trigger
// when profile.updated_at changes
```

### 5.2 Profile Management with Version Tracking

```typescript
// src/hooks/useProfile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export function useProfile() {
  const queryClient = useQueryClient();

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<FinancialProfile>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current profile to increment version
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('profile_version')
        .eq('id', user.id)
        .single();

      const newVersion = (currentProfile?.profile_version || 0) + 1;

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email!,
          ...updates,
          profile_version: newVersion, // Increment version to invalidate cache
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  // ... rest of profile hook
}
```

---

## 6. Vercel Deployment Configuration

### 6.1 Path-Based Routing Setup

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for path-based deployment
  basePath: '/dashboard',
  trailingSlash: true,
  
  // Enable Web Workers with performance limits
  webpack: (config) => {
    config.module.rules.push({
      test: /\.worker\.(js|ts)$/,
      use: {
        loader: 'worker-loader',
        options: {
          name: 'static/[hash].worker.js',
          publicPath: '/_next/',
        },
      },
    });
    
    return config;
  },
};

module.exports = nextConfig;
```

### 6.2 Vercel Configuration

```json
// vercel.json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 10
    }
  },
  "rewrites": [
    {
      "source": "/dashboard/:path*",
      "destination": "/dashboard/:path*"
    }
  ],
  "headers": [
    {
      "source": "/dashboard/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

### 6.3 Hugo Site Integration

```toml
# hugo.toml - Add dashboard link to navigation
[menu]
  [[menu.main]]
    name = "Dashboard"
    url = "/dashboard/"
    weight = 50
    
[params]
  dashboard_url = "/dashboard/"
```

---

## 7. Development Workflow

### 7.1 Local Development Setup

```bash
# 1. Setup Next.js app in existing repo
cd /path/to/bufoindex
mkdir dashboard
cd dashboard

# 2. Initialize Next.js with TypeScript
npx create-next-app@latest . --typescript --tailwind --app --eslint

# 3. Supabase setup
npx supabase init
npx supabase start
npx supabase db reset

# 4. Environment configuration
cp .env.example .env.local
# Add Supabase credentials

# 5. Development server
npm run dev
```

### 7.2 Repository Structure

```
bufoindex/                    # Existing Hugo repo
├── content/                  # Hugo content
├── themes/                   # Hugo themes  
├── static/                   # Hugo static files
├── tools/                    # Legacy Hugo tools
├── dashboard/                # New Next.js app
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── next.config.js
└── docs/                     # Documentation
```

---

## 8. Migration Strategy

### 8.1 Phase 1: Setup Next.js App (Week 1)
- Initialize Next.js in `/dashboard` directory
- Setup Supabase authentication
- Create basic profile management
- Implement smart caching system

### 8.2 Phase 2: Migrate Retirement Calculator (Week 2)
- Extract existing calculation logic from Hugo tools
- Adapt to TypeScript and profile integration
- Add performance limits and web workers
- Maintain URL parameter compatibility

### 8.3 Phase 3: Build New Calculators (Weeks 3-5)
- Cost of Conservative calculator
- Account Optimizer calculator  
- Tax Strategist calculator
- All using shared profile system

### 8.4 Phase 4: Dashboard Integration (Week 6)
- Create main dashboard interface
- Cross-tool intelligence engine
- Profile builder wizard
- Action item prioritization

---

## 9. Performance Considerations

### 9.1 Calculation Performance
- **Max Monte Carlo simulations**: 5,000 (vs typical 10,000)
- **Calculation timeout**: 10 seconds maximum
- **Progress reporting**: Every 250 iterations
- **Graceful degradation**: Fallback to simpler calculations on timeout

### 9.2 Caching Strategy
- **Cache key**: Profile version number (not input hash)
- **Invalidation**: Automatic via database trigger on profile update
- **Storage**: Results cached in Supabase for cross-session persistence
- **Client cache**: React Query for immediate response

### 9.3 Progressive Loading
```typescript
// Load calculators lazily for better performance
const RetirementCalculator = dynamic(
  () => import('@/components/calculators/RetirementCalculator'),
  { 
    loading: () => <CalculatorSkeleton />,
    ssr: false // Complex calculators don't need SSR
  }
);
```

---

## 10. Success Metrics & Monitoring

### 10.1 Performance Metrics
- **Calculation time**: <10 seconds for all operations
- **Cache hit rate**: >80% for repeat calculations
- **Page load time**: <2 seconds for dashboard
- **Error rate**: <1% for calculations

### 10.2 User Experience Metrics
- **Profile completion rate**: >70%
- **Calculator usage**: >2 calculators per session
- **Return rate**: >40% within 30 days
- **Mobile usage**: Support but expect <30%

---

*This updated technical implementation plan provides a realistic, performance-conscious approach to building the BufoIndex Financial Dashboard while maintaining the core optimization philosophy and ensuring smooth integration with the existing Hugo site.*