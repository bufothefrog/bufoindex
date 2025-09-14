/**
 * Chart Theme Utility for BufoIndex
 * Provides theme-aware colors for Chart.js and Recharts components
 * Uses CSS custom properties for automatic dark mode switching
 */

export interface ChartTheme {
  primary: string;
  secondary: string;
  tertiary: string;
  success: string;
  warning: string;
  danger: string;
  text: string;
  grid: string;
  background: string;
  muted: string;
  accent: string;
}

/**
 * Gets theme-aware colors for charts
 * These colors automatically adapt to light/dark mode via CSS custom properties
 */
export const getChartTheme = (): ChartTheme => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side fallback colors (light theme)
    return {
      primary: '#4a6d3c', // sage-600
      secondary: '#9fb09f', // sage-300
      tertiary: '#5e8b4e', // sage-500
      success: '#10B981',
      warning: '#F59E0B', 
      danger: '#EF4444',
      text: '#1a202c',
      grid: '#e2e8f0',
      background: '#ffffff',
      muted: '#64748b',
      accent: '#7fb069' // sage-400
    };
  }

  // Get computed CSS custom property values
  const style = getComputedStyle(document.documentElement);
  
  return {
    primary: `hsl(${style.getPropertyValue('--primary').trim()})`,
    secondary: `hsl(${style.getPropertyValue('--secondary').trim()})`,
    tertiary: '#5e8b4e', // sage-500 - specific sage variant
    success: '#10B981',
    warning: '#F59E0B',
    danger: `hsl(${style.getPropertyValue('--destructive').trim()})`,
    text: `hsl(${style.getPropertyValue('--foreground').trim()})`,
    grid: `hsl(${style.getPropertyValue('--border').trim()})`,
    background: `hsl(${style.getPropertyValue('--background').trim()})`,
    muted: `hsl(${style.getPropertyValue('--muted-foreground').trim()})`,
    accent: '#7fb069' // sage-400 - main brand color
  };
};

/**
 * Gets theme-aware colors with opacity
 */
export const getChartThemeWithOpacity = (opacity: number = 0.1): ChartTheme & {
  primaryOpacity: string;
  successOpacity: string;
  warningOpacity: string;
  dangerOpacity: string;
} => {
  const theme = getChartTheme();
  
  return {
    ...theme,
    primaryOpacity: theme.primary.includes('hsl') 
      ? theme.primary.replace('hsl(', 'hsla(').replace(')', `, ${opacity})`)
      : `${theme.primary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
    successOpacity: `${theme.success}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
    warningOpacity: `${theme.warning}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
    dangerOpacity: `${theme.danger.includes('hsl') 
      ? theme.danger.replace('hsl(', 'hsla(').replace(')', `, ${opacity})`)
      : theme.danger}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
  };
};

/**
 * Chart.js theme configuration
 */
export const getChartJSTheme = () => {
  const theme = getChartTheme();
  
  return {
    plugins: {
      legend: {
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
        borderWidth: 1
      }
    },
    scales: {
      x: {
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
        ticks: {
          color: theme.muted,
          font: {
            family: 'IBM Plex Mono, monospace'
          }
        },
        grid: {
          color: theme.grid
        }
      }
    }
  };
};

/**
 * Recharts theme configuration  
 */
export const getRechartsTheme = () => {
  const theme = getChartTheme();
  
  return {
    axis: {
      tick: { fill: theme.muted, fontFamily: 'IBM Plex Mono, monospace' },
      tickLine: { stroke: theme.grid },
      axisLine: { stroke: theme.grid }
    },
    grid: {
      stroke: theme.grid,
      strokeDasharray: '3 3'
    },
    tooltip: {
      contentStyle: {
        backgroundColor: theme.background,
        border: `1px solid ${theme.grid}`,
        borderRadius: '8px',
        color: theme.text,
        fontFamily: 'IBM Plex Mono, monospace'
      }
    },
    legend: {
      wrapperStyle: {
        color: theme.text,
        fontFamily: 'Inter, system-ui, sans-serif'
      }
    }
  };
};

/**
 * Sage color variants for consistent theming
 */
export const getSageVariants = () => ({
  sage50: '#f6f7f6',
  sage100: '#e3e8e3', 
  sage200: '#c7d1c7',
  sage300: '#9fb09f',
  sage400: '#7fb069', // Main brand color
  sage500: '#5e8b4e',
  sage600: '#4a6d3c', // Primary in CSS custom properties
  sage700: '#3d5732',
  sage800: '#334729',
  sage900: '#2d3d24'
});

/**
 * Listen for theme changes and update charts
 */
export const subscribeToThemeChanges = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target as HTMLElement;
        if (target === document.documentElement) {
          callback();
        }
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  return () => observer.disconnect();
};