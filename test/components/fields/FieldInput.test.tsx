/**
 * FieldInput renders any FieldSpec with the matching primitive. Each kind
 * must have a label linked to its control, help text in its accessible
 * description, and an announced error that replaces the help. Also covered:
 * visibleWhen, nullable auto/override, coupled onChange writes arriving in
 * the same onWrite call, the lg (wizard) size, hints, and custom renderers.
 */

import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FieldInput } from '@/components/fields';
import type { CustomRenderer, CustomRendererProps, FieldInputProps } from '@/components/fields';
import { BLANK_SELECT_LABEL, type FieldDisplay } from '@/components/fields/FieldInput';
import type { FieldSpec } from '@/lib/fields/types';
import { FieldHarness, ResizeObserverStub, writeSpy } from './harness';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

type Extra = Omit<FieldInputProps, 'spec' | 'get' | 'onWrite'>;

function renderField(spec: FieldSpec, initial: Record<string, unknown>, extra: Extra = {}, onWrite = writeSpy()) {
  render(
    <FieldHarness initial={initial} onWrite={onWrite}>
      {({ get, onWrite: write }) => <FieldInput spec={spec} get={get} onWrite={write} {...extra} />}
    </FieldHarness>
  );
  return onWrite;
}

const GROSS: FieldSpec = {
  path: 'income.gross',
  kind: 'money',
  label: 'Gross pay',
  help: 'Before taxes, per paycheck',
  tier: 'core',
  min: 0,
};
const AGE: FieldSpec = { path: 'person.age', kind: 'number', label: 'Age', help: 'Your age today', tier: 'core', min: 16, max: 100 };
const MATCH: FieldSpec = {
  path: 'workplace.match',
  kind: 'percent',
  label: 'Employer match',
  help: 'Share of your contribution',
  tier: 'details',
  min: 0,
  max: 2,
};
const MULTIPLIER: FieldSpec = {
  path: 'assumptions.healthcare',
  kind: 'slider',
  label: 'Healthcare cost multiplier',
  help: 'Times the average cost',
  tier: 'assumption',
  min: 0.5,
  max: 3,
  step: 0.1,
  unit: { suffix: 'x' },
};
const FREQUENCY: FieldSpec = {
  path: 'income.frequency',
  kind: 'select',
  label: 'Pay frequency',
  help: 'How often you are paid',
  tier: 'core',
  options: [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ],
};
const RATIO: FieldSpec = {
  path: 'strategy.ratio',
  kind: 'select',
  label: 'Leverage ratio',
  tier: 'details',
  options: [
    { value: 1.5, label: '1.5x' },
    { value: 2, label: '2x' },
  ],
};
const RISK: FieldSpec = {
  path: 'assumptions.risk',
  kind: 'choice',
  label: 'Risk profile',
  help: 'How returns are modeled',
  tier: 'assumption',
  options: [
    { value: 'tdf', label: 'Target-date fund', description: 'A glide path' },
    { value: 'custom', label: 'Custom' },
  ],
};
const HAS_401K: FieldSpec = {
  path: 'workplace.has401k',
  kind: 'boolean',
  label: 'I have a 401(k)',
  help: 'Through your employer',
  tier: 'details',
};
const STATE: FieldSpec = { path: 'person.state', kind: 'state', label: 'State', help: 'For state taxes', tier: 'core' };
const NAME: FieldSpec = {
  path: 'account.name',
  kind: 'text',
  label: 'Account name',
  help: 'As your broker shows it',
  tier: 'details',
  maxLength: 40,
  placeholder: 'Fidelity Roth IRA',
};

