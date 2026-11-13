import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LG_MEDIA_QUERY, useMediaQuery } from '@/components/ui/layouts/useMediaQuery';

function Probe({ query }: { query: string }) {
  return <p>{useMediaQuery(query) ? 'matches' : 'no match'}</p>;
}

/** A MediaQueryList stand-in whose match can be flipped, firing `change`. */
function mockMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const queries: string[] = [];
  vi.stubGlobal('matchMedia', (query: string) => {
    queries.push(query);
    return {
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    };
  });
  return {
    queries,
    listeners,
    set(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('mirrors Tailwind lg in rem', () => {
    expect(LG_MEDIA_QUERY).toBe('(min-width: 64rem)');
  });

  it('is false where window.matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<Probe query={LG_MEDIA_QUERY} />);
    expect(screen.getByText('no match')).toBeInTheDocument();
  });

  it('renders false on the server, whatever the query', () => {
    mockMatchMedia(true);
    expect(renderToString(<Probe query={LG_MEDIA_QUERY} />)).toContain('no match');
  });

  it('follows the media query list and its change event, and unsubscribes on unmount', () => {
    const media = mockMatchMedia(true);
    const { unmount } = render(<Probe query={LG_MEDIA_QUERY} />);
    expect(screen.getByText('matches')).toBeInTheDocument();
    expect(media.queries).toContain('(min-width: 64rem)');

    act(() => media.set(false));
    expect(screen.getByText('no match')).toBeInTheDocument();
    act(() => media.set(true));
    expect(screen.getByText('matches')).toBeInTheDocument();

    expect(media.listeners.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
