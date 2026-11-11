import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { nextNavigationFactory, resetRouterMock, setMockSearchParams } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { CoreStartWizard } from '@/components/guided/CoreStartWizard';
import CoreStartPage, { metadata } from '@/app/start/page';

vi.mock('next/navigation', () => nextNavigationFactory());

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore({ hydrated: true });
});

describe('CoreStartWizard', () => {
  it('reads next from the query and names the intent that follows', () => {
    setMockSearchParams('?next=retirement');
    render(<CoreStartWizard />);
    expect(screen.getByText('After this: See if I am on track to retire.')).toBeInTheDocument();
  });

  it('ignores an unknown next value', () => {
    setMockSearchParams('?next=nope');
    render(<CoreStartWizard />);
    expect(screen.getByRole('heading', { level: 1, name: 'A few basics' })).toBeInTheDocument();
    expect(screen.queryByText(/After this:/)).not.toBeInTheDocument();
  });
});

describe('/start page', () => {
  it('is a static page that renders the core intake and is not indexed', () => {
    render(<CoreStartPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'A few basics' })).toBeInTheDocument();
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
