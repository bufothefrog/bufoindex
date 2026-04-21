import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SecurityRow } from '@/app/tools/portfolio-rebalancing-calculator/components/SecurityRow';
import { Security } from '@/lib/calculations/portfolioRebalancing';

function makeSecurity(overrides: Partial<Security> = {}): Security {
  return {
    id: 's1',
    ticker: 'VTI',
    name: 'Vanguard Total US Stock',
    price: 250,
    assetClass: 'us-stock',
    ...overrides,
  };
}

function inputIn(testId: string): HTMLInputElement {
  const wrapper = screen.getByTestId(testId);
  return within(wrapper).getByRole('textbox') as HTMLInputElement;
}

describe('SecurityRow', () => {
  afterEach(() => cleanup());

  it('renders all four inputs with current values', () => {
    render(
      <SecurityRow
        security={makeSecurity()}
        index={0}
        canRemove={true}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect((screen.getByTestId('security-ticker-0') as HTMLInputElement).value).toBe('VTI');
    expect((screen.getByTestId('security-name-0') as HTMLInputElement).value).toBe(
      'Vanguard Total US Stock'
    );
    expect(inputIn('security-price-0').value).toBe('250');

    const classSelect = within(screen.getByTestId('security-class-0')).getByRole('combobox') as HTMLSelectElement;
    expect(classSelect.value).toBe('us-stock');
  });

  it('uppercases ticker input', () => {
    const onChange = vi.fn();
    render(
      <SecurityRow
        security={makeSecurity({ ticker: '' })}
        index={0}
        canRemove={true}
        onChange={onChange}
        onRemove={vi.fn()}
      />
    );

    const ticker = screen.getByTestId('security-ticker-0') as HTMLInputElement;
    fireEvent.change(ticker, { target: { value: 'vxus' } });
    expect(onChange).toHaveBeenCalledWith({ ticker: 'VXUS' });
  });

  it('emits numeric updates for price', () => {
    const onChange = vi.fn();
    render(
      <SecurityRow
        security={makeSecurity()}
        index={0}
        canRemove={true}
        onChange={onChange}
        onRemove={vi.fn()}
      />
    );

    fireEvent.change(inputIn('security-price-0'), { target: { value: '300' } });
    expect(onChange).toHaveBeenCalledWith({ price: 300 });
  });

  it('emits onChange with new assetClass', () => {
    const onChange = vi.fn();
    render(
      <SecurityRow
        security={makeSecurity({ assetClass: 'us-stock' })}
        index={0}
        canRemove={true}
        onChange={onChange}
        onRemove={vi.fn()}
      />
    );
    const select = within(screen.getByTestId('security-class-0')).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'bonds' } });
    expect(onChange).toHaveBeenCalledWith({ assetClass: 'bonds' });
  });

  it('emits optional name updates', () => {
    const onChange = vi.fn();
    render(
      <SecurityRow
        security={makeSecurity({ name: '' })}
        index={0}
        canRemove={true}
        onChange={onChange}
        onRemove={vi.fn()}
      />
    );
    const name = screen.getByTestId('security-name-0') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Vanguard' } });
    expect(onChange).toHaveBeenCalledWith({ name: 'Vanguard' });
  });

  it('fires onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <SecurityRow
        security={makeSecurity()}
        index={2}
        canRemove={true}
        onChange={vi.fn()}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByTestId('security-remove-2'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables the remove button when canRemove is false', () => {
    render(
      <SecurityRow
        security={makeSecurity()}
        index={0}
        canRemove={false}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByTestId('security-remove-0')).toBeDisabled();
  });
});
