import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the store before importing the component so the component picks up the mock.
const setSetupMode = vi.fn();
const setWizardStep = vi.fn();
const completeWizard = vi.fn();

let storeState: {
  wizardStep: 'mode' | 'targets-style' | 'done';
  setSetupMode: typeof setSetupMode;
  setWizardStep: typeof setWizardStep;
  completeWizard: typeof completeWizard;
};

vi.mock('@/lib/store/portfolioRebalancingStore', () => ({
  usePortfolioRebalancingStore: <T,>(selector: (s: typeof storeState) => T): T =>
    selector(storeState),
}));

import { SetupWizard } from '@/app/tools/portfolio-rebalancing-calculator/components/SetupWizard';

describe('SetupWizard', () => {
  beforeEach(() => {
    setSetupMode.mockClear();
    setWizardStep.mockClear();
    completeWizard.mockClear();
    storeState = {
      wizardStep: 'mode',
      setSetupMode,
      setWizardStep,
      completeWizard,
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('renders step 1 by default with both options', () => {
    render(<SetupWizard />);
    expect(screen.getByTestId('setup-wizard')).toBeTruthy();
    expect(screen.getByTestId('wizard-option-single')).toBeTruthy();
    expect(screen.getByTestId('wizard-option-multi')).toBeTruthy();
  });

  it('clicking "One account" sets single mode and completes the wizard', () => {
    render(<SetupWizard />);
    fireEvent.click(screen.getByTestId('wizard-option-single'));
    expect(setSetupMode).toHaveBeenCalledWith('single');
    expect(completeWizard).toHaveBeenCalledTimes(1);
    expect(setWizardStep).not.toHaveBeenCalled();
  });

  it('clicking "Multiple accounts" advances to step 2', () => {
    render(<SetupWizard />);
    fireEvent.click(screen.getByTestId('wizard-option-multi'));
    expect(setWizardStep).toHaveBeenCalledWith('targets-style');
    expect(setSetupMode).not.toHaveBeenCalled();
    expect(completeWizard).not.toHaveBeenCalled();
  });

  it('step 2 renders shared/unique options and a back button', () => {
    storeState = { ...storeState, wizardStep: 'targets-style' };
    render(<SetupWizard />);
    expect(screen.getByTestId('wizard-option-multi-shared')).toBeTruthy();
    expect(screen.getByTestId('wizard-option-multi-unique')).toBeTruthy();
    expect(screen.getByTestId('wizard-back')).toBeTruthy();
  });

  it('step 2 "Back" returns to step 1', () => {
    storeState = { ...storeState, wizardStep: 'targets-style' };
    render(<SetupWizard />);
    fireEvent.click(screen.getByTestId('wizard-back'));
    expect(setWizardStep).toHaveBeenCalledWith('mode');
  });

  it('step 2 "Same split" selects multi-shared', () => {
    storeState = { ...storeState, wizardStep: 'targets-style' };
    render(<SetupWizard />);
    fireEvent.click(screen.getByTestId('wizard-option-multi-shared'));
    expect(setSetupMode).toHaveBeenCalledWith('multi-shared');
    expect(completeWizard).toHaveBeenCalledTimes(1);
  });

  it('step 2 "Different split" selects multi-unique', () => {
    storeState = { ...storeState, wizardStep: 'targets-style' };
    render(<SetupWizard />);
    fireEvent.click(screen.getByTestId('wizard-option-multi-unique'));
    expect(setSetupMode).toHaveBeenCalledWith('multi-unique');
    expect(completeWizard).toHaveBeenCalledTimes(1);
  });
});
