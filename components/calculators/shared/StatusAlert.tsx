import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'info' | 'warning' | 'danger' | 'success';

interface StatusAlertProps {
  variant: AlertVariant;
  icon?: LucideIcon;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const variantText: Record<AlertVariant, string> = {
  info: 'text-info',
  warning: 'text-warning',
  danger: 'text-destructive',
  success: 'text-success',
};

export function StatusAlert({
  variant,
  icon: Icon,
  title,
  children,
  className,
}: StatusAlertProps) {
  return (
    <div
      className={cn(
        'bg-muted/50 border border-border rounded-lg p-3',
        className
      )}
    >
      <div className="flex items-start space-x-2">
        {Icon && (
          <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', variantText[variant])} />
        )}
        <div className="min-w-0">
          {title && (
            <div className={cn('text-sm font-medium', variantText[variant])}>
              {title}
            </div>
          )}
          <div className="text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
