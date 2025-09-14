'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { 
  EnhancedMoneyInput, 
  PercentInput, 
  NumberInput 
} from '@/components/ui/inputs';
import { 
  InputCard, 
  ResultCard, 
  SummaryCard 
} from '@/components/ui/cards/BaseCard';
import { 
  SimpleCalculatorLayout, 
  AdvancedCalculatorLayout 
} from '@/components/ui/layouts/CalculatorLayout';
import { 
  Palette,
  Type, 
  Sliders,
  Calculator, 
  DollarSign, 
  Settings,
  User,
  Moon,
  Sun,
  Loader2,
  Heart,
  Star,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface DemoState {
  basicInputs: {
    text: string;
    number: number;
    money: number;
    percent: number;
    slider: number;
  };
  calculatorDemo: {
    income: number;
    expenses: number;
    age: number;
    savingsRate: number;
  };
}

export default function ComprehensiveDemo() {
  const { resolvedTheme } = useTheme();
  const [demoState, setDemoState] = React.useState<DemoState>({
    basicInputs: {
      text: 'Sample text input',
      number: 42,
      money: 75000,
      percent: 25,
      slider: 50
    },
    calculatorDemo: {
      income: 75000,
      expenses: 45000,
      age: 30,
      savingsRate: 20
    }
  });

  const [showSideBySide, setShowSideBySide] = React.useState(true);
  const [activeSection, setActiveSection] = React.useState<'widgets' | 'colors' | 'typography' | 'layouts'>('widgets');

  // Theme colors for demonstration
  const sageColors = {
    50: '#f6f7f6',
    100: '#e3e8e3',
    200: '#c7d1c7',
    300: '#9fb09f',
    400: '#7fb069',
    500: '#5e8b4e',
    600: '#4a6d3c',
    700: '#3d5732',
    800: '#334729',
    900: '#2d3d24'
  };

  const updateBasicInput = <K extends keyof DemoState['basicInputs']>(
    key: K, 
    value: DemoState['basicInputs'][K]
  ) => {
    setDemoState(prev => ({
      ...prev,
      basicInputs: { ...prev.basicInputs, [key]: value }
    }));
  };

  const updateCalculatorDemo = <K extends keyof DemoState['calculatorDemo']>(
    key: K, 
    value: DemoState['calculatorDemo'][K]
  ) => {
    setDemoState(prev => ({
      ...prev,
      calculatorDemo: { ...prev.calculatorDemo, [key]: value }
    }));
  };

  const renderWidgetShowcase = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Widget & Component Showcase</h2>
        <p className="text-muted-foreground">
          All UI components and widgets with various states and expressions
        </p>
      </div>

      {/* Basic Input Components */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="w-5 h-5" />
            Input Components
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Standard Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Standard Text Input</label>
              <Input
                value={demoState.basicInputs.text}
                onChange={(e) => updateBasicInput('text', e.target.value)}
                placeholder="Enter text here..."
              />
              <p className="text-xs text-muted-foreground">Basic text input with focus states</p>
            </div>

            {/* Number Input */}
            <div className="space-y-2">
              <NumberInput
                name="demo-number"
                label="Number Input"
                value={demoState.basicInputs.number}
                onChange={(value) => updateBasicInput('number', value)}
                min={0}
                max={100}
                help="Enhanced number input with validation"
              />
            </div>

            {/* Money Input */}
            <div className="space-y-2">
              <EnhancedMoneyInput
                name="demo-money"
                label="Money Input"
                value={demoState.basicInputs.money}
                onChange={(value) => updateBasicInput('money', value)}
                help="Formatted currency input with $ prefix"
              />
            </div>

            {/* Percent Input */}
            <div className="space-y-2">
              <PercentInput
                name="demo-percent"
                label="Percent Input"
                value={demoState.basicInputs.percent}
                onChange={(value) => updateBasicInput('percent', value)}
                help="Percentage input with % suffix"
              />
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Slider Input</label>
              <Slider
                value={[demoState.basicInputs.slider]}
                onValueChange={(value) => updateBasicInput('slider', value[0])}
                max={100}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Value: {demoState.basicInputs.slider}%</p>
            </div>

            {/* Theme Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Theme Toggle</label>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <span className="text-sm text-muted-foreground">
                  Current: {resolvedTheme}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Button Variants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Button Variants & States
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Button Variants */}
            <div>
              <h4 className="text-sm font-medium mb-3">Variants</h4>
              <div className="flex flex-wrap gap-3">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>

            {/* Button Sizes */}
            <div>
              <h4 className="text-sm font-medium mb-3">Sizes</h4>
              <div className="flex items-end gap-3">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon">
                  <Heart className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Button States */}
            <div>
              <h4 className="text-sm font-medium mb-3">States</h4>
              <div className="flex gap-3">
                <Button>Normal</Button>
                <Button disabled>Disabled</Button>
                <Button>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading
                </Button>
                <Button>
                  <Star className="mr-2 h-4 w-4" />
                  With Icon
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Variants */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SummaryCard
          title="Success Metric"
          value="$125,000"
          label="Annual savings"
          change={{ value: "+15%", direction: "up" }}
        />
        
        <SummaryCard
          title="Warning Metric"
          value="3.2 months"
          label="Emergency fund"
          change={{ value: "Below target", direction: "down" }}
        />

        <SummaryCard
          title="Neutral Metric"
          value="7.5%"
          label="Return rate"
          change={{ value: "On track", direction: "neutral" }}
        />
      </div>

      {/* Result Cards with Different States */}
      <div className="space-y-4">
        <ResultCard title="Success Result" status="success" highlight={true}>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span>Your optimization strategy is performing excellently!</span>
          </div>
        </ResultCard>

        <ResultCard title="Warning Result" status="warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span>Consider increasing your emergency fund to 3 months of expenses.</span>
          </div>
        </ResultCard>

        <ResultCard title="Information Result">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            <span>This calculation assumes a 7% annual return rate.</span>
          </div>
        </ResultCard>
      </div>

      {/* Input Cards with Complex Layouts */}
      <div className="grid md:grid-cols-2 gap-6">
        <InputCard title="Personal Information" icon={User} required>
          <div className="space-y-4">
            <NumberInput
              name="age"
              label="Age"
              value={demoState.calculatorDemo.age}
              onChange={(value) => updateCalculatorDemo('age', value)}
              min={18}
              max={100}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="First Name" />
              <Input placeholder="Last Name" />
            </div>
          </div>
        </InputCard>

        <InputCard title="Financial Details" icon={DollarSign} collapsible>
          <div className="space-y-4">
            <EnhancedMoneyInput
              name="annual-income"
              label="Annual Income"
              value={demoState.calculatorDemo.income}
              onChange={(value) => updateCalculatorDemo('income', value)}
              required
            />
            <EnhancedMoneyInput
              name="annual-expenses"
              label="Annual Expenses"
              value={demoState.calculatorDemo.expenses}
              onChange={(value) => updateCalculatorDemo('expenses', value)}
              required
            />
          </div>
        </InputCard>
      </div>
    </div>
  );

  const renderColorPalette = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Color Palette & Theme System</h2>
        <p className="text-muted-foreground">
          Comprehensive color system for both light and dark themes
        </p>
      </div>

      {/* Primary Sage Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Sage Color Scale (Brand Colors)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
            {Object.entries(sageColors).map(([shade, hex]) => (
              <div key={shade} className="text-center">
                <div 
                  className="w-full h-16 rounded-md border border-border mb-2"
                  style={{ backgroundColor: hex }}
                />
                <div className="text-xs font-mono">
                  <div>sage-{shade}</div>
                  <div className="text-muted-foreground">{hex}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Semantic Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Semantic Color System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'Background', class: 'bg-background text-foreground', desc: 'Main background' },
              { name: 'Card', class: 'bg-card text-card-foreground border border-border', desc: 'Card backgrounds' },
              { name: 'Primary', class: 'bg-primary text-primary-foreground', desc: 'Primary actions' },
              { name: 'Secondary', class: 'bg-secondary text-secondary-foreground', desc: 'Secondary elements' },
              { name: 'Muted', class: 'bg-muted text-muted-foreground', desc: 'Subdued content' },
              { name: 'Accent', class: 'bg-accent text-accent-foreground', desc: 'Accent highlights' },
              { name: 'Destructive', class: 'bg-destructive text-destructive-foreground', desc: 'Error states' }
            ].map((color) => (
              <div key={color.name} className="space-y-2">
                <div className={`p-4 rounded-md ${color.class}`}>
                  <div className="font-semibold">{color.name}</div>
                  <div className="text-sm opacity-90">{color.desc}</div>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {color.class}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Border and Input Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Interactive Elements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium mb-3">Borders & Inputs</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Input placeholder="Normal border" />
                  <Input placeholder="Focus state" className="ring-2 ring-ring ring-offset-2" />
                </div>
                <div className="space-y-2">
                  <div className="p-3 border border-border rounded-md">border</div>
                  <div className="p-3 border border-input rounded-md bg-input">input background</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTypography = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Typography System</h2>
        <p className="text-muted-foreground">
          Font weights, sizes, and text treatments
        </p>
      </div>

      {/* Headings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="w-5 h-5" />
            Heading Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold">Heading 1 - Main Title</h1>
              <code className="text-xs text-muted-foreground">text-4xl font-bold</code>
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl font-bold">Heading 2 - Section Title</h2>
              <code className="text-xs text-muted-foreground">text-3xl font-bold</code>
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold">Heading 3 - Subsection</h3>
              <code className="text-xs text-muted-foreground">text-2xl font-semibold</code>
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-semibold">Heading 4 - Card Title</h4>
              <code className="text-xs text-muted-foreground">text-xl font-semibold</code>
            </div>
            <div className="space-y-1">
              <h5 className="text-lg font-medium">Heading 5 - Small Section</h5>
              <code className="text-xs text-muted-foreground">text-lg font-medium</code>
            </div>
            <div className="space-y-1">
              <h6 className="text-base font-medium">Heading 6 - Label</h6>
              <code className="text-xs text-muted-foreground">text-base font-medium</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Body Text */}
      <Card>
        <CardHeader>
          <CardTitle>Body Text & Paragraphs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="text-lg">Large body text for important content and introductions.</div>
              <code className="text-xs text-muted-foreground">text-lg</code>
            </div>
            <div className="space-y-2">
              <div className="text-base">
                Regular body text for main content. This is the default size for most paragraph content 
                and provides good readability across all devices. Lorem ipsum dolor sit amet, consectetur 
                adipiscing elit.
              </div>
              <code className="text-xs text-muted-foreground">text-base</code>
            </div>
            <div className="space-y-2">
              <div className="text-sm">
                Small text for secondary information, captions, and help text. Often used for 
                form descriptions and metadata.
              </div>
              <code className="text-xs text-muted-foreground">text-sm</code>
            </div>
            <div className="space-y-2">
              <div className="text-xs">Extra small text for fine print, code snippets, and minimal details.</div>
              <code className="text-xs text-muted-foreground">text-xs</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Font Weights & Styles */}
      <Card>
        <CardHeader>
          <CardTitle>Font Weights & Text Styles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-lg font-semibold">Font Weights</h4>
              <div className="space-y-3">
                <div>
                  <div className="font-light text-lg">Light weight text</div>
                  <code className="text-xs text-muted-foreground">font-light</code>
                </div>
                <div>
                  <div className="font-normal text-lg">Normal weight text</div>
                  <code className="text-xs text-muted-foreground">font-normal</code>
                </div>
                <div>
                  <div className="font-medium text-lg">Medium weight text</div>
                  <code className="text-xs text-muted-foreground">font-medium</code>
                </div>
                <div>
                  <div className="font-semibold text-lg">Semibold weight text</div>
                  <code className="text-xs text-muted-foreground">font-semibold</code>
                </div>
                <div>
                  <div className="font-bold text-lg">Bold weight text</div>
                  <code className="text-xs text-muted-foreground">font-bold</code>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-lg font-semibold">Text Colors & States</h4>
              <div className="space-y-3">
                <div>
                  <div className="text-foreground">Primary text color</div>
                  <code className="text-xs text-muted-foreground">text-foreground</code>
                </div>
                <div>
                  <div className="text-muted-foreground">Muted text color</div>
                  <code className="text-xs text-muted-foreground">text-muted-foreground</code>
                </div>
                <div>
                  <div className="text-primary">Primary accent color</div>
                  <code className="text-xs text-muted-foreground">text-primary</code>
                </div>
                <div>
                  <div className="text-destructive">Error/destructive color</div>
                  <code className="text-xs text-muted-foreground">text-destructive</code>
                </div>
                <div>
                  <div className="font-mono text-sm bg-muted p-2 rounded">Monospace code text</div>
                  <code className="text-xs text-muted-foreground">font-mono</code>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderLayoutShowcase = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Layout System</h2>
        <p className="text-muted-foreground">
          Calculator layouts and responsive design patterns
        </p>
      </div>

      {/* Simple Layout Demo */}
      <Card>
        <CardHeader>
          <CardTitle>Simple Calculator Layout</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 p-4 rounded-lg">
            <SimpleCalculatorLayout
              title="Simple Layout Demo"
              description="Minimal calculator layout for basic financial tools"
              inputSections={
                <InputCard title="Basic Inputs" icon={Calculator}>
                  <div className="space-y-4">
                    <EnhancedMoneyInput
                      name="simple-income"
                      label="Monthly Income"
                      value={5000}
                      onChange={() => {}}
                    />
                    <PercentInput
                      name="simple-rate"
                      label="Savings Rate"
                      value={20}
                      onChange={() => {}}
                    />
                  </div>
                </InputCard>
              }
              resultSection={
                <SummaryCard
                  title="Monthly Savings"
                  value="$1,000"
                  label="Available to invest"
                />
              }
              isCalculating={false}
              onCalculate={() => {}}
              calculateButtonText="Calculate Simple"
              disclaimer="Simple layout demonstration"
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced Layout Demo */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Calculator Layout</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 p-4 rounded-lg">
            <AdvancedCalculatorLayout
              title="Advanced Layout Demo"
              description="Complex calculator with multiple sections and optimization features"
              inputSections={
                <div className="space-y-6">
                  <InputCard title="Primary Inputs" icon={DollarSign}>
                    <div className="grid md:grid-cols-2 gap-4">
                      <EnhancedMoneyInput
                        name="advanced-income"
                        label="Annual Income"
                        value={75000}
                        onChange={() => {}}
                      />
                      <NumberInput
                        name="advanced-age"
                        label="Age"
                        value={30}
                        onChange={() => {}}
                      />
                    </div>
                  </InputCard>
                  <InputCard title="Advanced Options" icon={Settings} collapsible>
                    <div className="text-sm text-muted-foreground">
                      Advanced settings and parameters
                    </div>
                  </InputCard>
                </div>
              }
              resultSection={
                <div className="space-y-4">
                  <SummaryCard
                    title="Optimization Score"
                    value="87%"
                    label="Tax efficiency"
                    change={{ value: "+5%", direction: "up" }}
                  />
                  <ResultCard title="Recommendations" status="success">
                    <div className="text-sm">Your portfolio is well optimized!</div>
                  </ResultCard>
                </div>
              }
              isCalculating={false}
              onCalculate={() => {}}
              calculateButtonText="Optimize Portfolio"
              disclaimer="Advanced layout demonstration"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderThemeComparison = () => {
    if (!showSideBySide) {
      return renderCurrentSection();
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">BufoIndex Design System Demo</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Comprehensive showcase of themes, components, and layouts
          </p>
          
          {/* Demo Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Theme:</span>
              <ThemeToggle />
              <span className="text-xs text-muted-foreground">
                {resolvedTheme}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">View:</span>
              <Button
                variant={showSideBySide ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSideBySide(!showSideBySide)}
              >
                {showSideBySide ? "Side by Side" : "Single View"}
              </Button>
            </div>
          </div>

          {/* Section Navigation */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[
              { key: 'widgets', label: 'Widgets & Components', icon: Sliders },
              { key: 'colors', label: 'Color Palette', icon: Palette },
              { key: 'typography', label: 'Typography', icon: Type },
              { key: 'layouts', label: 'Layouts', icon: Calculator }
            ].map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant={activeSection === key ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSection(key as 'widgets' | 'colors' | 'typography' | 'layouts')}
                className="flex items-center gap-2"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Side-by-side comparison with unified scrolling */}
        <div className="w-full max-w-[95vw] mx-auto">
          <div className="max-h-[80vh] overflow-y-auto">
            <div className="grid lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-4 lg:gap-6 xl:gap-8">
              {/* Light Theme - Always Light */}
              <div className="light" style={{ colorScheme: 'light' }}>
                <Card className="h-full">
                  <CardHeader className="bg-background border-b sticky top-0 z-10">
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Sun className="w-5 h-5" />
                      Light Theme
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6 bg-background">
                    {renderCurrentSection()}
                  </CardContent>
                </Card>
              </div>

              {/* Dark Theme - Always Dark */}
              <div className="dark" style={{ colorScheme: 'dark' }}>
                <Card className="h-full">
                  <CardHeader className="bg-background border-b sticky top-0 z-10">
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Moon className="w-5 h-5" />
                      Dark Theme
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6 bg-background">
                    {renderCurrentSection()}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentSection = () => {
    switch (activeSection) {
      case 'widgets':
        return renderWidgetShowcase();
      case 'colors':
        return renderColorPalette();
      case 'typography':
        return renderTypography();
      case 'layouts':
        return renderLayoutShowcase();
      default:
        return renderWidgetShowcase();
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-6 xl:p-8">
      {showSideBySide ? renderThemeComparison() : (
        <div className="max-w-7xl xl:max-w-[90vw] 2xl:max-w-[85vw] mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">BufoIndex Design System Demo</h1>
            <p className="text-lg text-muted-foreground mb-6">
              Comprehensive showcase of themes, components, and layouts
            </p>
            
            {/* Demo Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Theme:</span>
                <ThemeToggle />
                <span className="text-xs text-muted-foreground">
                  {resolvedTheme}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">View:</span>
                <Button
                  variant={showSideBySide ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowSideBySide(!showSideBySide)}
                >
                  {showSideBySide ? "Side by Side" : "Single View"}
                </Button>
              </div>
            </div>

            {/* Section Navigation */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {[
                { key: 'widgets', label: 'Widgets & Components', icon: Sliders },
                { key: 'colors', label: 'Color Palette', icon: Palette },
                { key: 'typography', label: 'Typography', icon: Type },
                { key: 'layouts', label: 'Layouts', icon: Calculator }
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={activeSection === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveSection(key as 'widgets' | 'colors' | 'typography' | 'layouts')}
                  className="flex items-center gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {renderCurrentSection()}
        </div>
      )}
    </div>
  );
}