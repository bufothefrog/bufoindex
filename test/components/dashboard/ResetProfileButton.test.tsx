/**
 * The reset button wipes the saved profile, so it asks first: the first tap
 * only shows the confirmation, Cancel goes back without resetting, and
 * Confirm resets exactly once.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetProfileButton from '@/components/dashboard/ResetProfileButton';

const PROMPT = 'Clear the saved profile from this browser?';

describe('ResetProfileButton', () => {
  it('asks for confirmation on the first tap and does not reset yet', async () => {
    const onReset = vi.fn();
    render(<ResetProfileButton onReset={onReset} />);

    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reset profile' }));

    expect(screen.getByRole('group', { name: PROMPT })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset profile' })).not.toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();
  });

  it('goes back to the first state on Cancel without resetting', async () => {
    const onReset = vi.fn();
    render(<ResetProfileButton onReset={onReset} />);

    await userEvent.click(screen.getByRole('button', { name: 'Reset profile' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onReset).not.toHaveBeenCalled();
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset profile' })).toBeInTheDocument();
  });

  it('resets exactly once on Confirm', async () => {
    const onReset = vi.fn();
    render(<ResetProfileButton onReset={onReset} />);

    await userEvent.click(screen.getByRole('button', { name: 'Reset profile' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reset' }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });
});
