'use client';

/**
 * FieldInput
 * Renders one FieldSpec with the matching input primitive (docs/rebuild-plan.md
 * section 2.10) and reports each edit as Write[]: the field itself first,
 * then the spec's coupled writes (spec.onChange).
 *
 * | kind    | primitive                                                    |
 * |---------|--------------------------------------------------------------|
 * | money   | MoneyInput                                                   |
 * | number  | NumberInput                                                  |
 * | percent | PercentInput (with its slider when spec.slider)              |
 * | slider  | SliderField                                                  |
 * | select  | SelectInput                                                  |
 * | choice  | ChoiceGroup (two columns from md on the calculator; lg stack)|
 * | boolean | Checkbox (md); Yes/No ChoiceGroup (lg, the wizard)           |
 * | state   | StateSelector                                                |
 * | text    | BaseInput around a text input                                |
 * | list    | FieldList                                                    |
 * | custom  | renderers[spec.renderer ?? spec.path]                        |
 *
 * Nullable fields are wrapped in NullableField; a hint renders as LookupHint.
 */

import React from 'react';
import { BaseInput, MoneyInput, NumberInput, PercentInput, SliderField, type InputSize } from '@/components/ui/inputs';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { Checkbox } from '@/components/ui/checkbox';
import { LookupHint } from '@/components/shared/LookupHint';
import {
  formatFieldNumber,
  isFieldVisible,
  resolveOptions,
  resolveOverrideDefault,
  resolveText,
} from '@/lib/fields/runtime';
import type { FieldErrors, FieldOption, FieldOptionValue, FieldSpec, Get, Write } from '@/lib/fields/types';
import { ChoiceGroup } from './ChoiceGroup';
import { FieldList } from './FieldList';
import { NullableField } from './NullableField';
import type { CustomRenderers, FieldSize } from './types';

export interface FieldInputProps {
  spec: FieldSpec;
  get: Get;
  onWrite: (writes: Write[]) => void;
  /** The error keyed by spec.path. */
  error?: string;
  /** Every error the caller holds; lists and custom renderers read row errors from it. */
  errors?: FieldErrors;
  size?: FieldSize;
  /**
   * Visually hide the label where the field owns it (choice, boolean, slider,
   * list). Text-like primitives always show their label.
   */
  hideLabel?: boolean;
  renderers?: CustomRenderers;
  /** Enter on a choice (or a lg boolean) selects and advances. */
  onChooseAndAdvance?: (value: FieldOption['value']) => void;
  /** Prefix for element ids, unique per rendered form (default 'field'). */
  idPrefix?: string;
}

