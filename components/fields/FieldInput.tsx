'use client';

import React from 'react';
import { BaseInput, MoneyInput, NumberInput, PercentInput, SliderField } from '@/components/ui/inputs';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import type { InputSize } from '@/components/ui/inputs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { fieldMessageIds } from '@/components/ui/FieldMessages';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { LookupHint } from '@/components/shared/LookupHint';
import {
  fieldWrites,
  formatFieldValue,
  isFieldVisible,
  isFiniteNumber,
  resolveOptions,
  resolveOverrideDefault,
  resolveText,
} from '@/lib/fields/runtime';
import type { FieldOption } from '@/lib/fields/types';
import { ChoiceGroup } from './ChoiceGroup';
import { CustomSlot } from './CustomSlot';
import { FieldListBase } from './FieldList';
import { NullableField } from './NullableField';
import type { FieldInputProps, FieldListProps, FieldSize } from './types';

/**
 * How the intake wizard shows a field it has not had an answer for (its
 * display layer over the working copy; the calculator pages pass none).
 */
export interface FieldDisplay {
  /**
   * Render the field with no value: money, number, percent and text inputs
   * empty with the typical value as the placeholder, a select with nothing
   * chosen and its typical option's label (or "Select" without one) muted in
   * the closed control, a state with its empty "Select" option, a choice
   * with nothing selected. List, custom
   * and slider fields ignore it.
   */
  blank: boolean;
  /** The value Next would accept for the field (the placeholder of a blank input). */
  typical?: unknown;
  /** Tag the typical option of a choice ("Typical") or a select ("(typical)" after its label). */
  typicalTag?: boolean;
  /** The visitor emptied an input: the caller makes the field blank again. */
  onClear?(): void;
  /** Show a 0 as "0" (an answered 0) instead of an empty input. */
  showZero?: boolean;
}

export type FieldInputDisplayProps = FieldInputProps & {
  /** The intake wizard's display layer; omitted on the calculator pages. */
  display?: FieldDisplay;
};

/** The empty option of a blank select or state field. */
export const BLANK_SELECT_LABEL = 'Select';

/** Added to the label of a select's typical option in the wizard: "Individual (typical)". */
const TYPICAL_OPTION_SUFFIX = '(typical)';

/** The wizard's lg is the primitives' xl; md renders them exactly as before. */
const INPUT_SIZE: Record<FieldSize, InputSize> = { md: 'md', lg: 'xl' };
/** BaseInput + Input has no size prop of its own; these match the xl primitives. */
const TEXT_SIZE: Record<FieldSize, string | undefined> = { md: undefined, lg: 'h-14 text-2xl' };

