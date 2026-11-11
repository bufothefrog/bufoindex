import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FieldInput, fieldElementId, fieldWrites } from '@/components/fields';
import { makeGet } from '@/lib/fields/paths';
import type { FieldSpec, Write } from '@/lib/fields/types';
import { Harness, KIND_FIELDS, KIND_VALUES, TEST_RENDERERS } from './fixtures';

function spec(path: string): FieldSpec {
  const found = KIND_FIELDS.find((candidate) => candidate.path === path);
  if (!found) throw new Error(`no fixture field ${path}`);
  return found;
}

function renderField(field: FieldSpec, options: { error?: string; size?: 'md' | 'lg'; values?: Record<string, unknown> } = {}) {
  const onWrite = vi.fn<(writes: Write[]) => void>();
  const utils = render(
    <FieldInput
      spec={field}
      get={makeGet(options.values ?? KIND_VALUES)}
      onWrite={onWrite}
      error={options.error}
      size={options.size}
      renderers={TEST_RENDERERS}
      idPrefix="t"
    />
  );
  return { ...utils, onWrite };
}

describe('FieldInput: accessible names, help and errors for every kind', () => {
  const textLike: Array<[string, string, string]> = [
    ['income.gross', 'textbox', 'Before taxes'],
    ['person.age', 'textbox', 'Your age today'],
    ['cash.apy', 'textbox', 'Annual yield'],
    ['income.frequency', 'combobox', 'How often you are paid'],
    ['person.state', 'combobox', 'Where you file'],
    ['person.nickname', 'textbox', 'Optional'],
  ];

  it.each(textLike)('%s links its label and help', (path, role, help) => {
    const field = spec(path);
    renderField(field);
    const control = screen.getByRole(role, { name: new RegExp(`^${field.label}`) });
    expect(control).toHaveAccessibleDescription(help);
  });

  it.each(textLike)('%s links its error and marks it invalid', (path, role) => {
    const field = spec(path);
    renderField(field, { error: 'Enter a value between 1 and 2.' });
    const control = screen.getByRole(role, { name: new RegExp(`^${field.label}`) });
    expect(control).toHaveAccessibleDescription(expect.stringContaining('Enter a value between 1 and 2.'));
    expect(control).toHaveAttribute('aria-invalid', 'true');
  });

  it('choice renders a named radiogroup with help, then error', () => {
    const { unmount } = renderField(spec('person.filingStatus'));
    const group = screen.getByRole('radiogroup', { name: 'Filing status' });
    expect(group).toHaveAccessibleDescription('From your last return');
    expect(screen.getByRole('radio', { name: /^Single/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    unmount();
    renderField(spec('person.filingStatus'), { error: 'Choose one of the listed options.' });
    expect(screen.getByRole('radiogroup', { name: 'Filing status' })).toHaveAccessibleDescription(
      'Choose one of the listed options.'
    );
  });

  it('boolean renders a checkbox on the calculator with help, then error', () => {
    const { unmount } = renderField(spec('workplace.has401k'));
    const box = screen.getByRole('checkbox', { name: 'My employer offers a 401(k)' });
    expect(box).toBeChecked();
    expect(box).toHaveAccessibleDescription('Check your benefits portal');
    unmount();
    renderField(spec('workplace.has401k'), { error: 'Choose yes or no.' });
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription('Choose yes or no.');
  });

  it('slider names its thumb and shows help, the formatted readout and the error', () => {
    const { unmount } = renderField(spec('assumptions.multiplier'));
    expect(screen.getByRole('slider', { name: 'Healthcare multiplier' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('Relative to the average cost')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1x');
    unmount();
    renderField(spec('assumptions.multiplier'), { error: 'Too high.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Too high.');
  });

  it('list renders a named region and custom renders through the renderers prop', () => {
    renderField(spec('debts'));
    expect(screen.getByRole('region', { name: 'Debts' })).toBeInTheDocument();
    renderField(spec('portfolio.holdings'));
    expect(screen.getByText('Custom holdings: VTI')).toBeInTheDocument();
  });

  it('custom without a matching renderer renders nothing', () => {
    const { container } = render(
      <FieldInput spec={spec('portfolio.holdings')} get={makeGet(KIND_VALUES)} onWrite={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('uses ids derived from the prefix and path', () => {
    renderField(spec('person.age'));
    expect(fieldElementId('t', 'debts.0.balance')).toBe('t-debts-0-balance');
    expect(screen.getByRole('textbox', { name: /^Age/ })).toHaveAttribute('id', 'input-t-person-age');
  });
});

describe('FieldInput: writes', () => {
  it('money writes the typed number at its path', async () => {
    const user = userEvent.setup();
    const onWrites = vi.fn();
    render(
      <Harness initial={KIND_VALUES} onWrites={onWrites}>
        {({ get, onWrite }) => <FieldInput spec={spec('income.gross')} get={get} onWrite={onWrite} />}
      </Harness>
    );
    const input = screen.getByRole('textbox', { name: /Gross pay/ });
    await user.clear(input);
    await user.type(input, '4200');
    expect(onWrites).toHaveBeenLastCalledWith([{ path: 'income.gross', value: 4200 }]);
  });

  it('select writes the option value, not the string', async () => {
    const user = userEvent.setup();
    const numeric: FieldSpec = {
      path: 'cash.targetMonths',
      kind: 'select',
      label: 'Months',
      tier: 'details',
      options: [
        { value: 3, label: 'Three' },
        { value: 6, label: 'Six' },
      ],
    };
    const { onWrite } = renderField(numeric, { values: { cash: { targetMonths: 3 } } });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Months' }), 'Six');
    expect(onWrite).toHaveBeenCalledWith([{ path: 'cash.targetMonths', value: 6 }]);
  });

  it('choice writes on click; Enter selects and advances', async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn();
    const onWrite = vi.fn();
    render(
      <FieldInput
        spec={spec('person.filingStatus')}
        get={makeGet(KIND_VALUES)}
        onWrite={onWrite}
        onChooseAndAdvance={onAdvance}
      />
    );
    await user.click(screen.getByRole('radio', { name: /Head of household/ }));
    expect(onWrite).toHaveBeenCalledWith([{ path: 'person.filingStatus', value: 'headOfHousehold' }]);
    screen.getByRole('radio', { name: /Married/ }).focus();
    await user.keyboard('{Enter}');
    expect(onAdvance).toHaveBeenCalledWith('marriedJoint');
  });

  it('boolean writes the checked state; lg renders Yes/No choice cards', async () => {
    const user = userEvent.setup();
    const { onWrite, unmount } = renderField(spec('workplace.has401k'));
    await user.click(screen.getByRole('checkbox'));
    expect(onWrite).toHaveBeenCalledWith([{ path: 'workplace.has401k', value: false }]);
    unmount();
    const lg = renderField(spec('workplace.has401k'), { size: 'lg' });
    expect(screen.getByRole('radiogroup', { name: 'My employer offers a 401(k)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Yes' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'No' }));
    expect(lg.onWrite).toHaveBeenCalledWith([{ path: 'workplace.has401k', value: false }]);
  });

  it('text writes the typed string', async () => {
    const user = userEvent.setup();
    const onWrites = vi.fn();
    render(
      <Harness initial={KIND_VALUES} onWrites={onWrites}>
        {({ get, onWrite }) => <FieldInput spec={spec('person.nickname')} get={get} onWrite={onWrite} />}
      </Harness>
    );
    await user.type(screen.getByRole('textbox', { name: 'Nickname' }), '!');
    expect(onWrites).toHaveBeenLastCalledWith([{ path: 'person.nickname', value: 'Bufo!' }]);
  });

  it('state writes a picked code and ignores the blank reported while typing', async () => {
    const user = userEvent.setup();
    const { onWrite } = renderField(spec('person.state'));
    const input = screen.getByRole('combobox', { name: 'State' });
    await user.click(input);
    await user.type(input, 'zz');
    expect(onWrite).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, 'Ohio');
    expect(onWrite).toHaveBeenCalledWith([{ path: 'person.state', value: 'OH' }]);
  });

  it('appends coupled writes from spec.onChange', async () => {
    const user = userEvent.setup();
    const coupled: FieldSpec = {
      ...spec('workplace.has401k'),
      onChange: (value) => (value ? [] : [{ path: 'workplace.contributionPercent', value: 0 }]),
    };
    const { onWrite } = renderField(coupled);
    await user.click(screen.getByRole('checkbox'));
    expect(onWrite).toHaveBeenCalledWith([
      { path: 'workplace.has401k', value: false },
      { path: 'workplace.contributionPercent', value: 0 },
    ]);
    expect(fieldWrites(coupled, true, makeGet({}))).toEqual([{ path: 'workplace.has401k', value: true }]);
  });

  it('custom renderers write through onWrite', async () => {
    const user = userEvent.setup();
    const { onWrite } = renderField(spec('portfolio.holdings'));
    await user.click(screen.getByRole('button', { name: 'Add BND' }));
    expect(onWrite).toHaveBeenCalledWith([{ path: 'portfolio.holdings', value: ['VTI', 'BND'] }]);
  });
});

describe('FieldInput: visibility, hints, nullable and size', () => {
  it('renders nothing when visibleWhen is false and appears when it turns true', async () => {
    const user = userEvent.setup();
    const match: FieldSpec = {
      path: 'workplace.matchPercent',
      kind: 'percent',
      label: 'Employer match',
      tier: 'details',
      visibleWhen: (get) => get('workplace.has401k') === true,
    };
    render(
      <Harness initial={{ workplace: { has401k: false, matchPercent: 0.5 } }}>
        {({ get, onWrite }) => (
          <>
            <FieldInput spec={spec('workplace.has401k')} get={get} onWrite={onWrite} />
            <FieldInput spec={match} get={get} onWrite={onWrite} />
          </>
        )}
      </Harness>
    );
    expect(screen.queryByRole('textbox', { name: /Employer match/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('textbox', { name: /Employer match/ })).toHaveValue('50.0');
  });

  it('renders a hint as a LookupHint', () => {
    renderField(spec('income.gross'));
    expect(screen.getByText('Look at your pay stub')).toBeInTheDocument();
  });

  it('nullable: auto shows the derived label; override starts at the default; auto clears it', async () => {
    const user = userEvent.setup();
    const onWrites = vi.fn();
    const taxRate: FieldSpec = {
      path: 'assumptions.retirement.effectiveTaxRate',
      kind: 'percent',
      label: 'Effective tax rate',
      tier: 'assumption',
      max: 0.4,
      nullable: {
        autoLabel: (get) => `Estimated from ${String(get('person.state'))}`,
        overrideDefault: (get) => (get('person.state') === 'TX' ? 0.12 : 0.15),
      },
    };
    render(
      <Harness initial={{ person: { state: 'TX' }, assumptions: { retirement: { effectiveTaxRate: null } } }} onWrites={onWrites}>
        {({ get, onWrite }) => <FieldInput spec={taxRate} get={get} onWrite={onWrite} idPrefix="r" />}
      </Harness>
    );
    expect(screen.getByText('Estimated from TX')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const auto = screen.getByRole('checkbox', { name: /^Effective tax rate:\s*Use the automatic value$/ });
    expect(auto).toBeChecked();

    await user.click(auto);
    expect(onWrites).toHaveBeenLastCalledWith([{ path: 'assumptions.retirement.effectiveTaxRate', value: 0.12 }]);
    expect(screen.getByRole('textbox', { name: /Effective tax rate/ })).toHaveValue('12.0');
    expect(screen.getByRole('checkbox', { name: /Use the automatic value/ })).not.toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: /Use the automatic value/ }));
    expect(onWrites).toHaveBeenLastCalledWith([{ path: 'assumptions.retirement.effectiveTaxRate', value: null }]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('nullable with a static override default', async () => {
    const user = userEvent.setup();
    const years: FieldSpec = {
      path: 'leverage.years',
      kind: 'number',
      label: 'Years',
      tier: 'details',
      nullable: { autoLabel: 'Until retirement', overrideDefault: 20 },
    };
    const { onWrite } = renderField(years, { values: { leverage: { years: null } } });
    await user.click(screen.getByRole('checkbox'));
    expect(onWrite).toHaveBeenCalledWith([{ path: 'leverage.years', value: 20 }]);
  });

  it('size lg enlarges the primitives without descendant-selector hacks', () => {
    const field = spec('income.gross');
    const { unmount } = renderField(field, { size: 'lg' });
    const input = screen.getByRole('textbox', { name: /Gross pay/ });
    expect(input.className).toContain('h-14');
    expect(input.className).toContain('text-2xl');
    expect(screen.getByText('Gross pay').className).toContain('text-base');
    unmount();

    renderField(spec('income.frequency'), { size: 'lg' });
    expect(screen.getByRole('combobox', { name: 'Pay frequency' }).className).toContain('h-14');
  });

  it('size lg applies to number, percent, state and text', () => {
    for (const path of ['person.age', 'cash.apy', 'person.nickname']) {
      const { unmount } = renderField(spec(path), { size: 'lg' });
      expect(screen.getByRole('textbox').className).toContain('h-14');
      unmount();
    }
    renderField(spec('person.state'), { size: 'lg' });
    expect(screen.getByRole('combobox', { name: 'State' }).className).toContain('h-14');
  });

  it('size md keeps the calculator sizes', () => {
    renderField(spec('income.gross'));
    expect(screen.getByRole('textbox', { name: /Gross pay/ }).className).toContain('h-10');
  });
});
