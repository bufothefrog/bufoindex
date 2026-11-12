/**
 * The site bar on every route: the way home, the Overview link, the four
 * calculators (inline from lg up, behind a "Calculators" disclosure below
 * that), aria-current on the current route, and the theme toggle. jsdom
 * applies no media queries, so the inline links and the disclosure button are
 * both in the tree; the disclosure's list exists only while it is open.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { UtilityBar } from '@/components/shared/UtilityBar';

const pathname = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}));

const CALCULATORS = [
  ['Paycheck Allocator', '/tools/paycheck-allocator'],
  ['Retirement Calculator', '/tools/retirement-calculator'],
  ['Portfolio Rebalancer', '/tools/portfolio-rebalancing-calculator'],
  ['Leverage Comparison', '/tools/leverage-comparison'],
] as const;

beforeEach(() => {
  pathname.current = '/';
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  pathname.current = path;
  return render(
    <ThemeProvider>
      <UtilityBar />
    </ThemeProvider>
  );
}

function siteNav() {
  return screen.getByRole('navigation', { name: 'Site' });
}

function disclosure() {
  return within(siteNav()).getByRole('button', { name: 'Calculators' });
}

function openList() {
  fireEvent.click(disclosure());
  const id = disclosure().getAttribute('aria-controls');
  expect(id).toBeTruthy();
  const list = document.getElementById(id as string);
  expect(list).not.toBeNull();
  return list as HTMLElement;
}

describe('UtilityBar', () => {
  it('links home by the site name and keeps the theme toggle', () => {
    renderAt('/tools/leverage-comparison');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'BufoIndex' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: /Switch to (dark|light) mode/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Back/ })).not.toBeInTheDocument();
  });

  it('links the overview and every calculator by its registry name and bare path', () => {
    renderAt('/');
    const nav = siteNav();
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/overview');
    for (const [name, href] of CALCULATORS) {
      expect(within(nav).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/overview', ...CALCULATORS.map(([, href]) => href)]);
  });

  it('marks the current route with aria-current="page" and nothing else', () => {
    const cases: Array<[string, string]> = [
      ['/', 'BufoIndex'],
      ['/overview', 'Overview'],
      ...CALCULATORS.map(([name, href]) => [href, name] as [string, string]),
    ];
    for (const [path, name] of cases) {
      const { unmount } = renderAt(path);
      const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
      expect.soft(current.map((link) => link.textContent), path).toEqual([name]);
      unmount();
    }
  });

  it('marks the calculator section, not the page, on a page below a calculator', () => {
    renderAt('/tools/retirement-calculator/methodology');
    const link = within(siteNav()).getByRole('link', { name: 'Retirement Calculator' });
    expect(link).toHaveAttribute('aria-current', 'true');
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page')).toEqual([]);
  });

  it('marks no link on a route outside the navigation', () => {
    renderAt('/start/choose');
    expect(screen.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toEqual([]);
  });

  it('opens the calculator list from the disclosure button', () => {
    renderAt('/overview');
    const button = disclosure();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button.getAttribute('aria-controls')).toBeTruthy();
    expect(document.getElementById(button.getAttribute('aria-controls') as string)).toBeNull();

    const list = openList();
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
    const links = within(list).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual(
      CALCULATORS.map(([name, href]) => [name, href])
    );

    fireEvent.click(disclosure());
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(disclosure().getAttribute('aria-controls') as string)).toBeNull();
  });

  it('marks the current calculator inside the open list', () => {
    renderAt('/tools/portfolio-rebalancing-calculator');
    const list = openList();
    expect(within(list).getByRole('link', { name: 'Portfolio Rebalancer' })).toHaveAttribute('aria-current', 'page');
    expect(within(list).getByRole('link', { name: 'Paycheck Allocator' })).not.toHaveAttribute('aria-current');
  });

  it('closes on Escape and returns focus to the button', () => {
    renderAt('/');
    const list = openList();
    within(list).getAllByRole('link')[0].focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
    expect(list).not.toBeInTheDocument();
    expect(disclosure()).toHaveFocus();
  });

  it('closes on choosing a link', () => {
    renderAt('/');
    const list = openList();
    fireEvent.click(within(list).getByRole('link', { name: 'Leverage Comparison' }));
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
    expect(list).not.toBeInTheDocument();
  });

  it('closes on a click outside it, and stays open on a click inside it', () => {
    renderAt('/');
    const list = openList();
    fireEvent.mouseDown(list);
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');

    fireEvent.mouseDown(document.body);
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
    expect(list).not.toBeInTheDocument();
  });

  it('closes when the route changes', () => {
    const { rerender } = renderAt('/');
    openList();
    pathname.current = '/overview';
    rerender(
      <ThemeProvider>
        <UtilityBar />
      </ThemeProvider>
    );
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
  });
});
