/**
 * Tab Panel Component
 * Individual panel wrapper for tab content with state management
 */

'use client';

import React, { useEffect, useRef } from 'react';

export interface TabPanelProps {
  id: string;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  preserveScroll?: boolean;
  lazy?: boolean;
  onActivate?: () => void;
  onDeactivate?: () => void;
}

export function TabPanel({
  id,
  active = false,
  children,
  className = '',
  preserveScroll = true,
  lazy = false,
  onActivate,
  onDeactivate
}: TabPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);
  const hasBeenActiveRef = useRef(false);

  // Track when panel becomes active/inactive
  useEffect(() => {
    if (active) {
      if (!hasBeenActiveRef.current) {
        hasBeenActiveRef.current = true;
      }
      onActivate?.();
      
      // Restore scroll position if preserving scroll
      if (preserveScroll && panelRef.current) {
        setTimeout(() => {
          if (panelRef.current) {
            panelRef.current.scrollTop = scrollPositionRef.current;
          }
        }, 0);
      }
    } else {
      onDeactivate?.();
      
      // Save scroll position if preserving scroll
      if (preserveScroll && panelRef.current) {
        scrollPositionRef.current = panelRef.current.scrollTop;
      }
    }
  }, [active, preserveScroll, onActivate, onDeactivate]);

  // Don't render content if lazy loading and never been active
  if (lazy && !hasBeenActiveRef.current && !active) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      id={`tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      aria-hidden={!active}
      className={`
        ${active ? 'block' : 'hidden'}
        ${className}
        focus:outline-hidden
      `}
      tabIndex={active ? 0 : -1}
    >
      {children}
    </div>
  );
}

/**
 * Tab Panels Container
 * Manages multiple tab panels with shared state
 */
export interface TabPanelsProps {
  activeTab: string;
  children: React.ReactNode;
  className?: string;
  preserveAllPanels?: boolean;
}

export function TabPanels({
  activeTab,
  children,
  className = '',
  preserveAllPanels = false
}: TabPanelsProps) {
  return (
    <div className={`tab-panels ${className}`}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === TabPanel) {
          const panel = child as React.ReactElement<TabPanelProps>;
          return React.cloneElement(panel, {
            active: panel.props.id === activeTab,
            lazy: !preserveAllPanels
          });
        }
        return child;
      })}
    </div>
  );
}

/**
 * Higher-order component for tab panel state management
 */
export function withTabState<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function TabStateWrapper(props: P & {
    tabState?: unknown;
    onStateChange?: (state: unknown) => void;
  }) {
    const { tabState, onStateChange, ...otherProps } = props;

    const updateState = (newState: unknown) => {
      onStateChange?.(newState);
    };

    return (
      <WrappedComponent
        {...(otherProps as P)}
        tabState={tabState}
        updateTabState={updateState}
      />
    );
  };
}

/**
 * Hook for managing individual tab panel state
 */
export function useTabPanelState<T>(initialState: T, panelId: string) {
  const [state, setState] = React.useState<T>(initialState);
  const [isActive, setIsActive] = React.useState(false);

  // Save state to localStorage when tab becomes inactive
  const saveState = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`tab-${panelId}-state`, JSON.stringify(state));
      } catch (error) {
        console.warn('Failed to save tab state to localStorage:', error);
      }
    }
  }, [state, panelId]);

  // Load state from localStorage when tab becomes active
  const loadState = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedState = localStorage.getItem(`tab-${panelId}-state`);
        if (savedState) {
          setState(JSON.parse(savedState));
        }
      } catch (error) {
        console.warn('Failed to load tab state from localStorage:', error);
      }
    }
  }, [panelId]);

  const handleActivate = React.useCallback(() => {
    setIsActive(true);
    loadState();
  }, [loadState]);

  const handleDeactivate = React.useCallback(() => {
    setIsActive(false);
    saveState();
  }, [saveState]);

  return {
    state,
    setState,
    isActive,
    onActivate: handleActivate,
    onDeactivate: handleDeactivate
  };
}