/**
 * Calculator Routing Utilities
 * URL-based navigation and state management for calculator tabs
 */

export interface CalculatorRoute {
  calculator: string;
  tab?: string;
  section?: string;
  params?: Record<string, string>;
}

export class CalculatorRouting {
  /**
   * Parse current URL to extract calculator routing information
   */
  static parseCurrentRoute(): CalculatorRoute | null {
    if (typeof window === 'undefined') return null;

    const pathname = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;

    // Extract calculator name from path: /tools/retirement-calculator
    const pathMatch = pathname.match(/\/tools\/([^\/]+)/);
    if (!pathMatch) return null;

    const calculator = pathMatch[1];

    // Parse tab from hash: #tab=methodology
    let tab: string | undefined;
    const tabMatch = hash.match(/tab=([^&]+)/);
    if (tabMatch) {
      tab = tabMatch[1];
    }

    // Parse section from hash: #section=core-formulas
    let section: string | undefined;
    const sectionMatch = hash.match(/section=([^&]+)/);
    if (sectionMatch) {
      section = sectionMatch[1];
    }

    // Parse URL parameters
    const params: Record<string, string> = {};
    const urlParams = new URLSearchParams(search);
    urlParams.forEach((value, key) => {
      params[key] = value;
    });

    return {
      calculator,
      tab,
      section,
      params
    };
  }

  /**
   * Build URL for calculator navigation
   */
  static buildCalculatorUrl(
    calculator: string,
    options: {
      tab?: string;
      section?: string;
      params?: Record<string, string>;
      preserveParams?: boolean;
    } = {}
  ): string {
    const { tab, section, params = {}, preserveParams = true } = options;

    // Base path
    let url = `/tools/${calculator}`;

    // Add query parameters
    const urlParams = new URLSearchParams();
    
    if (preserveParams && typeof window !== 'undefined') {
      // Preserve existing parameters
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.forEach((value, key) => {
        urlParams.set(key, value);
      });
    }

    // Add new parameters
    Object.entries(params).forEach(([key, value]) => {
      urlParams.set(key, value);
    });

    const queryString = urlParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    // Add hash parameters
    const hashParams: string[] = [];
    if (tab) hashParams.push(`tab=${tab}`);
    if (section) hashParams.push(`section=${section}`);

    if (hashParams.length > 0) {
      url += `#${hashParams.join('&')}`;
    }

    return url;
  }

  /**
   * Navigate to a calculator tab
   */
  static navigateToTab(
    calculator: string,
    tab: string,
    options: {
      section?: string;
      params?: Record<string, string>;
      replace?: boolean;
    } = {}
  ): void {
    if (typeof window === 'undefined') return;

    const { section, params, replace = false } = options;
    const url = this.buildCalculatorUrl(calculator, { tab, section, params });

    if (replace) {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }

    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent('calculatorNavigate', {
      detail: { calculator, tab, section, params }
    }));
  }

  /**
   * Navigate to a methodology section
   */
  static navigateToMethodologySection(
    calculator: string,
    section: string,
    options: {
      params?: Record<string, string>;
      replace?: boolean;
    } = {}
  ): void {
    this.navigateToTab(calculator, 'methodology', {
      section,
      ...options
    });
  }

  /**
   * Get methodology URL for a calculator
   */
  static getMethodologyUrl(calculator: string, section?: string): string {
    return this.buildCalculatorUrl(calculator, {
      tab: 'methodology',
      section
    });
  }

  /**
   * Check if current route matches
   */
  static isCurrentRoute(
    calculator?: string,
    tab?: string,
    section?: string
  ): boolean {
    const currentRoute = this.parseCurrentRoute();
    if (!currentRoute) return false;

    if (calculator && currentRoute.calculator !== calculator) return false;
    if (tab && currentRoute.tab !== tab) return false;
    if (section && currentRoute.section !== section) return false;

    return true;
  }

  /**
   * Subscribe to route changes
   */
  static onRouteChange(
    callback: (route: CalculatorRoute | null) => void
  ): () => void {
    if (typeof window === 'undefined') {
      return () => {}; // No-op for SSR
    }

    const handler = () => {
      callback(this.parseCurrentRoute());
    };

    // Listen to browser navigation
    window.addEventListener('popstate', handler);
    
    // Listen to our custom navigation events
    window.addEventListener('calculatorNavigate', handler);

    // Return cleanup function
    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('calculatorNavigate', handler);
    };
  }

  /**
   * Generate breadcrumb navigation for current route
   */
  static generateBreadcrumbs(): Array<{
    label: string;
    href: string;
    current: boolean;
  }> {
    const route = this.parseCurrentRoute();
    if (!route) return [];

    const breadcrumbs: Array<{
      label: string;
      href: string;
      current: boolean;
    }> = [
      {
        label: 'Home',
        href: '/',
        current: false
      },
      {
        label: 'Tools',
        href: '/tools',
        current: false
      }
    ];

    // Add calculator
    const calculatorName = route.calculator
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    breadcrumbs.push({
      label: calculatorName,
      href: `/tools/${route.calculator}`,
      current: !route.tab
    });

    // Add tab if present
    if (route.tab) {
      const tabName = route.tab.charAt(0).toUpperCase() + route.tab.slice(1);
      breadcrumbs.push({
        label: tabName,
        href: this.buildCalculatorUrl(route.calculator, { tab: route.tab }),
        current: !route.section
      });
    }

    // Add section if present
    if (route.section) {
      const sectionName = route.section
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      breadcrumbs.push({
        label: sectionName,
        href: this.buildCalculatorUrl(route.calculator, {
          tab: route.tab,
          section: route.section
        }),
        current: true
      });
    }

    return breadcrumbs;
  }

  /**
   * Share current calculator state via URL
   */
  static getShareableUrl(includeState: boolean = false): string {
    if (typeof window === 'undefined') return '';

    const route = this.parseCurrentRoute();
    if (!route) return window.location.href;

    if (!includeState) {
      // Return clean URL without state parameters
      return this.buildCalculatorUrl(route.calculator, {
        tab: route.tab,
        section: route.section
      });
    }

    return window.location.href;
  }
}

/**
 * React hook for calculator routing
 */
import { useState, useEffect } from 'react';

export function useCalculatorRoute() {
  const [route, setRoute] = useState<CalculatorRoute | null>(null);

  useEffect(() => {
    // Set initial route
    setRoute(CalculatorRouting.parseCurrentRoute());

    // Subscribe to route changes
    const cleanup = CalculatorRouting.onRouteChange(setRoute);

    return cleanup;
  }, []);

  const navigateToTab = (tab: string, options?: { section?: string }) => {
    if (route?.calculator) {
      CalculatorRouting.navigateToTab(route.calculator, tab, options);
    }
  };

  const navigateToSection = (section: string) => {
    if (route?.calculator) {
      CalculatorRouting.navigateToMethodologySection(route.calculator, section);
    }
  };

  return {
    route,
    navigateToTab,
    navigateToSection,
    isTab: (tab: string) => route?.tab === tab,
    isSection: (section: string) => route?.section === section
  };
}