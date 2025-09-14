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
  Legend,
  Filler
} from 'chart.js';
import { formatCurrency } from '@/lib/utils';
import { getChartTheme, getChartThemeWithOpacity, subscribeToThemeChanges } from '@/lib/chart-theme';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MonteCarloChartProps {
  netWorthByAge: { [age: number]: number };
  withdrawalsByAge: { [age: number]: number };
}

export function MonteCarloChart({ netWorthByAge, withdrawalsByAge }: MonteCarloChartProps) {
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

  const ages = Object.keys(netWorthByAge).map(Number).sort((a, b) => a - b);
  const netWorthData = ages.map(age => netWorthByAge[age]);
  
  // Only show withdrawals from retirement age onward (when withdrawals actually start)
  const withdrawalData = ages.map(age => {
    // If no withdrawal data exists for this age, it means we're still in accumulation phase
    return withdrawalsByAge[age] !== undefined ? withdrawalsByAge[age] : null;
  });

  const data = {
    labels: ages,
    datasets: [
      {
        label: 'Net Worth',
        data: netWorthData,
        borderColor: theme.primary,
        backgroundColor: themeWithOpacity.primaryOpacity,
        fill: true,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'Annual Withdrawals',
        data: withdrawalData,
        borderColor: theme.success,
        backgroundColor: themeWithOpacity.successOpacity,
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
        spanGaps: false  // Don't connect null values with lines
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
        text: 'Portfolio Projection Over Time',
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
          label: function(context: { dataset: { label?: string }; parsed: { y: number } }) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${formatCurrency(value)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Age',
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
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Net Worth',
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
            return formatCurrency(Number(value));
          }
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Annual Withdrawals',
          color: theme.text,
          font: {
            weight: 'bold' as const,
            family: 'IBM Plex Mono, monospace'
          }
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: theme.muted,
          font: {
            family: 'IBM Plex Mono, monospace'
          },
          callback: function(value: number | string) {
            return formatCurrency(Number(value));
          }
        }
      },
    },
  };

  return (
    <div className="h-96">
      <Line data={data} options={options} />
    </div>
  );
}