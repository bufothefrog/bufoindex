import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// global-error imports the global stylesheet because it replaces the root
// layout; the test does not need Tailwind to run.
vi.mock('@/app/globals.css', () => ({}));

import ErrorPage from '@/app/error';
import GlobalError from '@/app/global-error';

let errorSpy: MockInstance<typeof console.error>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('app/error.tsx', () => {
  it('logs the error once and offers a retry', () => {
    const error = Object.assign(new Error('boom'), { digest: 'abc' });
    const reset = vi.fn();
    render(<ErrorPage error={error} reset={reset} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith(error);
    expect(errorSpy.mock.calls.filter(([arg]) => arg === error)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe('app/global-error.tsx', () => {
  it('logs the error and offers a retry', () => {
    const error = new Error('layout failed');
    const reset = vi.fn();
    // It renders its own <html>/<body>; inside the test container React warns
    // about the nesting, which the console.error spy absorbs.
    render(<GlobalError error={error} reset={reset} />);

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith(error);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
