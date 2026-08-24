/**
 * Chart Theme Utility for BufoIndex
 * Provides theme-aware colors for Recharts components
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
 * Gets theme-aware colors for charts
 * These colors automatically adapt to light/dark mode via CSS custom properties
 */
export const getChartTheme = (): ChartTheme => {
  const sage = getSageVariants();

  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side fallback colors (light theme)
    return {
      primary: sage.sage600,
      secondary: sage.sage300,
      tertiary: sage.sage500,
      success: 'hsl(142 76% 36%)', // --success, light theme
      warning: 'hsl(38 92% 50%)', // --warning, light theme
      danger: '#EF4444',
      text: '#1a202c',
      grid: '#e2e8f0',
      background: '#ffffff',
      muted: '#64748b',
      accent: sage.sage400
    };
  }

  // Get computed CSS custom property values
  const style = getComputedStyle(document.documentElement);

  return {
    primary: `hsl(${style.getPropertyValue('--primary').trim()})`,
    secondary: `hsl(${style.getPropertyValue('--secondary').trim()})`,
    tertiary: sage.sage500, // brand scale is intentionally theme-invariant
    success: `hsl(${style.getPropertyValue('--success').trim()})`,
    warning: `hsl(${style.getPropertyValue('--warning').trim()})`,
    danger: `hsl(${style.getPropertyValue('--destructive').trim()})`,
    text: `hsl(${style.getPropertyValue('--foreground').trim()})`,
    grid: `hsl(${style.getPropertyValue('--border').trim()})`,
    background: `hsl(${style.getPropertyValue('--background').trim()})`,
    muted: `hsl(${style.getPropertyValue('--muted-foreground').trim()})`,
    accent: sage.sage400 // main brand color
  };
};

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