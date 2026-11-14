/**
 * Helpers for the intake tests: what a flow asks now, read from the forms.
 *
 * askedScreens(flow) lists each screen the intake asks ('all' mode) with
 * each visible question's path, label, kind, help, options and bounds;
 * intakePaths(flow) lists every path a flow's intake can ask;
 * fromDefaults(overrides) is a Get over the default profile.
 */

import { getIntakeScreens, intakeForm, type IntakeFlow } from '@/lib/constants/intake';
import { resolveOptions, visibleScreenFields } from '@/lib/fields/runtime';
import type { FieldOption, FormSpec, Get, ScreenSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile, getProfileValue } from '@/lib/profile/defaults';

/** Every profile path a flow's intake can ask, in order, deduplicated. */
export function intakePaths(flow: IntakeFlow): string[] {
  return Array.from(new Set(intakeForm(flow).screens.flatMap((screen) => screen.fields)));
}

/** A Get over the default profile, with `overrides` by path. */
export const fromDefaults = (overrides: Record<string, unknown> = {}): Get => {
  const defaults = getDefaultFinancialProfile();
  return (path: string) => (path in overrides ? overrides[path] : getProfileValue(defaults, path));
};

interface AskedQuestion {
  path: string;
  label: string;
  kind: string;
  help?: unknown;
  options?: readonly FieldOption[];
  min?: number;
  max?: number;
  step?: number;
}

export interface AskedScreen {
  id: string;
  title: string;
  description?: string;
  questions: AskedQuestion[];
}

/** One screen of `form` in askedScreens' shape: its wording and each visible question's wording and bounds. */
export function askedScreen(form: FormSpec, screen: ScreenSpec, get: Get = fromDefaults()): AskedScreen {
  return {
    id: screen.id,
    title: screen.title,
    description: screen.description,
    questions: visibleScreenFields(form, screen, get).map((spec) => {
      const options = resolveOptions(spec, get);
      return {
        path: spec.path,
        label: spec.label,
        kind: spec.kind,
        help: spec.help,
        options: options.length > 0 ? options : undefined,
        min: spec.min,
        max: spec.max,
        step: spec.step,
      };
    }),
  };
}

/** What the flow asks now ('all' mode), screen by screen, with each visible question's wording and bounds. */
export function askedScreens(flow: IntakeFlow, get: Get = fromDefaults()): AskedScreen[] {
  const form = intakeForm(flow);
  return getIntakeScreens(flow, get).map((screen) => askedScreen(form, screen, get));
}
