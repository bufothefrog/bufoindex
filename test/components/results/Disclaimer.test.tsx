/**
 * Disclaimer renders the footer line every calculator and the overview end
 * with, composed from the shared fragments.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { Disclaimer } from '@/components/ui/results';
import { DISCLAIMER, composeDisclaimer } from '@/lib/constants/disclaimers';

afterEach(() => {
  cleanup();
});

describe('Disclaimer', () => {
  it('prefixes the composed text with a bold "Disclaimer:" label', () => {
    render(<Disclaimer text={composeDisclaimer(DISCLAIMER.base, DISCLAIMER.prices, DISCLAIMER.advice)} />);

    const label = screen.getByText('Disclaimer:');
    expect(label.tagName).toBe('STRONG');
    expect(label.parentElement).toHaveTextContent(
      'Disclaimer: Educational tool only. Assumes stated prices are current and executable. Not tax or investment advice.'
    );
  });
});
