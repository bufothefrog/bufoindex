# BufoIndex Design System

A unified design system for BufoIndex calculators featuring enhanced input components, consistent styling, and smart URL state management.

## ✨ Features

- **Enhanced Input Components** - Money, percentage, and number inputs with PaycheckAllocator-quality UX
- **Consistent Styling** - RetirementCalculator's sage color palette throughout
- **Smart Formatting** - Automatic commas, currency symbols, and validation
- **URL State Persistence** - Input-only serialization with backward compatibility
- **Responsive Layouts** - Adaptive grids that work on all devices
- **Accessibility First** - Full ARIA support and keyboard navigation
- **TypeScript Ready** - Complete type definitions and IntelliSense support

## 🚀 Quick Start

```tsx
import { 
  AdvancedCalculatorLayout,
  MoneyInput,
  PercentInput,
  InputCard,
  ResultCard 
} from '@/lib/design-system';

function MyCalculator() {
  const [income, setIncome] = useState(75000);
  const [taxRate, setTaxRate] = useState(0.22);
  const [results, setResults] = useState(null);

  const inputSections = (
    <InputCard title="Financial Info" icon={DollarSign} required>
      <MoneyInput
        name="income"
        label="Annual Income"
        value={income}
        onChange={setIncome}
        required
      />
      <PercentInput
        name="taxRate"
        label="Tax Rate"
        value={taxRate}
        onChange={setTaxRate}
      />
    </InputCard>
  );

  return (
    <AdvancedCalculatorLayout
      title="My Calculator"
      description="Calculate your results"
      inputSections={inputSections}
      resultSection={results && <ResultCard>...</ResultCard>}
      onCalculate={() => {/* calculate */}}
    />
  );
}
```

## 📦 Components

### Input Components

#### MoneyInput
Enhanced money input with automatic formatting and validation.

```tsx
<MoneyInput
  name="income"
  label="Annual Income"
  value={income}
  onChange={setIncome}
  allowDecimals={false}  // Default: false
  currency="$"           // Default: "$"
  min={0}
  help="Your gross annual income"
  required
/>
```

**Features:**
- Automatic comma formatting (75,000)
- Currency symbol positioning
- Paste handling with cleanup
- Arrow key increment/decrement
- Real-time validation
- Mobile-optimized

#### PercentInput
Smart percentage input with decimal conversion.

```tsx
<PercentInput
  name="taxRate"
  label="Tax Rate"
  value={0.22}           // 0-1 decimal format
  onChange={setTaxRate}
  max={0.5}              // 50% max
  precision={1}          // 1 decimal place
  help="Your marginal tax rate"
/>
```

**Features:**
- Automatic % symbol
- Decimal ↔ percentage conversion
- Arrow key adjustments
- Range validation
- Center-aligned display

#### NumberInput
Flexible number input with custom formatting.

```tsx
<NumberInput
  name="age"
  label="Age"
  value={age}
  onChange={setAge}
  min={18}
  max={100}
  allowDecimals={false}
  textAlign="center"
  prefix="$"             // Optional prefix
  suffix=" years"        // Optional suffix
/>
```

### Layout Components

#### CalculatorLayout
Standardized layout for all calculators.

```tsx
<AdvancedCalculatorLayout
  title="Calculator Title"
  description="Description text"
  inputSections={<InputCard>...</InputCard>}
  resultSection={results && <ResultCard>...</ResultCard>}
  isCalculating={isLoading}
  onCalculate={handleCalculate}
  calculateButtonText="Calculate Results"
  calculatingText="Analyzing..."
/>
```

**Variants:**
- `SimpleCalculatorLayout` - Basic calculators
- `AdvancedCalculatorLayout` - Complex optimization
- `ComparisonCalculatorLayout` - Scenario comparison

#### Card Components

