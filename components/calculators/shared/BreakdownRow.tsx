import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type RowVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BreakdownRowProps {
  icon?: LucideIcon;
  label: string;
  subtitle?: string;
  value: string | number;
  prefix?: '+' | '-' | '';
  variant?: RowVariant;
  className?: string;
}

const variantText: Record<RowVariant, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  info: 'text-info',
};

export function BreakdownRow({
  icon: Icon,
  label,
  subtitle,
  value,
  prefix = '',
  variant = 'default',
  className,
}: BreakdownRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-2 rounded-lg border border-border',
        className
      )}
    >
      <div className="flex items-center space-x-2 min-w-0">
        {Icon && (
          <div className="w-5 h-5 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
            <Icon className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>
      <div
        className={cn(
          'text-base font-semibold font-mono tabular-nums flex-shrink-0',
          variantText[variant]
        )}
      >
        {prefix}{value}
      </div>
    </div>
  );
}
