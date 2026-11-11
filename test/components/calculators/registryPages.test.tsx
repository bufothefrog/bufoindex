import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/font/google', () => ({ Inter: () => ({ className: 'font-inter' }) }));

import ToolsPage from '@/app/tools/page';
import NotFound from '@/app/not-found';
import HomePage from '@/app/page';
import { metadata as rootMetadata } from '@/app/layout';
import { CALCULATOR_LIST } from '@/lib/calculators/registry';
import { resetProfileStore } from '@/test/utils/stores';

beforeEach(() => resetProfileStore());

describe('pages that list calculators read the registry', () => {
  it('/tools links every calculator by its registry name and path', () => {
    render(<ToolsPage />);
    for (const calculator of CALCULATOR_LIST) {
      const heading = screen.getByRole('heading', { level: 2, name: calculator.shortTitle });
      expect(heading.closest('a')).toHaveAttribute('href', calculator.path);
    }
  });

  it('the 404 page links home and every calculator', () => {
    render(<NotFound />);
    const nav = screen.getByRole('navigation', { name: 'Site pages' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    for (const calculator of CALCULATOR_LIST) {
      expect(within(nav).getByRole('link', { name: calculator.shortTitle })).toHaveAttribute('href', calculator.path);
    }
  });

  it('the landing page names every calculator and keeps its disclaimer', () => {
    render(<HomePage />);
    for (const calculator of CALCULATOR_LIST) {
      expect(screen.getByText(calculator.shortTitle)).toBeInTheDocument();
    }
    expect(
      screen.getByText(
        'Educational tools only. Results depend on the assumptions you enter and are not predictions. Not tax or investment advice.'
      )
    ).toBeInTheDocument();
  });

  it('the site description no longer promises shareable URLs', () => {
    expect(String(rootMetadata.description)).not.toMatch(/shareable/i);
  });
});
