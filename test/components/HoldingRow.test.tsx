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

const other: Security = {
  id: 'sec2',
  ticker: 'BND',
  price: 75,
  assetClass: 'bonds',
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

const noops = {
  onChangeHolding: vi.fn(),
  onChangeSecurity: vi.fn(),
  onSelectSecurity: vi.fn(),
  onCommitTicker: vi.fn(),
  onRemove: vi.fn(),
};

describe('HoldingRow', () => {
  afterEach(() => {
    cleanup();
    Object.values(noops).forEach(fn => fn.mockClear());
  });

  it('renders ticker, price, asset class, and shares inline', () => {
    render(
      <HoldingRow
        holding={makeHolding()}
        security={security}
        securities={[security, other]}
        index={0}
        canRemove
        {...noops}
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

  it('commits a new ticker on blur', () => {
    const onCommitTicker = vi.fn();
    render(
      <HoldingRow
        holding={makeHolding()}
        security={security}
        securities={[security, other]}
        index={0}
        canRemove
        {...noops}
        onCommitTicker={onCommitTicker}
      />,
    );
    const ticker = screen.getByTestId('holding-ticker-0') as HTMLInputElement;
    fireEvent.focus(ticker);
    fireEvent.change(ticker, { target: { value: 'voo' } });
    fireEvent.blur(ticker);
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(onCommitTicker).toHaveBeenCalledWith('VOO');
        resolve();
      }, 150);
    });
  });

  it('swaps to an existing security when the user types an existing ticker', () => {
    const onSelectSecurity = vi.fn();
    render(
      <HoldingRow
        holding={makeHolding()}
        security={security}
        securities={[security, other]}
        index={0}
        canRemove
        {...noops}
        onSelectSecurity={onSelectSecurity}
      />,
    );
    const ticker = screen.getByTestId('holding-ticker-0') as HTMLInputElement;
    fireEvent.focus(ticker);
    fireEvent.change(ticker, { target: { value: 'bnd' } });
    fireEvent.blur(ticker);
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(onSelectSecurity).toHaveBeenCalledWith('sec2');
        resolve();
      }, 150);
    });
  });

  it('selects an existing security when user clicks a dropdown option', () => {
    const onSelectSecurity = vi.fn();
    render(
      <HoldingRow
        holding={makeHolding()}
        security={security}
        securities={[security, other]}
        index={0}
        canRemove
        {...noops}
        onSelectSecurity={onSelectSecurity}
      />,
    );
    const ticker = screen.getByTestId('holding-ticker-0') as HTMLInputElement;
    fireEvent.focus(ticker);
    fireEvent.mouseDown(screen.getByTestId('ticker-option-bnd'));
    expect(onSelectSecurity).toHaveBeenCalledWith('sec2');
  });

  it('emits price and asset-class updates to the paired security', () => {
    const onChangeSecurity = vi.fn();
    render(
      <HoldingRow
        holding={makeHolding()}
        security={security}
        securities={[security]}
        index={0}
        canRemove
        {...noops}
        onChangeSecurity={onChangeSecurity}
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
        securities={[security]}
        index={0}
        canRemove
        {...noops}
        onChangeHolding={onChangeHolding}
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
        securities={[security]}
        index={3}
        canRemove
        {...noops}
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
        securities={[security]}
        index={0}
        canRemove={false}
        {...noops}
      />,
    );
    expect(screen.getByTestId('holding-remove-0')).toBeDisabled();
  });

  it('renders the ticker/price/total preview when security and shares are present', () => {
    render(
      <HoldingRow
        holding={makeHolding({ shares: 4 })}
        security={security}
        securities={[security]}
        index={0}
        canRemove
        {...noops}
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
        securities={[]}
        index={0}
        canRemove
        {...noops}
      />,
    );
    expect((screen.getByTestId('holding-ticker-0') as HTMLInputElement).value).toBe('');
    expect(inputIn('holding-price-0').value).toBe('');
    expect(screen.queryByTestId('holding-preview-0')).toBeNull();
  });
});
