import React, { useMemo } from 'react';
import { AlertTriangle, Target } from 'lucide-react';
import { StepStatus } from '@/lib/constants/financialSteps';

interface StepProgressBarProps {
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
        <span className="text-info font-semibold">{progressPercentage}% Complete</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-info h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      {(criticalIssues > 0 || importantItems > 0) && (
        <div className="flex items-center space-x-4 text-sm">
          {criticalIssues > 0 && (
            <div className="flex items-center space-x-1 text-destructive">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              <span>{criticalIssues} Critical Issue{criticalIssues !== 1 ? 's' : ''}</span>
            </div>
          )}
          {importantItems > 0 && (
            <div className="flex items-center space-x-1 text-warning">
              <Target className="w-4 h-4" aria-hidden="true" />
              <span>{importantItems} Optimization{importantItems !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
