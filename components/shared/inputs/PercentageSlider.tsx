import React from 'react';
import { Slider } from '@/components/ui/slider';
import { cn, formatPercent } from '@/lib/utils';

interface PercentageSliderProps {
  name: string;
  label: string;
  value: number; // Decimal value (0.22 for 22%)
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  options?: number[]; // Specific percentage options (as decimals)
  className?: string;
  recordable?: boolean;
}

export function PercentageSlider({
  name,
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  options,
  className,
  recordable = false,
}: PercentageSliderProps) {
  const [sliderValue, setSliderValue] = React.useState([value * 100]); // Convert to percentage for slider
  
  React.useEffect(() => {
    setSliderValue([value * 100]);
  }, [value]);
  
  const handleSliderChange = (newValue: number[]) => {
    setSliderValue(newValue);
    onChange(newValue[0] / 100); // Convert back to decimal
  };
  
  // If specific options are provided, use discrete values
  if (options) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <label htmlFor={name} className="text-sm font-medium leading-none">
            {label}
          </label>
          <span className="text-sm font-semibold text-primary">
            {formatPercent(value)}
          </span>
        </div>
        
        <div className="grid grid-cols-4 gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                "px-3 py-2 text-sm rounded-md border transition-colors",
                value === option
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent hover:text-accent-foreground border-input"
              )}
            >
              {formatPercent(option)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={name} className="text-sm font-medium leading-none">
          {label}
          {recordable && <span className="text-xs text-muted-foreground ml-2">(recordable)</span>}
        </label>
        <span className="text-sm font-semibold text-primary">
          {formatPercent(value)}
        </span>
      </div>
      
      <div className="px-1">
        <Slider
          id={name}
          min={min * 100}
          max={max * 100}
          step={step * 100}
          value={sliderValue}
          onValueChange={handleSliderChange}
          className="w-full"
        />
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatPercent(min)}</span>
        <span>{formatPercent(max)}</span>
      </div>
    </div>
  );
}