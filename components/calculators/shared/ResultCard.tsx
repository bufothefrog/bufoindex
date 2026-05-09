'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResultCardProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  headerActions?: React.ReactNode;
  expandable?: boolean;
  defaultExpanded?: boolean;
}

export function ResultCard({
  title,
  icon: Icon,
  children,
  variant = 'default',
  size = 'default',
  className,
  headerActions,
  expandable = false,
  defaultExpanded = true
}: ResultCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  const variantClasses = {
    default: 'border-border',
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/30 bg-warning/5',
    danger: 'border-destructive/30 bg-destructive/5',
    info: 'border-info/30 bg-info/5'
  };

  const sizeClasses = {
    sm: 'p-3',
    default: 'p-4',
    lg: 'p-6'
  };

  return (
    <Card className={cn(variantClasses[variant], className)}>
      <CardHeader 
        className={cn(
          sizeClasses[size],
          expandable && 'cursor-pointer hover:bg-muted/50 transition-colors'
        )}
        onClick={expandable ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-base">
            {Icon && <Icon className="w-5 h-5 mr-2" />}
            {title}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {headerActions}
            {expandable && (
              <Button variant="ghost" size="sm">
                {isExpanded ? '−' : '+'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      {(!expandable || isExpanded) && (
        <CardContent className={cn(sizeClasses[size], 'pt-0')}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// Specialized result card variants
interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  variant?: ResultCardProps['variant'];
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  subtext,
  trend,
  className
}: MetricCardProps) {
  const trendColors = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-muted-foreground'
  };

  return (
    <ResultCard 
      title={label} 
      icon={Icon} 
      variant={variant}
      size="sm"
      className={className}
    >
      <div className="text-center">
        <div className={cn(
          'text-2xl font-bold mb-1 font-mono tabular-nums',
          trend && trendColors[trend]
        )}>
          {value}
        </div>
        {subtext && (
          <div className="text-sm text-muted-foreground">
            {subtext}
          </div>
        )}
      </div>
    </ResultCard>
  );
}

interface ComparisonCardProps {
  title: string;
  scenarios: Array<{
    label: string;
    value: string | number;
    isRecommended?: boolean;
    metadata?: string;
  }>;
  icon?: LucideIcon;
  className?: string;
}

export function ComparisonCard({
  title,
  scenarios,
  icon: Icon,
  className
}: ComparisonCardProps) {
  return (
    <ResultCard title={title} icon={Icon} className={className}>
      <div className="space-y-3">
        {scenarios.map((scenario, index) => (
          <div 
            key={index}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border',
              scenario.isRecommended
                ? 'bg-success/5 border-success/30'
                : 'bg-muted border-border'
            )}
          >
            <div>
              <div className="font-medium">{scenario.label}</div>
              {scenario.metadata && (
                <div className="text-sm text-muted-foreground">
                  {scenario.metadata}
                </div>
              )}
            </div>
            <div className="text-lg font-semibold font-mono tabular-nums">
              {scenario.value}
            </div>
          </div>
        ))}
      </div>
    </ResultCard>
  );
}

interface InsightCardProps {
  title: string;
  insights: string[];
  icon?: LucideIcon;
  variant?: ResultCardProps['variant'];
  className?: string;
}

export function InsightCard({
  title,
  insights,
  icon: Icon,
  variant = 'info',
  className
}: InsightCardProps) {
  return (
    <ResultCard title={title} icon={Icon} variant={variant} className={className}>
      <ul className="space-y-2">
        {insights.map((insight, index) => (
          <li key={index} className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-info rounded-full mt-2 shrink-0" />
            <div className="text-sm">{insight}</div>
          </li>
        ))}
      </ul>
    </ResultCard>
  );
}