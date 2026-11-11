import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import Checkbox from '@/components/ui/checkbox';

function Controlled(props: { error?: string; help?: string; disabled?: boolean }) {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      label="I receive regular bonuses"
      description="Annual or quarterly"
      checked={checked}
      onCheckedChange={setChecked}
      testId="bonus"
      {...props}
    />
  );
}

describe('Checkbox', () => {
  it('is named by its label and described by its description and help', () => {
    render(<Controlled help="Recorded for context" />);
    const box = screen.getByRole('checkbox', { name: 'I receive regular bonuses' });
    expect(box).toHaveAccessibleDescription('Annual or quarterly Recorded for context');
    expect(box).not.toHaveAttribute('aria-invalid');
  });

  it('toggles from the box and from the label text (the whole row is the target)', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const box = screen.getByRole('checkbox');
    await user.click(box);
    expect(box).toBeChecked();
    await user.click(screen.getByText('I receive regular bonuses'));
    expect(box).not.toBeChecked();
    expect(screen.getByTestId('bonus').querySelector('label')?.className).toContain('min-h-11');
  });

  it('shows an error in place of help and marks the box invalid', () => {
    render(<Controlled help="hidden" error="Required." />);
    const box = screen.getByRole('checkbox');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription('Annual or quarterly Required.');
    expect(screen.getByRole('alert')).toHaveTextContent('Required.');
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });

  it('does not toggle when disabled', async () => {
    const user = userEvent.setup();
    render(<Controlled disabled />);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
