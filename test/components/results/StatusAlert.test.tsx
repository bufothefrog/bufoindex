import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AlertTriangle } from 'lucide-react';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { TONE_SURFACE, TONE_TEXT } from '@/lib/design-system/tone';

describe('StatusAlert', () => {
  it('defaults to the info tone with no live role', () => {
    const { container } = render(<StatusAlert title="Heads up">Body</StatusAlert>);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute('data-tone', 'info');
    expect(root).not.toHaveAttribute('role');
    expect(screen.getByText('Heads up')).toHaveClass(TONE_TEXT.info);
  });

  it('maps the deprecated variant and lets tone win', () => {
    const { container, rerender } = render(<StatusAlert variant="danger">x</StatusAlert>);
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'negative');
    rerender(<StatusAlert variant="warning">x</StatusAlert>);
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'caution');
    rerender(
      <StatusAlert variant="warning" tone="positive">
        x
      </StatusAlert>
    );
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'positive');
  });

  it('tints the surface in the tinted appearance and exposes a role when asked', () => {
    render(
      <StatusAlert tone="caution" appearance="tinted" icon={AlertTriangle} title="Check inputs" role="alert">
        Retirement age is before current age.
      </StatusAlert>
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass(TONE_SURFACE.caution);
    expect(alert).toHaveTextContent('Retirement age is before current age.');
  });
});
