/**
 * Calculator Tabs Component
 * Tab navigation system for calculator and methodology views
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Calculator, BookOpen, BarChart3, Settings } from 'lucide-react';

export interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType<Record<string, unknown>>;
  enabled?: boolean;
  props?: Record<string, unknown>;
}

export interface CalculatorTabsProps {
  tabs: TabConfig[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  preserveState?: boolean;
  className?: string;
}

export function CalculatorTabs({
  tabs,
  defaultTab,
  onTabChange,
  preserveState = true,
  className = ''
}: CalculatorTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');
  const [tabStates, setTabStates] = useState<Record<string, unknown>>({});

  // Handle tab changes
  useEffect(() => {
    if (defaultTab && defaultTab !== activeTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, activeTab]);

  const handleTabClick = (tabId: string) => {
    if (tabs.find(tab => tab.id === tabId && tab.enabled === false)) {
      return; // Don't switch to disabled tabs
    }

    setActiveTab(tabId);
    onTabChange?.(tabId);

    // Update URL hash for deep linking
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.hash = `tab=${tabId}`;
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Restore tab from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const match = hash.match(/tab=([^&]+)/);
      if (match && match[1]) {
        const tabId = match[1];
        if (tabs.find(tab => tab.id === tabId)) {
          setActiveTab(tabId);
        }
      }
    }
  }, [tabs]);

  // Save tab state when switching
  const handleTabStateChange = (tabId: string, state: unknown) => {
    if (preserveState) {
      setTabStates(prev => ({
        ...prev,
        [tabId]: state
      }));
    }
  };

  const activeTabConfig = tabs.find(tab => tab.id === activeTab);
  const ActiveComponent = activeTabConfig?.component;

  return (
    <div className={`w-full ${className}`}>
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDisabled = tab.enabled === false;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                disabled={isDisabled}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                className={`
                  flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors
                  ${isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }
                  ${isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                  }
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {ActiveComponent && (
          <div
            id={`tabpanel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            className="focus:outline-none"
          >
            <ActiveComponent
              {...(activeTabConfig?.props || {})}
              tabState={tabStates[activeTab]}
              onStateChange={(state: unknown) => handleTabStateChange(activeTab, state)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Tab Panel Component for individual tab content
 */
export interface TabPanelProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ id, children, className = '' }: TabPanelProps) {
  return (
    <div
      id={`tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      className={`focus:outline-none ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Create standard calculator tab configurations
 */
export function createCalculatorTabConfig(
  calculatorComponent: React.ComponentType<Record<string, unknown>>,
  methodologyComponent: React.ComponentType<Record<string, unknown>>,
  options: {
    calculatorProps?: Record<string, unknown>;
    methodologyProps?: Record<string, unknown>;
    includeAnalysis?: boolean;
    includeSettings?: boolean;
  } = {}
): TabConfig[] {
  const tabs: TabConfig[] = [
    {
      id: 'calculator',
      label: 'Calculator',
      icon: <Calculator className="w-4 h-4" />,
      component: calculatorComponent,
      enabled: true,
      props: options.calculatorProps || {}
    },
    {
      id: 'methodology',
      label: 'Methodology',
      icon: <BookOpen className="w-4 h-4" />,
      component: methodologyComponent,
      enabled: true,
      props: options.methodologyProps || {}
    }
  ];

  if (options.includeAnalysis) {
    tabs.push({
      id: 'analysis',
      label: 'Analysis',
      icon: <BarChart3 className="w-4 h-4" />,
      component: () => <div>Analysis feature coming soon...</div>,
      enabled: false
    });
  }

  if (options.includeSettings) {
    tabs.push({
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
      component: () => <div>Settings feature coming soon...</div>,
      enabled: false
    });
  }

  return tabs;
}

/**
 * Hook for managing tab state
 */
export function useTabState(initialTab?: string) {
  const [activeTab, setActiveTab] = useState(initialTab || '');
  const [tabHistory, setTabHistory] = useState<string[]>([]);

  const switchTab = (tabId: string) => {
    setTabHistory(prev => [...prev, activeTab].filter(Boolean));
    setActiveTab(tabId);
  };

  const goBack = () => {
    if (tabHistory.length > 0) {
      const previousTab = tabHistory[tabHistory.length - 1];
      setTabHistory(prev => prev.slice(0, -1));
      setActiveTab(previousTab);
    }
  };

  const canGoBack = tabHistory.length > 0;

  return {
    activeTab,
    switchTab,
    goBack,
    canGoBack,
    tabHistory
  };
}