describe('FieldInput: labels, help and errors per kind', () => {
  it.each([
    ['money', GROSS, { income: { gross: 3500 } }, 'Gross pay'],
    ['number', AGE, { person: { age: 30 } }, 'Age'],
    ['percent', MATCH, { workplace: { match: 0.5 } }, 'Employer match'],
    ['slider', MULTIPLIER, { assumptions: { healthcare: 1 } }, 'Healthcare cost multiplier'],
    ['text', NAME, { account: { name: 'Roth' } }, 'Account name'],
  ])('%s: a textbox named by its label, described by its help', (_kind, spec, initial, name) => {
    renderField(spec, initial);
    const box = screen.getByRole('textbox', { name });
    expect(box).toHaveAccessibleDescription(String(spec.help));
    expect(box).not.toBeInvalid();
  });

  it.each([
    ['money', GROSS, { income: { gross: -1 } }, 'Gross pay'],
    ['number', AGE, { person: { age: 15 } }, 'Age'],
    ['percent', MATCH, { workplace: { match: 3 } }, 'Employer match'],
    ['slider', MULTIPLIER, { assumptions: { healthcare: 4 } }, 'Healthcare cost multiplier'],
    ['text', NAME, { account: { name: 'x' } }, 'Account name'],
  ])('%s: the error replaces the help, is announced and linked', (_kind, spec, initial, name) => {
    renderField(spec, initial, { error: `${name} is out of range.` });
    const box = screen.getByRole('textbox', { name });
    expect(box).toBeInvalid();
    expect(box).toHaveAccessibleDescription(expect.stringContaining(`${name} is out of range.`));
    expect(screen.getByRole('alert')).toHaveTextContent(`${name} is out of range.`);
    expect(screen.queryByText(String(spec.help))).not.toBeInTheDocument();
  });

  it('percent with slider: also a slider with the same name', () => {
    renderField({ ...MATCH, slider: true }, { workplace: { match: 0.5 } });
    expect(screen.getByRole('textbox', { name: 'Employer match' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Employer match' })).toHaveAttribute('aria-valuenow', '50');
  });

  it('slider: a slider and the bounds printed with the unit', () => {
    renderField(MULTIPLIER, { assumptions: { healthcare: 1.5 } });
    expect(screen.getByRole('slider', { name: 'Healthcare cost multiplier' })).toHaveAttribute('aria-valuenow', '1.5');
    expect(screen.getByText('0.5x')).toBeInTheDocument();
    expect(screen.getByText('1.5x')).toBeInTheDocument();
    expect(screen.getByText('3x')).toBeInTheDocument();
  });

  it('select: a combobox named by its label, showing help, then the error', () => {
    renderField(FREQUENCY, { income: { frequency: 'monthly' } });
    const select = screen.getByRole('combobox', { name: 'Pay frequency' });
    expect(select).toHaveValue('monthly');
    expect(select).toHaveAccessibleDescription('How often you are paid');
    expect(select).not.toBeInvalid();
    cleanup();

    renderField(FREQUENCY, { income: { frequency: 'monthly' } }, { error: 'Pick one.' });
    const invalid = screen.getByRole('combobox', { name: 'Pay frequency' });
    expect(invalid).toBeInvalid();
    expect(invalid).toHaveAccessibleDescription('Pick one.');
    expect(screen.getByRole('alert')).toHaveTextContent('Pick one.');
    expect(screen.queryByText('How often you are paid')).not.toBeInTheDocument();
  });

  it('select: writes the option value with its own type', () => {
    const onWrite = renderField(RATIO, { strategy: { ratio: 2 } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Leverage ratio' }), { target: { value: '1.5' } });
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'strategy.ratio', value: 1.5 }]);
    expect(screen.getByRole('combobox', { name: 'Leverage ratio' })).toHaveValue('1.5');
  });

  it('choice: a radiogroup named by its label and described by its help', () => {
    renderField(RISK, { assumptions: { risk: 'tdf' } });
    const group = screen.getByRole('radiogroup', { name: 'Risk profile' });
    expect(group).toHaveAccessibleDescription('How returns are modeled');
    expect(screen.getByRole('radio', { name: /Target-date fund/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Custom' })).not.toBeChecked();
  });

  it('choice: the error is announced and describes the group', () => {
    renderField(RISK, { assumptions: { risk: 'other' } }, { error: 'Risk profile must be one of the listed options.' });
    const group = screen.getByRole('radiogroup', { name: 'Risk profile' });
    expect(group).toHaveAccessibleDescription(expect.stringContaining('must be one of the listed options'));
    expect(group).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Risk profile must be one of the listed options.');
  });

  it('choice: a click writes the option', async () => {
    const user = userEvent.setup();
    const onWrite = renderField(RISK, { assumptions: { risk: 'tdf' } });
    await user.click(screen.getByRole('radio', { name: 'Custom' }));
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'assumptions.risk', value: 'custom' }]);
    expect(screen.getByRole('radio', { name: 'Custom' })).toBeChecked();
  });

  it('boolean (md): a checkbox named by its label, with help, then an error', async () => {
    const user = userEvent.setup();
    const onWrite = renderField(HAS_401K, { workplace: { has401k: false } });
    const box = screen.getByRole('checkbox', { name: 'I have a 401(k)' });
    expect(box).toHaveAccessibleDescription('Through your employer');
    await user.click(box);
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'workplace.has401k', value: true }]);
    expect(box).toBeChecked();
    cleanup();

    renderField(HAS_401K, { workplace: { has401k: false } }, { error: 'Answer this.' });
    expect(screen.getByRole('checkbox', { name: 'I have a 401(k)' })).toHaveAccessibleDescription('Answer this.');
    expect(screen.getByRole('alert')).toHaveTextContent('Answer this.');
  });

  it('boolean (lg): a Yes / No radiogroup that writes booleans', async () => {
    const user = userEvent.setup();
    const onWrite = renderField(HAS_401K, { workplace: { has401k: true } }, { size: 'lg' });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'I have a 401(k)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'No' }));
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'workplace.has401k', value: false }]);
  });

  it('boolean (lg): uses the spec options when it has them', () => {
    renderField(
      { ...HAS_401K, options: [{ value: true, label: 'I have debts' }, { value: false, label: 'I have no debts' }] },
      { workplace: { has401k: false } },
      { size: 'lg' }
    );
    expect(screen.getByRole('radio', { name: 'I have no debts' })).toBeChecked();
  });

  it('state: the state combobox named by its label, showing help, then the error', () => {
    renderField(STATE, { person: { state: 'TX' } });
    const box = screen.getByRole('combobox', { name: 'State' });
    expect(box).toHaveValue('Texas');
    expect(box).toHaveAccessibleDescription('For state taxes');
    cleanup();

    renderField(STATE, { person: { state: '' } }, { error: 'State is required.' });
    const invalid = screen.getByRole('combobox', { name: 'State' });
    expect(invalid).toBeInvalid();
    expect(invalid).toHaveAccessibleDescription('State is required.');
    expect(screen.getByRole('alert')).toHaveTextContent('State is required.');
    expect(screen.queryByText('For state taxes')).not.toBeInTheDocument();
  });

  it('text: typing writes the string', () => {
    const onWrite = renderField(NAME, { account: { name: '' } });
    const box = screen.getByRole('textbox', { name: 'Account name' });
    expect(box).toHaveAttribute('placeholder', 'Fidelity Roth IRA');
    expect(box).toHaveAttribute('maxLength', '40');
    fireEvent.change(box, { target: { value: 'Roth' } });
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'account.name', value: 'Roth' }]);
    expect(box).toHaveValue('Roth');
  });

  it('money: typing writes the number at the field path', () => {
    const onWrite = renderField(GROSS, { income: { gross: 0 } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Gross pay' }), { target: { value: '4200' } });
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'income.gross', value: 4200 }]);
  });

  it('money with decimals: a $ number box that keeps cents', () => {
    const onWrite = renderField({ ...GROSS, precision: 2 }, { income: { gross: 0 } });
    expect(screen.getByText('$')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Gross pay' }), { target: { value: '12.34' } });
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'income.gross', value: 12.34 }]);
  });

  it('gives the wrapper the spec test id, for kinds whose primitive has none too', () => {
    renderField({ ...FREQUENCY, testId: 'frequency-field' }, { income: { frequency: 'weekly' } });
    expect(screen.getByTestId('frequency-field')).toContainElement(screen.getByRole('combobox', { name: 'Pay frequency' }));
  });
});

