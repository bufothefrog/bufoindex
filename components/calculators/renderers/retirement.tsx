/**
 * The retirement form's custom renderers, by renderer id (FieldSpec.renderer,
 * rowAdornment and footer), and its intake hooks. The one custom renderer is
 * the Social Security claiming-age control of the calculator page: three
 * choices and the yearly benefit at each. The wizard and the calculator page
 * pick these up through RENDERERS in ./index.ts.
 */

import React, { useId } from 'react';
import type { CustomRendererProps, CustomRenderers } from '@/components/fields/types';
import { FieldMessages, fieldMessageIds } from '@/components/ui/FieldMessages';
import { DataTable, type DataTableColumn } from '@/components/ui/results';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { calculatorHref } from '@/lib/calculators/registry';
import {
  CLAIMING_AGE_CHOICES,
  claimingAgeBenefits,
  nearestClaimingAge,
  offListClaimingAgeNote,
  type ClaimingAgeBenefit,
} from '@/lib/calculators/retirement/claiming';
import { CLAIMING_AGE_RENDERER } from '@/lib/calculators/retirement/fields';
import { isSocialSecurityAuto, resolveSocialSecurityBenefit } from '@/lib/calculators/retirement/socialSecurity';
import type { FinancialProfile } from '@/lib/profile/types';
import { retirementRunner } from '@/lib/store/retirementStore';

const CLAIMING_OPTIONS = CLAIMING_AGE_CHOICES.map(({ age, label }) => ({ value: String(age), label }));

const BENEFIT_COLUMNS: readonly DataTableColumn<ClaimingAgeBenefit>[] = [
  { id: 'age', header: 'Claiming age', rowHeader: true, cell: (row) => row.label },
  { id: 'benefit', header: 'Yearly benefit', numeric: true, value: (row) => row.yearlyBenefit, format: 'currency' },
];

/**
 * The claiming-age control: the stored age shows as the nearest of the three
 * choices (nothing is written until the visitor picks one; a note under the
 * control names the stored age the run uses meanwhile), and the table
 * shows the yearly benefit at each age from the benefit in use (the entered
 * one, or the estimate from pay on Auto), through the engine's claiming-age
 * adjustment.
 */
function ClaimingAgeControl({ spec, get, onWrite, error }: CustomRendererProps) {
  const id = useId();
  const stored = get(spec.path);
  const shown = String(nearestClaimingAge(stored));
  const note = offListClaimingAgeNote(stored) ?? undefined;
  const { describedBy } = fieldMessageIds(id, note, error);
  const rows = claimingAgeBenefits(resolveSocialSecurityBenefit(get));
  const caption = isSocialSecurityAuto(get)
    ? 'Estimated yearly Social Security benefit at each claiming age'
    : 'Yearly Social Security benefit at each claiming age';
  return (
    <div className="space-y-3" data-testid="claiming-age">
      <SegmentedControl
        label={spec.label}
        options={CLAIMING_OPTIONS}
        value={shown}
        onChange={(value) => onWrite([{ path: spec.path, value: Number(value) }])}
        size="md"
        fullWidth
        describedBy={describedBy}
      />
      <FieldMessages id={id} help={note} error={error} />
      <DataTable
        caption={caption}
        columns={BENEFIT_COLUMNS}
        rows={rows}
        rowKey={(row) => String(row.age)}
        framed
      />
    </div>
  );
}

export const RETIREMENT_RENDERERS: CustomRenderers = {
  [CLAIMING_AGE_RENDERER]: ClaimingAgeControl,
};

/**
 * Called once while the visitor answers the retirement intake, when the
 * browser is idle (audit H5): starts the retirement worker, so the first run
 * on the calculator does not wait for it to load.
 */
export const RETIREMENT_INTAKE_PREWARM = (): void => retirementRunner.prewarm();

/** Where the retirement intake leads once finished: the calculator, which reads the saved profile. */
export const RETIREMENT_INTAKE_DESTINATION: (profile: FinancialProfile) => string = () =>
  calculatorHref('retirement', { fromProfile: true });
