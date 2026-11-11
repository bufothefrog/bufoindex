/**
 * Helpers shared by the Wizard tests (test/components/guided/Wizard*.test.tsx).
 * Each file still mocks next/navigation itself (see ./navigation.ts).
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProfileStore } from '@/lib/store/profileStore';

/** Saves the default values for `paths` as answered, like a finished intake. */
export function answer(paths: readonly string[]): void {
  useProfileStore.getState().setValues([], { provide: [...paths] });
}

/** Clears the field labelled `label` and types `text`; returns the user-event instance. */
export async function typeInto(label: string, text: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, text);
  return user;
}
