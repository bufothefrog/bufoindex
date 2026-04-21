import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AssetRow } from '@/app/tools/portfolio-rebalancing-calculator/components/AssetRow';
import {
  DEFAULT_ACCOUNT_TYPE,
  DEFAULT_ASSET_CLASS,
  RebalanceAsset,
} from '@/lib/calculations/portfolioRebalancing';

function makeAsset(overrides: Partial<RebalanceAsset> = {}): RebalanceAsset {
  return {
    id: 'a1',
    ticker: 'VTI',
    currentShares: 10,
    price: 250,
    targetAllocation: 0.6,
    accountType: DEFAULT_ACCOUNT_TYPE,
    assetClass: DEFAULT_ASSET_CLASS,
    ...overrides,
  };
}

function inputIn(testId: string): HTMLInputElement {
  const wrapper = screen.getByTestId(testId);
  const input = within(wrapper).getByRole('textbox') as HTMLInputElement;
  return input;
}

describe('AssetRow', () => {
  it('renders all four inputs with current values', () => {
    render(
      <AssetRow
        asset={makeAsset()}
        index={0}
        canRemove={true}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    const ticker = screen.getByTestId('ticker-0') as HTMLInputElement;
    expect(ticker.value).toBe('VTI');

    expect(inputIn('shares-0').value).toBe('10');
    expect(inputIn('price-0').value).toBe('250');
    expect(inputIn('target-0').value).toBe('60.0');
  });

  it('uppercases and emits ticker changes', () => {
    const onChange = vi.fn();
    render(
      <AssetRow
        asset={makeAsset({ ticker: '' })}
        index={0}
        canRemove={true}
        onChange={onChange}
        onRemove={vi.fn()}
      />
    );

    const ticker = screen.getByTestId('ticker-0') as HTMLInputElement;
    fireEvent.change(ticker, { target: { value: 'vxus' } });

    expect(onChange).toHaveBeenCalledWith({ ticker: 'VXUS' });
  });

  it('fires onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <AssetRow
        asset={makeAsset()}
        index={2}
        canRemove={true}
        onChange={vi.fn()}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByTestId('remove-2'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables the remove button when canRemove is false', () => {
    render(
      <AssetRow
        asset={makeAsset()}
        index={0}
        canRemove={false}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByTestId('remove-0')).toBeDisabled();
  });

  it('clamps target-percent input to the 0–100% range', () => {
    const onChange = vi.fn();
    render(
      <AssetRow
        asset={makeAsset({ targetAllocation: 0.5 })}
        index={0}
        canRemove={true}
        onChange={onChange}
        onRemove={vi.fn()}
      />
    );

    const target = inputIn('target-0');

    fireEvent.change(target, { target: { value: '150' } });
    const sawOverflow = onChange.mock.calls.some(([update]) =>
      typeof update?.targetAllocation === 'number' && update.targetAllocation > 1
    );
    expect(sawOverflow).toBe(false);

    fireEvent.change(target, { target: { value: '40' } });
    expect(onChange).toHaveBeenCalledWith({ targetAllocation: 0.4 });
  });

  it('emits numeric updates for shares and price', () => {
    const onChange = vi.fn();
    render(
      <AssetRow
        asset={makeAsset()}
        index={0}
        canRemove={true}
        onChange={onChange}
        onRemove={vi.fn()}
      />
    );

    fireEvent.change(inputIn('shares-0'), { target: { value: '15' } });
    expect(onChange).toHaveBeenCalledWith({ currentShares: 15 });

    fireEvent.change(inputIn('price-0'), { target: { value: '300' } });
    expect(onChange).toHaveBeenCalledWith({ price: 300 });
  });
});