describe('FieldInput: resolved text, hints and visibility', () => {
  it('resolves help through the Get and appends the hint as a LookupHint', () => {
    renderField(
      { ...GROSS, help: (get) => `Paid ${String(get('income.frequency'))}`, hint: 'Your pay stub shows it.' },
      { income: { gross: 3500, frequency: 'monthly' } }
    );
    expect(screen.getByRole('textbox', { name: 'Gross pay' })).toHaveAccessibleDescription('Paid monthly');
    expect(screen.getByText('Your pay stub shows it.')).toBeInTheDocument();
  });

  it('renders nothing while visibleWhen is false, and the field once it turns true', async () => {
    const user = userEvent.setup();
    const amount: FieldSpec = {
      path: 'income.bonusAmount',
      kind: 'money',
      label: 'Bonus amount',
      tier: 'details',
      visibleWhen: (get) => get('income.hasBonus') === true,
    };
    const hasBonus: FieldSpec = { path: 'income.hasBonus', kind: 'boolean', label: 'I get a bonus', tier: 'details' };
    render(
      <FieldHarness initial={{ income: { hasBonus: false, bonusAmount: 0 } }}>
        {({ get, onWrite }) => (
          <>
            <FieldInput spec={hasBonus} get={get} onWrite={onWrite} />
            <FieldInput spec={amount} get={get} onWrite={onWrite} />
          </>
        )}
      </FieldHarness>
    );
    expect(screen.queryByRole('textbox', { name: 'Bonus amount' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'I get a bonus' }));
    expect(screen.getByRole('textbox', { name: 'Bonus amount' })).toBeInTheDocument();
  });
});

