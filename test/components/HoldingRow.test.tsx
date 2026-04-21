import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HoldingRow } from '@/app/tools/portfolio-rebalancing-calculator/components/HoldingRow';
import { Account, Holding, Security } from '@/lib/calculations/portfolioRebalancing';

const account1: Account = {
  id: 'acc1',
  name: 'Fidelity Roth',
  accountType: 'tax-free',
  deposit: 0,
};
const account2: Account = {
  id: 'acc2',
  name: 'Taxable Brokerage',
  accountType: 'taxable',
  deposit: 0,
};

const security1: Security = {
  id: 'sec1',
  ticker: 'VTI',
  price: 250,
  assetClass: 'us-stock',
};
const security2: Security = {
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

describe('HoldingRow', () => {
  afterEach(() => cleanup());

  it('renders security dropdown and shares input', () => {
    render(
      <HoldingRow
        holding={makeHolding()}
        index={0}
        accounts={[account1, account2]}
        securities={[security1, security2]}
        showAccountSelector={true}
        canRemove={true}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    const securitySelect = within(screen.getByTestId('holding-security-0')).getByRole(
      'combobox'
    ) as HTMLSelectElement;
    expect(securitySelect.value).toBe('sec1');
    expect(inputIn('holding-shares-0').value).toBe('10');
  });

  it('shows the account selector by default and reflects current value', () => {
    render(
      <HoldingRow
        holding={makeHolding({ accountId: 'acc2' })}
        index={0}
        accounts={[account1, account2]}
        securities={[security1]}
        showAccountSelector={true}
        canRemove={true}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    const accountWrapper = screen.getByTestId('holding-account-0');
    const select = within(accountWrapper).getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('acc2');
  });

  it('hides the account selector when showAccountSelector is false', () => {
    render(
      <HoldingRow
        holding={makeHolding()}
        index={0}
        accounts={[account1]}
        securities={[security1]}
        showAccountSelector={false}
        canRemove={true}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.queryByTestId('holding-account-0')).toBeNull();
  });

  it('emits shares updates', () => {
    const onChange = vi.fn();
    render(
      <HoldingRow
        holding={makeHolding()}
        index={0}
        accounts={[account1]}
        securities={[security1]}
        showAccountSelector={true}
        canRemove={true}
        onChange={onChange}
        onRemove={vi.fn()}
      />
    );
    fireEvent.change(inputIn('holding-shares-0'), { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith({ shares: 42 });
  });

  it('emits account and security changes', () => {
    const onChange = vi.fn();
    render(
      <HoldingRow
        holding={makeHolding()}
        index={0}
        accounts={[account1, account2]}
        securities={[security1, security2]}
        showAccountSelector={true}
        canRemove={true}
        onChange={onChange}
        onRemove={vi.fn()}
      />
    );

    const accSelect = within(screen.getByTestId('holding-account-0')).getByRole(
      'combobox'
    ) as HTMLSelectElement;
    fireEvent.change(accSelect, { target: { value: 'acc2' } });
    expect(onChange).toHaveBeenCalledWith({ accountId: 'acc2' });

    const secSelect = within(screen.getByTestId('holding-security-0')).getByRole(
      'combobox'
    ) as HTMLSelectElement;
    fireEvent.change(secSelect, { target: { value: 'sec2' } });
    expect(onChange).toHaveBeenCalledWith({ securityId: 'sec2' });
  });

  it('fires onRemove when remove button clicked', () => {
    const onRemove = vi.fn();
    render(
      <HoldingRow
        holding={makeHolding()}
        index={3}
        accounts={[account1]}
        securities={[security1]}
        showAccountSelector={true}
        canRemove={true}
        onChange={vi.fn()}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByTestId('holding-remove-3'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables the remove button when canRemove is false', () => {
    render(
      <HoldingRow
        holding={makeHolding()}
        index={0}
        accounts={[account1]}
        securities={[security1]}
        showAccountSelector={true}
        canRemove={false}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByTestId('holding-remove-0')).toBeDisabled();
  });

  it('renders the ticker/price/total preview when security and shares are present', () => {
    render(
      <HoldingRow
        holding={makeHolding({ shares: 4 })}
        index={0}
        accounts={[account1]}
        securities={[security1]}
        showAccountSelector={true}
        canRemove={true}
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    const preview = screen.getByTestId('holding-preview-0');
    expect(preview.textContent).toContain('VTI');
    expect(preview.textContent).toContain('1,000'); // 250 * 4
  });
});
