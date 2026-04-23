import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HoldingRow } from '@/app/tools/portfolio-rebalancing-calculator/components/HoldingRow';
import { Holding, Security } from '@/lib/calculations/portfolioRebalancing';

const security: Security = {
  id: 'sec1',
  ticker: 'VTI',
  price: 250,
  assetClass: 'us-stock',
};

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: 'h1',
    accountId: 'acc1',
    securityId: 'sec1',
    shares: 10,
    ...overrides,
  };
}

function inputIn(testId: string): HTMLInputElement {
  const wrapper = screen.getByTestId(testId);
  return within(wrapper).getByRole('textbox') as HTMLInputElement;
}

describe('HoldingRow', () => {
  afterEach(() => cleanup());

  it('renders ticker, price, asset class, and shares inline', () => {
    render(
      <HoldingRow
        holding={makeHolding()}
        security={security}
        index={0}
        canRemove
        onChangeHolding={vi.fn()}
        onChangeSecurity={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect((screen.getByTestId('holding-ticker-0') as HTMLInputElement).value).toBe('VTI');
    expect(inputIn('holding-price-0').value).toBe('250');
    expect(inputIn('holding-shares-0').value).toBe('10');
    const classSelect = within(screen.getByTestId('holding-class-0')).getByRole(
      'combobox',
    ) as HTMLSelectElement;
    expect(classSelect.value).toBe('us-stock');
  });

  it('emits ticker updates to the paired security', () => {
    const onChangeSecurity = vi.fn();
    render(
      <HoldingRow
        holding={makeHolding()}
        security={security}
        index={0}
        canRemove
        onChangeHolding={vi.fn()}
        onChangeSecurity={onChangeSecurity}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('holding-ticker-0'), { target: { value: 'bnd' } });
    expect(onChangeSecurity).toHaveBeenCalledWith({ ticker: 'BND' });
  });

  it('emits price and asset-class updates to the paired security', () => {
    const onChangeSecurity = vi.fn();
    render(
      <HoldingRow
        holding={makeHolding()}
        security={security}
        index={0}
        canRemove
        onChangeHolding={vi.fn()}
        onChangeSecurity={onChangeSecurity}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.change(inputIn('holding-price-0'), { target: { value: '300' } });
    expect(onChangeSecurity).toHaveBeenCalledWith({ price: 300 });

    const classSelect = within(screen.getByTestId('holding-class-0')).getByRole(
      'combobox',
    ) as HTMLSelectElement;
    fireEvent.change(classSelect, { target: { value: 'bonds' } });
    expect(onChangeSecurity).toHaveBeenCalledWith({ assetClass: 'bonds' });
  });

  it('emits shares updates to the holding', () => {
    const onChangeHolding = vi.fn();
    render(
      <HoldingRow
        holding={makeHolding()}
        security={security}
        index={0}
        canRemove
        onChangeHolding={onChangeHolding}
        onChangeSecurity={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.change(inputIn('holding-shares-0'), { target: { value: '42' } });
    expect(onChangeHolding).toHaveBeenCalledWith({ shares: 42 });
  });

  it('fires onRemove when remove button clicked', () => {
    const onRemove = vi.fn();
    render(
      <HoldingRow
        holding={makeHolding()}
        security={security}
        index={3}
        canRemove
        onChangeHolding={vi.fn()}
        onChangeSecurity={vi.fn()}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByTestId('holding-remove-3'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables the remove button when canRemove is false', () => {
    render(
      <HoldingRow
        holding={makeHolding()}
        security={security}
        index={0}
        canRemove={false}
        onChangeHolding={vi.fn()}
        onChangeSecurity={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByTestId('holding-remove-0')).toBeDisabled();
  });

  it('renders the ticker/price/total preview when security and shares are present', () => {
    render(
      <HoldingRow
        holding={makeHolding({ shares: 4 })}
        security={security}
        index={0}
        canRemove
        onChangeHolding={vi.fn()}
        onChangeSecurity={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const preview = screen.getByTestId('holding-preview-0');
    expect(preview.textContent).toContain('VTI');
    expect(preview.textContent).toContain('1,000'); // 250 * 4
  });

  it('renders gracefully with a missing security', () => {
    render(
      <HoldingRow
        holding={makeHolding()}
        security={null}
        index={0}
        canRemove
        onChangeHolding={vi.fn()}
        onChangeSecurity={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect((screen.getByTestId('holding-ticker-0') as HTMLInputElement).value).toBe('');
    expect(inputIn('holding-price-0').value).toBe('');
    expect(screen.queryByTestId('holding-preview-0')).toBeNull();
  });
});
