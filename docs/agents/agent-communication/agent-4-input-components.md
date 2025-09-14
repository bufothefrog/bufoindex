# Agent 4: Input Components Enhancement - Sprint 2A

## Agent Assignment
**Role:** Input Components & User Interface Specialist  
**Sprint:** Sprint 2A - UI Components & Visualization
**Duration:** 3-4 hours
**Status:** READY TO LAUNCH

## Specific Deliverables

### Primary Objective
Create comprehensive input components for retirement planning, maximizing reuse of existing PaycheckAllocator patterns, StateSelector, MoneyInput, and other established UI components while ensuring mobile-first responsive design.

### File Ownership (EXCLUSIVE)
- `app/tools/retirement-calculator/components/RetirementInputs.tsx` (enhance existing)
- `app/tools/retirement-calculator/components/PersonalInfoCard.tsx` (create new)
- `app/tools/retirement-calculator/components/FinancialDetailsCard.tsx` (create new)
- `app/tools/retirement-calculator/components/AdvancedAssumptions.tsx` (create new)

### Component Reuse Strategy (MANDATORY)

#### Existing Components to Leverage
```typescript
// MUST reuse these existing components - DO NOT recreate
import { MoneyInput } from '@/components/shared/inputs/MoneyInput';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { PercentageSlider } from '@/components/shared/inputs/PercentageSlider';
import { BaseCard } from '@/components/ui/cards/BaseCard';
import { Button } from '@/components/ui/Button';
```

#### PaycheckAllocator Patterns to Adapt
```typescript
// Study and adapt these patterns from existing PaycheckAllocator
interface PayFrequencyPattern {
  frequency: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';
  multiplier: number;
  displayName: string;
}

// Adapt this pattern for retirement contribution frequency
interface ContributionFrequency {
  frequency: 'monthly' | 'quarterly' | 'annually';
  multiplier: number;
  displayName: string;
}
```

### Technical Requirements

#### 1. Personal Information Card Component
```typescript
interface PersonalInfoCardProps {
  currentAge: number;
  retirementAge: number;
  annualIncome: number;
  state: string;
  onUpdate: (updates: Partial<PersonalInfo>) => void;
  validationErrors?: ValidationErrors;
}

export function PersonalInfoCard(props: PersonalInfoCardProps): JSX.Element {
  // MUST use existing MoneyInput for income
  // MUST use existing StateSelector for state (with tax integration)
  // MUST use existing validation patterns
}
```

#### 2. Financial Details Card Component  
```typescript
interface FinancialDetailsCardProps {
  currentSavings: number;
  monthlyContribution: number;
  employerMatch: number;
  expectedReturn: number;
  onUpdate: (updates: Partial<FinancialDetails>) => void;
  validationErrors?: ValidationErrors;
}

export function FinancialDetailsCard(props: FinancialDetailsCardProps): JSX.Element {
  // MUST use existing MoneyInput for all currency fields
  // MUST use existing PercentageSlider for expectedReturn
  // MUST use PaycheckAllocator frequency patterns
}
```

#### 3. Advanced Assumptions Component
```typescript
interface AdvancedAssumptionsProps {
  inflationRate: number;
  withdrawalRate: number;
  socialSecurity: boolean;
  taxStrategy: 'traditional' | 'roth' | 'mixed';
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  onUpdate: (updates: Partial<AdvancedAssumptions>) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export function AdvancedAssumptions(props: AdvancedAssumptionsProps): JSX.Element {
  // MUST use existing PercentageSlider components
  // MUST use collapsible pattern from PaycheckAllocator
  // MUST include BufoIndex philosophy in risk profile descriptions
}
```

### Component Architecture

#### Main Container Enhancement
```typescript
// Enhance existing RetirementInputs.tsx
export function RetirementInputs({
  scenario,
  onScenarioChange,
  validationErrors,
  loading
}: RetirementInputsProps): JSX.Element {
  return (
    <div className="space-y-6">
      <PersonalInfoCard
        // Props from scenario state
        onUpdate={(updates) => onScenarioChange({...scenario, ...updates})}
        validationErrors={validationErrors?.personalInfo}
      />
      
      <FinancialDetailsCard
        // Props from scenario state
        onUpdate={(updates) => onScenarioChange({...scenario, ...updates})}
        validationErrors={validationErrors?.financialDetails}
      />
      
      <AdvancedAssumptions
        // Props from scenario state with collapsible behavior
        expanded={showAdvanced}
        onToggleExpanded={() => setShowAdvanced(!showAdvanced)}
      />
    </div>
  );
}
```

