/**
 * Label parity for the input primitives. The default label is exactly the
 * one these primitives rendered before the size prop existed; leading-none
 * must survive tailwind-merge at every size (a text-* class placed after it
 * would drop it, changing the label's line-height).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MoneyInput, NumberInput, PercentInput } from '@/components/ui/inputs';
import type { InputSize } from '@/components/ui/inputs';
import { SelectInput } from '@/components/shared/inputs/SelectInput';

const DEFAULT_LABEL = 'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70';

const noop = () => {};

const PRIMITIVES: [string, (size?: InputSize) => React.ReactElement][] = [
  ['MoneyInput', (size) => <MoneyInput name="m" label="Label" value={1} onChange={noop} size={size} />],
  ['NumberInput', (size) => <NumberInput name="n" label="Label" value={1} onChange={noop} size={size} />],
  ['PercentInput', (size) => <PercentInput name="p" label="Label" value={0.1} onChange={noop} size={size} />],
  [
    'SelectInput',
    (size) => (
      <SelectInput name="s" label="Label" value="a" onChange={noop} options={[{ value: 'a', label: 'A' }]} size={size} />
    ),
  ],
];

describe.each(PRIMITIVES)('%s label', (_, renderInput) => {
  it('keeps the original classes at the default size', () => {
    render(renderInput());
    expect(screen.getByText('Label').closest('label')?.className).toBe(DEFAULT_LABEL);
  });

  it('keeps leading-none at size xl', () => {
    render(renderInput('xl'));
    const classes = screen.getByText('Label').closest('label')?.className.split(' ');
    expect(classes).toContain('leading-none');
    expect(classes).toContain('text-base');
  });
});
