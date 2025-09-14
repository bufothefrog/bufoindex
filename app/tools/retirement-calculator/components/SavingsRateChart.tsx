'use client';

import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { formatCurrency } from '@/lib/utils';
import { RetirementInputs, calculateRequiredBalance, futureValue } from '@/lib/calculations/retirement';
import { getChartTheme, getChartThemeWithOpacity, subscribeToThemeChanges } from '@/lib/chart-theme';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SavingsRateChartProps {
  inputs: RetirementInputs;
}

interface SavingsRateData {
  retirementAge: number;
  requiredSavingsRate: number;
  requiredMonthlySavings: number;
}

export function SavingsRateChart({ inputs }: SavingsRateChartProps) {
  const [theme, setTheme] = useState(getChartTheme());
  const [themeWithOpacity, setThemeWithOpacity] = useState(getChartThemeWithOpacity(0.1));
  
  // Update theme when it changes
  useEffect(() => {
    const updateTheme = () => {
      setTheme(getChartTheme());
      setThemeWithOpacity(getChartThemeWithOpacity(0.1));
    };

    const unsubscribe = subscribeToThemeChanges(updateTheme);
    return unsubscribe;
  }, []);

  // Calculate required savings rates for different retirement ages
  const calculateSavingsRateData = (): SavingsRateData[] => {
    const data: SavingsRateData[] = [];
    const requiredBalance = calculateRequiredBalance(inputs.targetIncome);
    
    // Test retirement ages from current age + 10 to 70
    const minAge = Math.max(inputs.startingAge + 10, 45);
    const maxAge = 70;
    
    for (let retirementAge = minAge; retirementAge <= maxAge; retirementAge++) {
      const yearsToRetirement = retirementAge - inputs.startingAge;
      const monthsToRetirement = yearsToRetirement * 12;
      const monthlyRate = inputs.accumulationReturn / 12;
      
      // Calculate growth of starting balance
      const growthOfStartingBalance = futureValue(
        inputs.startingBalance,
        inputs.accumulationReturn,
        yearsToRetirement
      );
      
      // Calculate how much additional money we need from contributions
      const additionalNeeded = requiredBalance - growthOfStartingBalance;
      
      if (additionalNeeded <= 0) {
        // Already have enough, savings rate is 0
        data.push({
          retirementAge,
          requiredSavingsRate: 0,
          requiredMonthlySavings: 0
        });
      } else {
        // Calculate required monthly savings using future value of annuity formula
        let requiredMonthlySavings = 0;
        
        if (monthlyRate === 0) {
          requiredMonthlySavings = additionalNeeded / monthsToRetirement;
        } else {
          // FVA = PMT * [((1 + r)^n - 1) / r]
          // PMT = FVA / [((1 + r)^n - 1) / r]
          const denominator = (Math.pow(1 + monthlyRate, monthsToRetirement) - 1) / monthlyRate;
          requiredMonthlySavings = additionalNeeded / denominator;
        }
        
        const requiredAnnualSavings = requiredMonthlySavings * 12;
        const requiredSavingsRate = Math.min(1, requiredAnnualSavings / inputs.currentIncome);
        
        data.push({
          retirementAge,
          requiredSavingsRate: requiredSavingsRate * 100, // Convert to percentage
          requiredMonthlySavings
        });
      }
    }
    
    return data;
  };

  const savingsData = calculateSavingsRateData();
  
  // Prepare chart data
  const ages = savingsData.map(d => d.retirementAge);
  const savingsRates = savingsData.map(d => d.requiredSavingsRate);
  
  const data = {
    labels: ages,
    datasets: [
      {
        label: 'Required Savings Rate (%)',
        data: savingsRates,
        borderColor: theme.tertiary, // Using tertiary color for distinctive sage variant
        backgroundColor: themeWithOpacity.primaryOpacity,
        fill: true,
        tension: 0.4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: 'Required Savings Rate by Retirement Age',
        color: theme.text,
        font: {
          size: 16,
          weight: 'bold' as const,
          family: 'Inter, system-ui, sans-serif'
        }
      },
      legend: {
        position: 'top' as const,
        labels: {
          color: theme.text,
          font: {
            family: 'Inter, system-ui, sans-serif'
          }
        }
      },
      tooltip: {
        backgroundColor: theme.background,
        titleColor: theme.text,
        bodyColor: theme.text,
        borderColor: theme.grid,
        borderWidth: 1,
        callbacks: {
          label: function(context: { dataIndex: number }) {
            const dataPoint = savingsData[context.dataIndex];
            const savingsRate = dataPoint.requiredSavingsRate.toFixed(1);
            const monthlySavings = formatCurrency(dataPoint.requiredMonthlySavings);
            return [
              `Required Savings Rate: ${savingsRate}%`,
              `Monthly Savings: ${monthlySavings}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Retirement Age',
          color: theme.text,
          font: {
            weight: 'bold' as const,
            family: 'IBM Plex Mono, monospace'
          }
        },
        ticks: {
          color: theme.muted,
          font: {
            family: 'IBM Plex Mono, monospace'
          }
        },
        grid: {
          color: theme.grid
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Required Savings Rate (%)',
          color: theme.text,
          font: {
            weight: 'bold' as const,
            family: 'IBM Plex Mono, monospace'
          }
        },
        grid: {
          color: theme.grid
        },
        ticks: {
          color: theme.muted,
          font: {
            family: 'IBM Plex Mono, monospace'
          },
          callback: function(value: number | string) {
            return `${Number(value).toFixed(0)}%`;
          }
        }
      }
    }
  };

  return (
    <div className="h-96">
      <Line data={data} options={options} />
    </div>
  );
}