### Mobile-First Design Requirements

#### Responsive Design Patterns
```typescript
// MUST follow these mobile-first patterns
const mobileFirstClasses = {
  card: "p-4 md:p-6 rounded-lg border bg-card",
  input: "w-full text-base md:text-sm", // Larger text on mobile
  button: "min-h-12 md:min-h-10 touch-manipulation", // Touch-friendly
  section: "space-y-4 md:space-y-3",
  grid: "grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
};
```

#### Touch-Friendly Interactions
- **Minimum 44px touch targets** for all interactive elements
- **Proper spacing** between adjacent interactive elements  
- **Large, clear labels** on mobile devices
- **Optimized input types** (numeric keyboards for numbers)
- **Swipe gestures** for collapsible sections (optional enhancement)

### Validation & Error Handling

#### Input Validation Patterns
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function validatePersonalInfo(info: PersonalInfo): ValidationResult {
  // Age validation - reasonable retirement age ranges
  // Income validation - positive values, reasonable maximums
  // State validation - valid state codes only
}

function validateFinancialDetails(details: FinancialDetails): ValidationResult {
  // Savings validation - non-negative values
  // Contribution validation - reasonable percentages of income
  // Return expectations - realistic ranges (3-12%)
}
```

#### Error Display Patterns
```typescript
// MUST use existing error display patterns from PaycheckAllocator
interface FieldError {
  field: string;
  message: string;
  type: 'error' | 'warning';
}

// Follow existing error styling and positioning
```

### Integration Requirements

#### State Management Integration
```typescript
// MUST integrate with existing URL hash state management
import { useRetirementState, updateRetirementState } from '@/lib/state/retirement';

export function RetirementInputs() {
  const [scenario, setScenario] = useRetirementState();
  
  const handleScenarioChange = (updates: Partial<RetirementScenario>) => {
    const newScenario = { ...scenario, ...updates };
    setScenario(newScenario);
    updateRetirementState(newScenario); // URL hash persistence
  };
}
```

#### Accessibility Requirements (WCAG 2.1 AA)
```typescript
// MUST include proper accessibility attributes
const accessibilityProps = {
  'aria-label': 'Current annual income',
  'aria-describedby': 'income-help-text',
  'aria-invalid': hasError ? 'true' : 'false',
  'role': 'group',
  'aria-labelledby': 'section-heading'
};
```

### BufoIndex Philosophy Integration

#### Risk Profile Descriptions (MANDATORY)
```typescript
const riskProfileDescriptions = {
  conservative: "Prioritizes capital preservation with lower volatility. May sacrifice long-term growth for stability.",
  moderate: "Balances growth potential with risk management. Suitable for most retirement timelines.",
  optimizer: "Maximizes mathematical efficiency and long-term returns. Challenges conventional wisdom about age-based allocation." // BufoIndex contrarian
};
```

#### Contrarian Messaging
- **Challenge conventional age-based allocation** in risk profile descriptions
- **Emphasize opportunity cost** in contribution suggestions
- **Question traditional retirement age assumptions** with Coast FIRE concepts
- **No conventional wisdom language** in help text or placeholders

### Success Criteria ✅
- [ ] All input components reuse existing UI patterns successfully
- [ ] PersonalInfoCard uses MoneyInput and StateSelector correctly
- [ ] FinancialDetailsCard adapts PaycheckAllocator frequency patterns
- [ ] AdvancedAssumptions includes collapsible behavior
- [ ] Mobile-first responsive design implemented throughout
- [ ] Touch-friendly interactions on all mobile devices
- [ ] WCAG 2.1 AA accessibility compliance verified
- [ ] Input validation uses existing error handling patterns
- [ ] URL hash state persistence working correctly
- [ ] BufoIndex contrarian philosophy integrated in UI text
- [ ] No conventional wisdom language in any user-facing text

### Agent Communication
**Progress Updates:** Update this file every hour with completion status
**Component Reuse Status:** Document successful reuse of existing components
**Mobile Testing Results:** Include testing on actual mobile devices
**Completion Status:** Mark complete only when ALL success criteria met

### Quality Validation Required
```bash
# MUST pass before marking complete
npm run test:components
npm run test:accessibility
npm run type-check
npm run build
# Manual testing on mobile devices required
```

**Agent 4 Ready for Launch** ✅