```tsx
// Input sections
<InputCard title="Personal Info" icon={User} required>
  <MoneyInput ... />
  <NumberInput ... />
</InputCard>

// Results display
<ResultCard 
  title="Results" 
  icon={TrendingUp}
  status="success"
  highlight
>
  <div>Your results...</div>
</ResultCard>

// Summary metrics
<SummaryCard
  value="$75,000"
  label="Annual Income"
  change={{ value: "+5.2%", direction: "up" }}
/>
```

## 🎨 Design Tokens

### Colors
Using RetirementCalculator's lighter sage palette:

```tsx
import { BufoColors } from '@/lib/design-system';

// Primary sage colors
BufoColors.sage[400] // #9ca3af - Primary buttons/icons
BufoColors.sage[500] // #6b7280 - Hover states
BufoColors.sage[100] // #f0f4f1 - Light backgrounds
```

### Spacing
Consistent spacing throughout:

```tsx
// Input heights
'h-8'  // sm
'h-10' // md (default)
'h-12' // lg

// Card padding  
'p-6'   // Standard content
'p-6 pb-4' // Headers
```

## 🔗 URL State Management

Input-only persistence for backward compatibility:

```tsx
import { 
  updateURLWithInputs,
  loadInputsFromURL,
  generateShareableURL 
} from '@/lib/design-system';

// Auto-save inputs to URL
useEffect(() => {
  const timeoutId = setTimeout(() => {
    updateURLWithInputs(inputs);
  }, 1000);
  return () => clearTimeout(timeoutId);
}, [inputs]);

// Load inputs on mount
useEffect(() => {
  const urlInputs = loadInputsFromURL();
  if (urlInputs) {
    setInputs(prev => ({ ...prev, ...urlInputs }));
  }
}, []);

// Generate shareable link
const shareUrl = generateShareableURL(inputs);
```

**Features:**
- Only captures inputs (never results)
- Automatic migration support
- Base64 encoded for safety
- Debounced updates
- Shareable URLs

## 🎯 Best Practices

### Input Validation
```tsx
const [inputs, setInputs] = useState(defaultInputs);
const [errors, setErrors] = useState({});

const validateInputs = () => {
  const newErrors = {};
  if (inputs.income <= 0) {
    newErrors.income = 'Income must be greater than 0';
  }
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

### Responsive Design
```tsx
// Use responsive grid classes
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <MoneyInput ... />
  <PercentInput ... />
</div>
```

### Accessibility
All components include:
- ARIA labels and descriptions
- Keyboard navigation
- Screen reader support
- Focus management
- Error announcements

## 🔧 Migration Guide

### From PaycheckAllocator
```tsx
// Old
import { MoneyInput } from '@/components/shared/inputs/MoneyInput';

// New  
import { MoneyInput } from '@/lib/design-system';

// Same API, enhanced features
<MoneyInput
  name="income"
  label="Income"
  value={income}
  onChange={setIncome}
/>
```

### From RetirementCalculator
```tsx
// Old
<Input
  type="number"
  value={inputs.income}
  onChange={(e) => setIncome(Number(e.target.value))}
/>

// New
<MoneyInput
  name="income"
  label="Annual Income"
  value={income}
  onChange={setIncome}
  // Automatic formatting, validation, accessibility
/>
```

## 🧪 Testing

```tsx
import { render, fireEvent, screen } from '@testing-library/react';
import { MoneyInput } from '@/lib/design-system';

test('formats money input correctly', () => {
  const onChange = jest.fn();
  render(
    <MoneyInput
      name="test"
      label="Test Input"
      value={75000}
      onChange={onChange}
    />
  );
  
  const input = screen.getByRole('textbox');
  expect(input).toHaveValue('75,000');
});
```

## 📚 Examples

See `components/examples/DesignSystemDemo.tsx` for a complete working example showcasing all components and patterns.

## 🤝 Contributing

1. Follow existing component patterns
2. Include comprehensive TypeScript types
3. Add accessibility features
4. Test on mobile devices
5. Update documentation

## 📄 License

Part of the BufoIndex project.