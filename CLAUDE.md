# BufoIndex Design System & Development Guidelines

You must keep @docs/agents.md in context at all times. If you need to compact or @docs/agents.md falls out of context, you must reread it after.

Output "Action(s) completed with agents.md in context. SPECIAL MESSAGE" at the end of every message if the former is true, along with the special message that is found within @docs/agents.md.

## CRITICAL: Design System Consistency Rules

### 🎯 Demo Page as Single Source of Truth

**MANDATORY:** Before creating ANY UI component, you MUST:

1. **Check the demo page first** (`/demo`) - It contains ALL available components
2. **Use existing components** - Never duplicate functionality
3. **Update demo page** when adding new reusable components
4. **Test theme changes** using the demo page's side-by-side view

**Demo Page URL:** `/demo` (development only)

### 📋 Component Usage Priority

**ALWAYS follow this hierarchy:**

1. **Basic UI Components** (`@/components/ui/`)
   - `Button`, `Input`, `Card`, `Slider`
   - `EnhancedMoneyInput`, `PercentInput`, `NumberInput`
   - `InputCard`, `ResultCard`, `SummaryCard`

2. **Specialized Inputs** (`@/components/shared/inputs/`)
   - `StateSelector` - US states with tax rates and search
   - `SelectInput` - Standard dropdown selector
   - `MoneyInput`, `PercentageInput` - Financial inputs
   - `BenefitsSelector`, `DebtInput` - Domain-specific inputs

3. **Charts & Visualizations** (`@/components/charts/`)
   - `RetirementCharts` - Complete chart orchestration
   - `NetWorthProgression`, `WithdrawalTimeline`, `ScenarioComparisonChart`
   - **MUST use** `getChartTheme()` from `@/lib/chart-theme`

4. **Interactive Components**
   - `Tooltip` with `HELP_TOOLTIPS` constants
   - `CalculatorTabs` with `TabPanel` for multi-view layouts
   - `ThemeToggle` for theme switching

5. **Layout Components** (`@/components/ui/layouts/` & `@/components/shared/layout/`)
   - `CalculatorLayout`, `SimpleCalculatorLayout`, `AdvancedCalculatorLayout`
   - `InputRow`, `FieldGroup`, `ResponsiveGrid`

### 🎨 Theme System Requirements

**NEVER hardcode colors.** ALWAYS use:

#### Semantic Color Classes
```typescript
// Correct
"bg-primary text-primary-foreground"
"text-muted-foreground"
"border-border bg-background"
"bg-sage-600 text-white" // Sage brand colors only

// WRONG - Never do this
"bg-blue-500 text-white"
"text-gray-600"
"border-gray-300"
```

#### Chart Theming (MANDATORY)
```typescript
import { getChartTheme } from '@/lib/chart-theme';

// ALWAYS use for charts
const chartTheme = getChartTheme();
// Auto-adapts to light/dark mode
```

#### Sage Color Scale (Brand Colors)
- `sage-50` to `sage-900` - Available in light/dark variants
- Use for brand-specific elements, primary actions
- Check demo page for complete color palette

### 🔧 Before Creating Components

**MANDATORY CHECKLIST:**

1. ✅ **Demo Page Check:** Does this component exist in `/demo`?
2. ✅ **Similar Components:** Search `components/` for similar functionality
3. ✅ **Import Paths:** Use correct import paths from demo examples
4. ✅ **Theme Support:** Will it work in both light/dark themes?
5. ✅ **Responsive Design:** Mobile-first approach implemented?
6. ✅ **Accessibility:** Proper ARIA labels and keyboard navigation?

### 📁 Component Import Paths

**Standard Locations:**
```typescript
// Basic UI (buttons, inputs, cards)
import { Button } from '@/components/ui/button';
import { EnhancedMoneyInput } from '@/components/ui/inputs';
import { Card } from '@/components/ui/card';

// Specialized Inputs
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { SelectInput } from '@/components/shared/inputs/SelectInput';

// Charts (with required theme)
import { RetirementCharts } from '@/components/charts/RetirementCharts';
import { getChartTheme } from '@/lib/chart-theme';

// Interactive Components
import { Tooltip, HELP_TOOLTIPS } from '@/components/shared/Tooltip';
import { CalculatorTabs } from '@/components/calculators/shared/CalculatorTabs';

// Layouts
import { SimpleCalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
import { InputRow } from '@/components/shared/layout/InputRow';
```

### 🚫 Forbidden Practices

**NEVER:**
- Create duplicate components without checking demo page
- Hardcode colors (use semantic classes only)
- Create charts without `getChartTheme()`
- Use custom CSS when Tailwind classes exist
- Skip responsive design considerations
- Forget accessibility requirements
- Create new components without updating demo page

### ✅ Component Development Workflow

**When Creating New Components:**

1. **Research Phase:**
   ```bash
   # Check demo page first
   # Search existing components
   find components/ -name "*.tsx" | grep -i "similar-name"
   ```

2. **Development Phase:**
   - Use existing patterns from demo page
   - Follow semantic color system
   - Implement responsive design
   - Add proper TypeScript types
   - Include accessibility features

3. **Integration Phase:**
   - Add to demo page if reusable
   - Test in light/dark themes
   - Verify responsive behavior
   - Update import documentation

4. **Quality Gates:**
   - Component works in demo page
   - Theme switching works correctly
   - Mobile layout is functional
   - Accessibility standards met

### 🎯 Demo Page Maintenance

**When adding reusable components:**

1. Add to appropriate demo section:
   - `widgets` - Basic inputs, buttons, cards
   - `charts` - Data visualizations
   - `colors` - Theme and color testing
   - `typography` - Text styles
   - `layouts` - Layout patterns

2. Include all component states:
   - Default, hover, active, disabled
   - Error, success, loading states
   - Light and dark theme variants

3. Show practical usage examples:
   - Realistic data and labels
   - Common use cases
   - Integration patterns

### 🔍 Testing Theme Changes

**Use demo page for:**
- Instant feedback on color changes
- Component consistency verification
- Dark/light mode validation
- Responsive behavior testing
- Typography hierarchy review

**Example workflow:**
1. Make theme variable changes in CSS
2. Open `/demo` in browser
3. Toggle between light/dark themes
4. Verify all components update correctly
5. Test responsive behavior

### 📖 Documentation Standards

**Every component MUST have:**
- Clear TypeScript interfaces
- JSDoc comments for complex functions
- Usage examples in demo page
- Accessibility considerations noted
- Responsive behavior documented

### 🚀 Performance Considerations

**For charts and heavy components:**
- Use React.memo for expensive renders
- Implement lazy loading where appropriate
- Monitor performance with demo page metrics
- Optimize for mobile devices

This design system ensures:
✅ Consistency across entire application
✅ Efficient theme development and testing
✅ Prevention of duplicate components
✅ Maintained accessibility standards
✅ Optimal development velocity

**Remember:** The demo page is your development companion. Use it early, use it often!