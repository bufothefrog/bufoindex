/**
 * TaxInputCard Component Test Suite
 *
 * The card's two controls (state combobox, filing-status select) are built
 * from the shared StateSelector/SelectInput primitives, so both must expose a
 * real accessible name and report edits through onUpdate.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TaxInputCard } from '@/components/paycheck-allocator/inputs/TaxInputCard';
import { createTaxData } from '@/test/factories/test-data-factory';

describe('TaxInputCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('gives both tax controls an accessible name', () => {
    render(<TaxInputCard taxes={createTaxData()} onUpdate={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'State' })).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Filing Status' }),
    ).toBeInTheDocument();
  });

  it('reports a filing-status change through onUpdate', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<TaxInputCard taxes={createTaxData()} onUpdate={onUpdate} />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filing Status' }),
      'marriedJoint',
    );

    expect(onUpdate).toHaveBeenCalledWith({ filingStatus: 'marriedJoint' });
  });
});
