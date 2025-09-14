import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface BenefitOption {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface BenefitsSelectorProps {
  name: string;
  title: string;
  options: BenefitOption[];
  onChange: (options: BenefitOption[]) => void;
  className?: string;
  recordable?: boolean;
}

export function BenefitsSelector({
  name,
  title,
  options,
  onChange,
  className,
  recordable = false,
}: BenefitsSelectorProps) {
  const toggleOption = (optionId: string) => {
    const updatedOptions = options.map(option =>
      option.id === optionId
        ? { ...option, enabled: !option.enabled }
        : option
    );
    onChange(updatedOptions);
  };
  
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center justify-between">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {options.map((option) => (
          <div
            key={option.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors",
              option.enabled
                ? "bg-green-50 border-green-200 hover:bg-green-100"
                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
            )}
            onClick={() => toggleOption(option.id)}
          >
            <div className="flex-1">
              <div className="font-medium text-sm">{option.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {option.description}
              </div>
            </div>
            <div className={cn(
              "ml-3 w-6 h-6 rounded-full flex items-center justify-center",
              option.enabled
                ? "bg-green-500 text-white"
                : "bg-gray-300 text-gray-600"
            )}>
              {option.enabled ? (
                <Check className="w-4 h-4" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}