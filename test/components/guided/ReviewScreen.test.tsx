import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewScreenPage, { dynamicParams, generateStaticParams } from '@/app/start/review/[screen]/page';
import { PROFILE_FORM } from '@/lib/calculators/forms';
import type { FormSpec } from '@/lib/fields/types';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetRouterMock, routerMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { typeInto } from '@/test/utils/wizard';

vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory());

// While `injected.form` is set it stands in for the profile form the wizard
// runs, to reach a topic the saved values hide.
const injected = vi.hoisted(() => ({ form: null as FormSpec | null }));

vi.mock('@/lib/calculators/forms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/calculators/forms')>();
  return {
    ...actual,
    formForFlow: (flow: Parameters<typeof actual.formForFlow>[0]) =>
      flow === 'profile' && injected.form ? injected.form : actual.formForFlow(flow),
  };
});

const { push, replace } = routerMock;

async function renderTopic(id: string) {
  render(await ReviewScreenPage({ params: Promise.resolve({ screen: id }) }));
}

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore();
  injected.form = null;
});

afterEach(() => {
  cleanup();
});

describe('/start/review/<screen>', () => {
  it('asks that one topic with Save and Cancel, and no Skip, Next or progress', async () => {
    await renderTopic('must-pay');

    expect(screen.getByText('Review your answers')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'The basics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'What do you have to pay each month?' })).toBeInTheDocument();
    // Not answered yet: blank, as in the wizard.
    expect(screen.getByLabelText('Must-pay costs per month')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/start/review#topic-must-pay');
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next|Finish/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('names Save, not Next or Skip, in the line about grey values and example rows', async () => {
    await renderTopic('target');
    expect(screen.getByText('Grey values are typical. Save uses them for anything left blank.')).toBeInTheDocument();
    expect(screen.queryByText(/Next uses them/)).not.toBeInTheDocument();
    cleanup();

    await renderTopic('accounts');
    expect(screen.getByText('This is an example. Change it to match yours.')).toBeInTheDocument();
    expect(screen.queryByText(/or skip/)).not.toBeInTheDocument();
  });

  it('Save writes the topic as Next does and returns to its row on the review page', async () => {
    await renderTopic('must-pay');
    const user = await typeInto('Must-pay costs per month', '3100');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const saved = useProfileStore.getState().profile;
    expect(saved.spending.necessaryMonthly).toBe(3100);
    expect(saved.provided).toContain('spending.necessaryMonthly');
    expect(push).toHaveBeenCalledWith('/start/review#topic-must-pay');
  });

  it('Save keeps the wizard checks: a blank basics answer is not saved', async () => {
    await renderTopic('must-pay');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Enter your must-pay costs')).toBeInTheDocument();
    expect(useProfileStore.getState().profile.provided).not.toContain('spending.necessaryMonthly');
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a saved answer with its value, as the wizard does', async () => {
    useProfileStore.getState().setValues([{ path: 'spending.necessaryMonthly', value: 2800 }]);
    await renderTopic('must-pay');
    expect(screen.getByLabelText('Must-pay costs per month')).toHaveValue('2,800');
  });

  it('Cancel leaves the profile as it was: typing alone writes nothing', async () => {
    const before = useProfileStore.getState().profile;
    await renderTopic('must-pay');
    await typeInto('Must-pay costs per month', '9999');

    expect(useProfileStore.getState().profile).toBe(before);
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/start/review#topic-must-pay');
    expect(push).not.toHaveBeenCalled();
  });

  it('is a 404 for an unknown topic', async () => {
    await expect(ReviewScreenPage({ params: Promise.resolve({ screen: 'no-such-topic' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
  });

  it('builds one static page per profile topic and no other', () => {
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual(PROFILE_FORM.screens.map((spec) => ({ screen: spec.id })));
  });

  it('returns to the review list for a topic the saved answers hide', async () => {
    const pay = PROFILE_FORM.screens.find((spec) => spec.id === 'pay');
    if (!pay) throw new Error('no pay screen');
    injected.form = {
      ...PROFILE_FORM,
      fields: PROFILE_FORM.fields.map((spec) =>
        spec.path === 'income.grossPerPaycheck' || spec.path === 'income.frequency' || spec.path === 'income.netPerPaycheck'
          ? { ...spec, visibleWhen: () => false }
          : spec
      ),
    };
    await renderTopic('pay');

    expect(replace).toHaveBeenCalledWith('/start/review');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});
