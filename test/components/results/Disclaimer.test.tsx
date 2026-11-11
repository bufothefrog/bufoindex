import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Disclaimer, DEFAULT_DISCLAIMER_TEXT } from '@/components/ui/results';
import { DISCLAIMERS, DISCLAIMER } from '@/lib/constants/disclaimers';

describe('Disclaimer', () => {
  it('is a note with the default calculator disclaimer', () => {
    render(<Disclaimer />);
    const note = screen.getByRole('note', { name: 'Disclaimer' });
    expect(note).toHaveTextContent(`Disclaimer: ${DEFAULT_DISCLAIMER_TEXT}`);
    expect(DEFAULT_DISCLAIMER_TEXT).toContain(DISCLAIMER.consultAdvisor);
  });

  it('renders explicit text verbatim', () => {
    render(<Disclaimer text={DISCLAIMERS.retirement} align="start" />);
    expect(screen.getByRole('note')).toHaveTextContent(DISCLAIMERS.retirement);
  });

  it('composes fragments', () => {
    render(<Disclaimer fragments={['educational', 'notAdvice']} />);
    expect(screen.getByRole('note')).toHaveTextContent('Educational tool only. Not tax or investment advice.');
  });
});