const YES_NO: readonly FieldOption[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

function asNumber(value: unknown): number {
  return isFiniteNumber(value) ? value : 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isOptionValue(value: unknown): value is FieldOption['value'] {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/** SelectInput and StateSelector take no test id; the field wraps them. */
function TestIdBox({ testId, children }: { testId?: string; children: React.ReactNode }) {
  return testId ? <div data-testid={testId}>{children}</div> : <>{children}</>;
}

/**
 * Renders one FieldSpec with the matching input primitive, at the
 * calculator size (md) or the wizard size (lg). Returns nothing while the
 * spec's visibleWhen is false.
 */
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
  display,
}: FieldInputDisplayProps) {
  if (!isFieldVisible(spec, get)) return null;

  const value = get(spec.path);
  const blank = display?.blank === true;
  const typical = display?.typical;
  // A blank numeric input shows nothing, with the typical value as its placeholder.
  const numberValue = blank ? null : asNumber(value);
  const placeholderValue = blank && isFiniteNumber(typical) ? typical : undefined;
  const showZero = display?.showZero;
  const onClear = display?.onClear;
  const name = `${idPrefix}-${spec.path}`;
  const label = spec.label;
  const help = resolveText(spec.help, get);
  const hint = resolveText(spec.hint, get);
  const inputSize = INPUT_SIZE[size];
  const testId = spec.testId;

  // One onWrite call per change: the field's own write, then its coupled writes.
  const write = (next: unknown) => onWrite(fieldWrites(spec, next, get));

  const choice = (options: readonly FieldOption[]) => (
    <ChoiceGroup
      label={label}
      options={options}
      value={blank ? undefined : value}
      onChange={write}
      onChooseAndAdvance={onChooseAndAdvance}
      typicalValue={display?.typicalTag && isOptionValue(typical) ? typical : undefined}
      help={help}
      error={error}
      hideLabel={hideLabel}
      layout={size === 'lg' ? 'stack' : 'grid'}
      size={size}
      testId={testId}
    />
  );

  const renderControl = (): React.ReactNode => {
    switch (spec.kind) {
      case 'money':
        // MoneyInput is whole dollars; a money field with decimals types
        // into a NumberInput with a $ prefix.
        if ((spec.precision ?? 0) > 0) {
          return (
            <NumberInput
              name={name}
              label={label}
              help={help}
              error={error}
              value={numberValue}
              onChange={write}
              placeholder={spec.placeholder}
              placeholderValue={placeholderValue}
              showZero={showZero}
              onClear={onClear}
              min={spec.min ?? 0}
              max={spec.max}
              step={spec.step}
              allowDecimals
              precision={spec.precision}
              prefix={spec.unit?.prefix ?? '$'}
              suffix={spec.unit?.suffix}
              size={inputSize}
              testId={testId}
            />
          );
        }
        return (
          <MoneyInput
            name={name}
            label={label}
            help={help}
            error={error}
            value={numberValue}
            onChange={write}
            placeholder={spec.placeholder}
            placeholderValue={placeholderValue}
            showZero={showZero}
            onClear={onClear}
            min={spec.min ?? 0}
            max={spec.max}
            size={inputSize}
            testId={testId}
          />
        );
      case 'number':
        return (
          <NumberInput
            name={name}
            label={label}
            help={help}
            error={error}
            value={numberValue}
            onChange={write}
            placeholder={spec.placeholder}
            placeholderValue={placeholderValue}
            showZero={showZero}
            onClear={onClear}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            allowDecimals={(spec.precision ?? 0) > 0}
            precision={spec.precision}
            prefix={spec.unit?.prefix}
            suffix={spec.unit?.suffix}
            textAlign={size === 'lg' ? 'left' : undefined}
            size={inputSize}
            testId={testId}
          />
        );
      case 'percent':
        return (
          <PercentInput
            name={name}
            label={label}
            help={help}
            error={error}
            value={numberValue}
            onChange={write}
            placeholder={spec.placeholder}
            placeholderValue={placeholderValue}
            showZero={showZero}
            onClear={onClear}
            min={spec.min ?? 0}
            max={spec.max ?? 1}
            step={spec.step}
            precision={spec.precision ?? 1}
            showSlider={spec.slider}
            size={inputSize}
            testId={testId}
          />
        );
      case 'slider':
        return (
          <SliderField
            name={name}
            label={label}
            help={help}
            error={error}
            value={asNumber(value)}
            onChange={write}
            min={spec.min ?? 0}
            max={spec.max ?? 100}
            step={spec.step}
            formatValue={(n) => formatFieldValue(spec, n)}
            prefix={spec.unit?.prefix}
            suffix={spec.unit?.suffix}
            size={inputSize}
            testId={testId}
          />
        );
      case 'select': {
        const options = resolveOptions(spec, get);
        const typicalOption = display?.typicalTag && isOptionValue(typical) ? typical : undefined;
        // A blank select shows the label of the option Next would take as its
        // placeholder (muted, like a blank number input's typical value).
        // It is the placeholder option, so the value stays '' (unanswered).
        const typicalLabel =
          blank && isOptionValue(typical) ? options.find((option) => option.value === typical)?.label : undefined;
        return (
          <TestIdBox testId={testId}>
            <SelectInput
              name={name}
              label={label}
              help={help}
              error={error}
              value={blank || value === undefined || value === null ? '' : String(value)}
              // The select hands back a string; write the option's own value
              // so numeric and boolean options keep their type.
              onChange={(text) => write(options.find((option) => String(option.value) === text)?.value ?? text)}
              // The option Next would accept is marked in its label, as a
              // choice tags it "Typical" (a select has no room for a tag).
              options={options.map((option) => ({
                value: String(option.value),
                label: typicalOption === option.value ? `${option.label} ${TYPICAL_OPTION_SUFFIX}` : option.label,
              }))}
              placeholder={blank ? (typicalLabel ?? spec.placeholder ?? BLANK_SELECT_LABEL) : spec.placeholder}
              size={inputSize}
            />
          </TestIdBox>
        );
      }
      case 'choice':
        return choice(resolveOptions(spec, get));
      case 'boolean': {
        if (size === 'lg') {
          const options = resolveOptions(spec, get);
          return choice(options.length > 0 ? options : YES_NO);
        }
        return (
          <Checkbox
            name={name}
            label={label}
            checked={value === true}
            onChange={write}
            help={help}
            error={error}
            testId={testId}
          />
        );
      }
      case 'state':
        return (
          <TestIdBox testId={testId}>
            <StateSelector
              name={name}
              label={label}
              help={help}
              error={error}
              value={blank ? '' : asString(value)}
              onChange={write}
              placeholder={blank ? BLANK_SELECT_LABEL : spec.placeholder}
              size={inputSize}
            />
          </TestIdBox>
        );
      case 'text': {
        // BaseInput links only a direct <input> child, so the Input gets the
        // ids BaseInput derives from the name, for the help or error it renders.
        const inputId = `input-${name}`;
        const { describedBy } = fieldMessageIds(inputId, help, error);
        return (
          <BaseInput name={name} label={label} help={help} error={error} testId={testId} size={inputSize}>
            <div className="relative w-full">
              <Input
                id={inputId}
                name={name}
                value={blank ? '' : asString(value)}
                onChange={(event) => write(event.target.value)}
                placeholder={blank && asString(typical) !== '' ? asString(typical) : spec.placeholder}
                maxLength={spec.maxLength}
                aria-describedby={describedBy}
                aria-invalid={error ? true : undefined}
                className={TEXT_SIZE[size]}
              />
            </div>
          </BaseInput>
        );
      }
      case 'list':
        // A list with a registered renderer (the compact account list) draws
        // itself; without one it is the generic editable list.
        if (spec.renderer && renderers?.[spec.renderer]) {
          return (
            <CustomSlot
              rendererId={spec.renderer}
              renderers={renderers}
              spec={spec}
              get={get}
              value={value}
              onWrite={onWrite}
              error={error}
              size={size}
            />
          );
        }
        return (
          <FieldListBase
            renderField={FieldInput}
            spec={spec}
            get={get}
            onWrite={onWrite}
            errors={errors ?? (error ? { [spec.path]: error } : {})}
            renderers={renderers}
            size={size}
            idPrefix={idPrefix}
          />
        );
      case 'custom':
        return (
          <CustomSlot
            rendererId={spec.renderer}
            renderers={renderers}
            spec={spec}
            get={get}
            value={value}
            onWrite={onWrite}
            error={error}
            size={size}
          />
        );
    }
  };

  let field = renderControl();
  if (spec.nullable) {
    const autoValue = resolveOverrideDefault(spec, get);
    field = (
      <NullableField
        label={label}
        isAuto={value === null}
        autoLabel={resolveText(spec.nullable.autoLabel, get)}
        autoValue={autoValue === undefined ? undefined : formatFieldValue(spec, autoValue)}
        onAuto={() => write(null)}
        onCustom={() => write(autoValue ?? spec.min ?? 0)}
        size={size}
      >
        {field}
      </NullableField>
    );
  }
  if (!hint) return <>{field}</>;
  return (
    <div className="space-y-1.5">
      {field}
      <LookupHint>{hint}</LookupHint>
    </div>
  );
}

/** An editable list of rows whose fields render through FieldInput (see FieldListBase). */
export function FieldList(props: FieldListProps) {
  return <FieldListBase {...props} renderField={FieldInput} />;
}

export default FieldInput;
