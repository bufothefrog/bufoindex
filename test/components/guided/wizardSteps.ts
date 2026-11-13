/**
 * Steps through the wizard for the Wizard tests. The three basics screens
 * need the visitor's own entry before Next moves on (nextNeedsOwnAnswer), so
 * these helpers answer them the way a visitor would.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { routerMock } from '@/test/utils/navigation';
import { typeInto } from '@/test/utils/wizard';

type User = ReturnType<typeof userEvent.setup>;

export const next = (user: User) => user.click(screen.getByRole('button', { name: /^(Next|Finish)/ }));

export const skip = (user: User) => user.click(screen.getByRole('button', { name: 'Skip' }));

/** Picks a state in the state combobox by its name. */
export async function chooseState(user: User, name: string) {
  const box = screen.getByRole('combobox', { name: 'State you live in' });
  await user.click(box);
  await user.type(box, name.slice(0, 4));
  await user.click(screen.getByRole('option', { name: new RegExp(`^${name}`) }));
}

export interface AboutAnswers {
  age?: string;
  state?: string;
  status?: string;
}

/** Fills the "A little about you" screen (the default profile's values unless given). */
export async function fillAbout(user: User, { age = '25', state = 'California', status = 'Single' }: AboutAnswers = {}) {
  await typeInto('Your age', age);
  await chooseState(user, state);
  await user.click(within(screen.getByRole('radiogroup', { name: 'Tax filing status' })).getByRole('radio', { name: status }));
}

/** Fills the paycheck screen with the default profile's values. */
export async function fillPay(user: User) {
  await typeInto('Gross pay per paycheck', '4000');
  await user.selectOptions(screen.getByLabelText('How often you are paid'), 'bi-weekly');
  await typeInto('Take-home pay per paycheck', '2550');
}

/** Answers the three basics screens with the default profile's values and moves past each. */
export async function answerBasics(user: User, about: AboutAnswers = {}) {
  await fillAbout(user, about);
  await next(user);
  await fillPay(user);
  await next(user);
  await typeInto('Must-pay costs per month', '3000');
  await next(user);
}

/** Clicks Skip until the wizard leaves (router push or replace); returns the screens skipped. */
export async function skipToEnd(user: User): Promise<number> {
  let count = 0;
  while (routerMock.push.mock.calls.length === 0 && routerMock.replace.mock.calls.length === 0) {
    if (count > 40) throw new Error('the wizard did not finish');
    await skip(user);
    count += 1;
  }
  return count;
}