describe('FieldInput: coupled writes', () => {
  it('sends the field write and the onChange writes in one onWrite call, with a Get that sees the new value', () => {
    const seen: unknown[] = [];
    const total: FieldSpec = {
      ...MATCH,
      path: 'workplace.total',
      label: 'Total contribution',
      onChange: (value, get) => {
        seen.push(get('workplace.total'));
        return [{ path: 'workplace.roth', value: Math.min(Number(get('workplace.roth')), Number(value)) }];
      },
    };
    const onWrite = renderField(total, { workplace: { total: 0.1, roth: 0.08 } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Total contribution' }), { target: { value: '5' } });
    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onWrite).toHaveBeenCalledWith([
      { path: 'workplace.total', value: 0.05 },
      { path: 'workplace.roth', value: 0.05 },
    ]);
    expect(seen).toEqual([0.05]);
  });
});

describe('FieldInput: nullable fields', () => {
  const TAX: FieldSpec = {
    path: 'assumptions.taxRate',
    kind: 'percent',
    label: 'Effective tax rate',
    tier: 'assumption',
    min: 0,
    max: 0.4,
    nullable: { autoLabel: 'Estimated from your income', overrideDefault: (get) => Number(get('person.estimate')) },
  };

  it('shows the auto source and value while null, and the input after switching to custom', async () => {
    const user = userEvent.setup();
    const onWrite = renderField(TAX, { assumptions: { taxRate: null }, person: { estimate: 0.15 } });

    const group = screen.getByRole('group', { name: 'Effective tax rate' });
    expect(group).toHaveTextContent('Estimated from your income: 15%');
    expect(screen.queryByRole('textbox', { name: 'Effective tax rate' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Custom' }));
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'assumptions.taxRate', value: 0.15 }]);
    expect(screen.getByRole('textbox', { name: 'Effective tax rate' })).toHaveValue('15.0');
    expect(screen.getByRole('radio', { name: 'Custom' })).toHaveFocus();

    fireEvent.change(screen.getByRole('textbox', { name: 'Effective tax rate' }), { target: { value: '22' } });
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'assumptions.taxRate', value: 0.22 }]);

    // Re-selecting Custom keeps the typed value.
    await user.click(screen.getByRole('radio', { name: 'Custom' }));
    expect(onWrite).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'assumptions.taxRate', value: null }]);
    expect(screen.getByRole('group', { name: 'Effective tax rate' })).toHaveTextContent('Estimated from your income: 15%');
  });

  it('starts on custom when the value is a number', () => {
    renderField(TAX, { assumptions: { taxRate: 0.2 }, person: { estimate: 0.15 } });
    expect(screen.getByRole('radio', { name: 'Custom' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Effective tax rate' })).toHaveValue('20.0');
  });
});

describe('FieldInput: size lg', () => {
  it('renders the wizard size through the primitives with the same names and descriptions', () => {
    renderField(AGE, { person: { age: 30 } }, { size: 'lg' });
    const box = screen.getByRole('textbox', { name: 'Age' });
    expect(box).toHaveValue('30');
    expect(box).toHaveAccessibleDescription('Your age today');
  });

  it('stacks a choice and can hide its label from sight while it still names the group', () => {
    renderField(RISK, { assumptions: { risk: 'tdf' } }, { size: 'lg', hideLabel: true });
    expect(screen.getByRole('radiogroup', { name: 'Risk profile' })).toBeInTheDocument();
  });

  it('select and text keep their names at lg', () => {
    renderField(FREQUENCY, { income: { frequency: 'weekly' } }, { size: 'lg' });
    expect(screen.getByRole('combobox', { name: 'Pay frequency' })).toHaveValue('weekly');
    cleanup();
    renderField(NAME, { account: { name: 'Roth' } }, { size: 'lg' });
    expect(screen.getByRole('textbox', { name: 'Account name' })).toHaveValue('Roth');
  });

  it('passes the wizard size to the state combobox', () => {
    renderField(STATE, { person: { state: 'TX' } }, { size: 'lg' });
    expect(screen.getByRole('combobox', { name: 'State' })).toHaveClass('h-14', 'text-lg');
  });
});

describe('FieldInput: custom renderers', () => {
  const NOTE: FieldSpec = { path: 'portfolio.holdings', kind: 'custom', label: 'Holdings', tier: 'details', renderer: 'holdings' };

  it('hands the renderer its spec, Get, value, error, size and onWrite', async () => {
    const user = userEvent.setup();
    const received: CustomRendererProps[] = [];
    const holdings: CustomRenderer = (props) => {
      received.push(props);
      return (
        <button type="button" onClick={() => props.onWrite([{ path: 'portfolio.holdings', value: ['VTI', 'BND'] }])}>
          {`Holdings: ${(props.value as string[]).join(', ')}`}
        </button>
      );
    };
    const onWrite = renderField(NOTE, { portfolio: { holdings: ['VTI'] } }, {
      renderers: { holdings },
      error: 'Add a holding.',
      size: 'lg',
    });

    const last = received[received.length - 1];
    expect(last.spec).toBe(NOTE);
    expect(last.value).toEqual(['VTI']);
    expect(last.get('portfolio.holdings')).toEqual(['VTI']);
    expect(last.error).toBe('Add a holding.');
    expect(last.size).toBe('lg');

    await user.click(screen.getByRole('button', { name: 'Holdings: VTI' }));
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'portfolio.holdings', value: ['VTI', 'BND'] }]);
    expect(screen.getByRole('button', { name: 'Holdings: VTI, BND' })).toBeInTheDocument();
  });

  it('shows a visible error when the renderer is missing', () => {
    renderField(NOTE, { portfolio: { holdings: [] } }, { renderers: {} });
    expect(screen.getByRole('alert')).toHaveTextContent('No renderer "holdings" for the field "portfolio.holdings"');
  });
});

