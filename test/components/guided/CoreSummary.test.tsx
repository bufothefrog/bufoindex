/**
 * CoreSummary: the one-line recap of the saved core answers, in the same
 * pieces as the collapsed core cards, with a link to edit them.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoreSummary } from '@/components/guided/CoreSummary';
import { CORE_PATHS } from '@/lib/constants/intake';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';

describe('CoreSummary', () => {
  it('recaps every saved core answer, take-home pay included', () => {
    render(<CoreSummary profile={{ ...getDefaultFinancialProfile(), provided: [...CORE_PATHS] }} />);
    expect(
      screen.getByText('30, TX, single, $3,500 gross every 2 weeks, $2,600 take-home, $3,000 a month in must-pay costs')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit the basics' })).toHaveAttribute('href', '/start');
  });

  it('says the calculators use typical values while nothing is saved', () => {
    render(<CoreSummary profile={getDefaultFinancialProfile()} />);
    expect(screen.getByText('none saved yet, so the calculators use typical values.')).toBeInTheDocument();
  });
});
