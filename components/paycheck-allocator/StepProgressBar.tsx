import React, { useMemo } from 'react';
import { AlertTriangle, Target } from 'lucide-react';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StepStatus } from '@/lib/constants/financialSteps';
import { TONE_TEXT } from '@/lib/design-system/tone';
import { cn } from '@/lib/utils';

export interface StepProgressBarProps {
  steps: StepStatus[];
}

export const StepProgressBar = React.memo(function StepProgressBar({ steps }: StepProgressBarProps) {
  const { totalApplicableSteps, completedSteps, progressPercentage, criticalIssues, importantItems } = useMemo(() => {
    const totalApplicableSteps = steps.filter(step => !step.isNotApplicable).length;
    const completedSteps = steps.filter(step => step.isComplete).length;
    const progressPercentage = totalApplicableSteps > 0 ? Math.round((completedSteps / totalApplicableSteps) * 100) : 0;
    const criticalIssues = steps.filter(step => step.urgencyLevel === 'critical').length;
    const importantItems = steps.filter(step => step.urgencyLevel === 'important').length;
    return { totalApplicableSteps, completedSteps, progressPercentage, criticalIssues, importantItems };
  }, [steps]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          Optimization Progress: {completedSteps} of {totalApplicableSteps} steps
        </span>
        <span className={cn('font-semibold', TONE_TEXT.info)}>{progressPercentage}% Complete</span>
      </div>
      <ProgressBar
        value={progressPercentage}
        label="Optimization progress"
        valueText={`${completedSteps} of ${totalApplicableSteps} steps`}
        tone="info"
      />
      {(criticalIssues > 0 || importantItems > 0) && (
        <div className="flex items-center space-x-4 text-sm">
          {criticalIssues > 0 && (
            <div className={cn('flex items-center space-x-1', TONE_TEXT.negative)}>
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              <span>{criticalIssues} Critical Issue{criticalIssues !== 1 ? 's' : ''}</span>
            </div>
          )}
          {importantItems > 0 && (
            <div className={cn('flex items-center space-x-1', TONE_TEXT.caution)}>
              <Target className="w-4 h-4" aria-hidden="true" />
              <span>{importantItems} Optimization{importantItems !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default StepProgressBar;