describe('FieldInput: word units', () => {
  const LIFE: FieldSpec = {
    path: 'person.lifeExpectancy',
    kind: 'number',
    label: 'Life expectancy',
    help: 'Age to plan to',
    tier: 'details',
    min: 60,
    max: 110,
    unit: { suffix: ' years' },
  };

  it('shows a word unit as its own text beside the value and announces it with the field', () => {
    for (const size of [undefined, 'lg'] as const) {
      renderField(LIFE, { person: { lifeExpectancy: 85 } }, size ? { size } : {});
      const box = screen.getByRole('textbox', { name: 'Life expectancy' });
      expect(box).toHaveValue('85');
      // The unit is readable on its own (not drawn inside the value box)
      // and is part of what a screen reader hears for the field.
      expect(screen.getByText('years')).toBeVisible();
      expect(box).toHaveAccessibleDescription('years Age to plan to');
      cleanup();
    }
  });

  it('keeps a one-character unit inside the box without changing the description', () => {
    renderField({ ...AGE, unit: { suffix: 'x' } }, { person: { age: 30 } });
    expect(screen.getByRole('textbox', { name: 'Age' })).toHaveAccessibleDescription('Your age today');
    expect(screen.getByText('x')).toBeVisible();
  });
});

describe('FieldInput: a blank select (the wizard display layer)', () => {
  const HSA_COVERAGE: FieldSpec = {
    path: 'hsa.coverage',
    kind: 'select',
    label: 'HSA coverage',
    tier: 'details',
    options: [
      { value: 'individual', label: 'Individual' },
      { value: 'family', label: 'Family' },
    ],
  };

  function renderBlank(display: FieldDisplay, onWrite = writeSpy()) {
    render(
      <FieldHarness initial={{ hsa: { coverage: 'family' } }} onWrite={onWrite}>
        {({ get, onWrite: write }) => <FieldInput spec={HSA_COVERAGE} get={get} onWrite={write} display={display} />}
      </FieldHarness>
    );
    return onWrite;
  }

  it('shows the typical option label in the closed control, muted, and stays unanswered', () => {
    const onWrite = renderBlank({ blank: true, typical: 'family', typicalTag: true });
    const select = screen.getByRole('combobox', { name: 'HSA coverage' });
    // Nothing is chosen: the empty placeholder option is selected and shows the typical label.
    expect(select).toHaveValue('');
    expect(select).toHaveDisplayValue('Family');
    expect(select).toHaveClass('text-muted-foreground');
    // The open list still tags the typical option, in the normal text color.
    const typicalOption = screen.getByRole('option', { name: 'Family (typical)' });
    expect(typicalOption).toHaveClass('text-foreground');
    expect((typicalOption as HTMLOptionElement).selected).toBe(false);
    // Rendering writes nothing, so the field does not count as answered.
    expect(onWrite).not.toHaveBeenCalled();
  });

  it('shows the typical label without the tag when the caller does not tag options', () => {
    renderBlank({ blank: true, typical: 'individual' });
    const select = screen.getByRole('combobox', { name: 'HSA coverage' });
    expect(select).toHaveValue('');
    expect(select).toHaveDisplayValue('Individual');
    expect(screen.queryByRole('option', { name: /\(typical\)/ })).not.toBeInTheDocument();
  });

  it('still shows "Select" when there is no typical value', () => {
    for (const typical of [undefined, 'not-an-option']) {
      renderBlank({ blank: true, typical });
      const select = screen.getByRole('combobox', { name: 'HSA coverage' });
      expect(select).toHaveValue('');
      expect(select).toHaveDisplayValue(BLANK_SELECT_LABEL);
      expect(select).toHaveClass('text-muted-foreground');
      cleanup();
    }
  });

  it('shows an answered value in the normal text color', () => {
    renderBlank({ blank: false, typical: 'individual', typicalTag: true });
    const select = screen.getByRole('combobox', { name: 'HSA coverage' });
    expect(select).toHaveValue('family');
    expect(select).toHaveDisplayValue('Family');
    expect(select).not.toHaveClass('text-muted-foreground');
  });
});