const YES_NO: readonly FieldOption[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

/** A DOM-safe id for a field path under a prefix ('retirement', 'debts.0.balance' -> 'retirement-debts-0-balance'). */
export function fieldElementId(idPrefix: string, path: string): string {
  return `${idPrefix}-${path.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

/** The writes for one edit: the field, then its coupled writes. */
export function fieldWrites(spec: FieldSpec, value: unknown, get: Get): Write[] {
  return [{ path: spec.path, value }, ...(spec.onChange?.(value, get) ?? [])];
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function primitiveSize(size: FieldSize): Exclude<InputSize, 'sm'> {
  return size === 'lg' ? 'xl' : 'md';
}

interface ControlProps extends Required<Pick<FieldInputProps, 'spec' | 'get' | 'onWrite' | 'size' | 'idPrefix'>> {
  value: unknown;
  id: string;
  help?: string;
  error?: string;
  errors?: FieldErrors;
  hideLabel: boolean;
  renderers?: CustomRenderers;
  onChooseAndAdvance?: (value: FieldOptionValue) => void;
  write: (value: unknown) => void;
}

function FieldControl({
  spec,
  get,
  onWrite,
  size,
  idPrefix,
  value,
  id,
  help,
  error,
  errors,
  hideLabel,
  renderers,
  onChooseAndAdvance,
  write,
}: ControlProps): React.ReactNode {
  const sized = primitiveSize(size);
  const common = { name: id, label: spec.label, help, error, required: spec.required, testId: spec.testId };

  switch (spec.kind) {
    case 'money':
      return (
        <MoneyInput
          {...common}
          value={asNumber(value)}
          onChange={write}
          min={spec.min ?? 0}
          max={spec.max}
          placeholder={spec.placeholder}
          size={sized}
        />
      );
    case 'number': {
      const allowDecimals = (spec.precision ?? 0) > 0 || (spec.step !== undefined && !Number.isInteger(spec.step));
      return (
        <NumberInput
          {...common}
          value={asNumber(value)}
          onChange={write}
          min={spec.min}
          max={spec.max}
          step={spec.step ?? 1}
          allowDecimals={allowDecimals}
          precision={spec.precision}
          prefix={spec.unit?.prefix}
          suffix={spec.unit?.suffix}
          placeholder={spec.placeholder}
          textAlign={size === 'lg' ? 'left' : 'right'}
          size={sized}
        />
      );
    }
    case 'percent':
      return (
        <PercentInput
          {...common}
          value={asNumber(value)}
          onChange={write}
          min={spec.min ?? 0}
          max={spec.max ?? 1}
          step={spec.step}
          precision={spec.precision ?? 1}
          placeholder={spec.placeholder}
          showSlider={spec.slider}
          size={sized}
        />
      );
    case 'slider':
      return (
        <SliderField
          {...common}
          value={asNumber(value)}
          onChange={write}
          min={spec.min ?? 0}
          max={spec.max ?? 100}
          step={spec.step}
          format={(n) => formatFieldNumber(spec, n)}
          hideLabel={hideLabel}
          size={sized}
        />
      );
    case 'select': {
      const options = resolveOptions(spec, get);
      return (
        <SelectInput
          {...common}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(raw) => {
            const option = options.find((candidate) => String(candidate.value) === raw);
            write(option ? option.value : raw);
          }}
          options={options.map((option) => ({ value: String(option.value), label: option.label }))}
          placeholder={spec.placeholder}
          size={sized}
        />
      );
    }
    case 'choice':
      return (
        <ChoiceGroup
          id={id}
          label={spec.label}
          options={resolveOptions(spec, get)}
          value={value}
          onChange={write}
          onChooseAndAdvance={onChooseAndAdvance}
          hideLabel={hideLabel}
          help={help}
          error={error}
          layout={size === 'lg' ? 'stack' : 'grid'}
          size={size}
          testId={spec.testId}
        />
      );
    case 'boolean': {
      if (size === 'lg') {
        const options = resolveOptions(spec, get);
        return (
          <ChoiceGroup
            id={id}
            label={spec.label}
            options={options.length > 0 ? options : YES_NO}
            value={value}
            onChange={write}
            onChooseAndAdvance={onChooseAndAdvance}
            hideLabel={hideLabel}
            help={help}
            error={error}
            size={size}
            testId={spec.testId}
          />
        );
      }
      return (
        <Checkbox
          id={id}
          name={id}
          label={spec.label}
          checked={value === true}
          onCheckedChange={write}
          help={help}
          error={error}
          hideLabel={hideLabel}
          testId={spec.testId}
        />
      );
    }
    case 'state':
      return (
        <div data-testid={spec.testId}>
          <StateSelector
            name={id}
            label={spec.label}
            value={asString(value)}
            // The combobox reports '' while the typed text matches no state;
            // keep the last valid code instead of writing a blank.
            onChange={(code) => {
              if (code) write(code);
            }}
            help={help}
            error={error}
            required={spec.required}
            placeholder={spec.placeholder}
            size={size === 'lg' ? 'xl' : 'md'}
          />
        </div>
      );
    case 'text':
      return (
        <BaseInput {...common} size={sized}>
          <div className="relative w-full">
            <input
              type="text"
              value={asString(value)}
              onChange={(event) => write(event.target.value)}
              maxLength={spec.maxLength}
              placeholder={spec.placeholder}
              className={size === 'lg' ? 'h-14 px-3 text-lg' : 'h-10 px-3'}
            />
          </div>
        </BaseInput>
      );
    case 'list':
      return (
        <FieldList
          spec={spec}
          get={get}
          onWrite={onWrite}
          errors={errors ?? {}}
          renderers={renderers}
          size={size}
          idPrefix={idPrefix}
          hideLabel={hideLabel}
        />
      );
    case 'custom': {
      const renderer = renderers?.[spec.renderer ?? spec.path];
      if (!renderer) return null;
      return React.createElement(renderer, { spec, get, value, onWrite, error, errors, size, idPrefix });
    }
  }
}

export function FieldInput({
  spec,
  get,
  onWrite,
  error,
  errors,
  size = 'md',
  hideLabel = false,
  renderers,
  onChooseAndAdvance,
  idPrefix = 'field',
}: FieldInputProps) {
  if (!isFieldVisible(spec, get)) return null;

  const value = get(spec.path);
  const id = fieldElementId(idPrefix, spec.path);
  const help = resolveText(spec.help, get);
  const hint = resolveText(spec.hint, get);
  const write = (next: unknown) => onWrite(fieldWrites(spec, next, get));
  const isAuto = spec.nullable !== undefined && value === null;

  const control = isAuto ? null : (
    <FieldControl
      spec={spec}
      get={get}
      onWrite={onWrite}
      size={size}
      idPrefix={idPrefix}
      value={value}
      id={id}
      help={help}
      error={error}
      errors={errors}
      hideLabel={hideLabel}
      renderers={renderers}
      onChooseAndAdvance={onChooseAndAdvance}
      write={write}
    />
  );

  const body = spec.nullable ? (
    <NullableField
      id={id}
      label={spec.label}
      autoLabel={resolveText(spec.nullable.autoLabel, get)}
      isAuto={isAuto}
      onAutoChange={(auto) => write(auto ? null : (resolveOverrideDefault(spec, get) ?? 0))}
      size={size}
    >
      {control}
    </NullableField>
  ) : (
    control
  );

  if (!hint) return body;
  return (
    <div className="space-y-2">
      {body}
      <LookupHint>{hint}</LookupHint>
    </div>
  );
}

export default FieldInput;
