import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import {
  ChartFrame,
  ChartTooltipCard,
  CHART_SERIES_DEFAULTS,
  chartAxisProps,
  useChartTheme,
} from '@/components/ui/charts';

// getChartTheme reads CSS variables that jsdom never computes from the theme
// class, so the stub reports which class <html> carries when it is called.
vi.mock('@/lib/chart-theme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/chart-theme')>();
  return {
    ...actual,
    getChartTheme: () => {
      const dark = document.documentElement.classList.contains('dark');
      return { ...actual.getChartTheme(), primary: dark ? 'dark-primary' : 'light-primary' };
    },
  };
});

// ResponsiveContainer renders nothing at jsdom's zero size; this stand-in
// renders its children inside a named group so the tests can find both.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div role="group" aria-label="responsive container">
        {children}
      </div>
    ),
  };
});

function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function ThemeProbe() {
  const chartTheme = useChartTheme();
  const { setTheme } = useTheme();
  return (
    <div>
      <p>primary: {chartTheme.primary}</p>
      <p>axis stroke: {chartAxisProps(chartTheme).stroke}</p>
      <button type="button" onClick={() => setTheme('dark')}>
        Dark
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        Light
      </button>
    </div>
  );
}

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

class IntersectionObserverStub {
  static instances: IntersectionObserverStub[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(
    readonly callback: ObserverCallback,
    readonly options?: { rootMargin?: string }
  ) {
    IntersectionObserverStub.instances.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  fire(isIntersecting: boolean) {
    act(() => this.callback([{ isIntersecting }]));
  }
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
  IntersectionObserverStub.instances = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useChartTheme', () => {
  it('re-renders with the new theme when the theme switches', async () => {
    stubMatchMedia();
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => expect(document.documentElement).toHaveClass('light'));
    expect(screen.getByText('primary: light-primary')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(await screen.findByText('primary: dark-primary')).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');

    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(await screen.findByText('primary: light-primary')).toBeInTheDocument();
  });

  it('feeds the axis props from the current theme', () => {
    stubMatchMedia();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    // The stubbed muted color is the empty --muted-foreground wrapped in hsl().
    expect(screen.getByText('axis stroke: hsl()')).toBeInTheDocument();
  });
});

describe('ChartFrame', () => {
  it('renders the caption as the figure name, the mode note and the chart', () => {
    render(
      <ChartFrame caption="Median balance across 500 paths" modeNote="in today's dollars">
        <div>chart body</div>
      </ChartFrame>
    );
    const figure = screen.getByRole('figure', { name: 'Median balance across 500 paths' });
    expect(figure).toHaveTextContent("in today's dollars");
    expect(screen.getByRole('group', { name: 'responsive container' })).toHaveTextContent(
      'chart body'
    );
  });

  it('omits the mode note when none is given', () => {
    render(
      <ChartFrame caption="Caption only" height="tall">
        <div>chart body</div>
      </ChartFrame>
    );
    expect(screen.getByRole('figure', { name: 'Caption only' })).toHaveTextContent(
      /^chart bodyCaption only$/
    );
  });

  it('shows the placeholder first and mounts the chart once the observer fires', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    render(
      <ChartFrame caption="Deferred chart" deferUntilVisible>
        <div>chart body</div>
      </ChartFrame>
    );

    expect(screen.getByRole('figure', { name: 'Deferred chart' })).toBeInTheDocument();
    expect(screen.queryByText('chart body')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'responsive container' })).not.toBeInTheDocument();

    const [observer] = IntersectionObserverStub.instances;
    expect(observer.options?.rootMargin).toBe('100% 0px');
    expect(observer.observed).toHaveLength(1);

    observer.fire(false);
    expect(screen.queryByText('chart body')).not.toBeInTheDocument();

    observer.fire(true);
    expect(screen.getByText('chart body')).toBeInTheDocument();
    expect(observer.disconnected).toBe(true);
  });

  it('keeps the chart mounted after it has been shown', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    const { rerender } = render(
      <ChartFrame caption="Deferred chart" deferUntilVisible>
        <div>chart body</div>
      </ChartFrame>
    );
    IntersectionObserverStub.instances[0].fire(true);
    rerender(
      <ChartFrame caption="Deferred chart" deferUntilVisible>
        <div>chart body, new data</div>
      </ChartFrame>
    );
    expect(screen.getByText('chart body, new data')).toBeInTheDocument();
    expect(IntersectionObserverStub.instances).toHaveLength(1);
  });

  it('stays mounted when deferUntilVisible turns on after the chart mounted', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    const { rerender } = render(
      <ChartFrame caption="Flag flip" deferUntilVisible={false}>
        <div>chart body</div>
      </ChartFrame>
    );
    expect(screen.getByText('chart body')).toBeInTheDocument();
    rerender(
      <ChartFrame caption="Flag flip" deferUntilVisible>
        <div>chart body</div>
      </ChartFrame>
    );
    expect(screen.getByText('chart body')).toBeInTheDocument();
    expect(IntersectionObserverStub.instances).toHaveLength(0);
  });

  it('mounts at once when deferUntilVisible turns off before the chart was seen, and stays mounted', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    const frame = (defer: boolean) => (
      <ChartFrame caption="Flag flip" deferUntilVisible={defer}>
        <div>chart body</div>
      </ChartFrame>
    );
    const { rerender } = render(frame(true));
    expect(screen.queryByText('chart body')).not.toBeInTheDocument();
    rerender(frame(false));
    expect(screen.getByText('chart body')).toBeInTheDocument();
    expect(IntersectionObserverStub.instances[0].disconnected).toBe(true);
    rerender(frame(true));
    expect(screen.getByText('chart body')).toBeInTheDocument();
  });

  it('disconnects the observer when unmounted before the chart was seen', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    const { unmount } = render(
      <ChartFrame caption="Deferred chart" deferUntilVisible>
        <div>chart body</div>
      </ChartFrame>
    );
    const [observer] = IntersectionObserverStub.instances;
    expect(observer.disconnected).toBe(false);
    unmount();
    expect(observer.disconnected).toBe(true);
  });

  it('mounts immediately where IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(
      <ChartFrame caption="No observer" deferUntilVisible>
        <div>chart body</div>
      </ChartFrame>
    );
    expect(screen.getByText('chart body')).toBeInTheDocument();
  });
});

describe('ChartTooltipCard', () => {
  it('renders the title and one line per row', () => {
    render(
      <ChartTooltipCard
        title="Age 45"
        rows={[
          { label: 'Net Worth', value: '$412,000', color: 'hsl(106 29% 32%)' },
          { label: '10th to 90th', value: '$300k to $520k', muted: true },
        ]}
      />
    );
    expect(screen.getByText('Age 45')).toBeInTheDocument();
    expect(screen.getByText('Net Worth:').parentElement).toHaveTextContent('Net Worth: $412,000');
    expect(screen.getByText('10th to 90th:').parentElement).toHaveTextContent(
      '10th to 90th: $300k to $520k'
    );
  });
});

describe('CHART_SERIES_DEFAULTS', () => {
  it('is re-exported for series to spread', () => {
    expect(CHART_SERIES_DEFAULTS.isAnimationActive).toBe(false);
  });
});
