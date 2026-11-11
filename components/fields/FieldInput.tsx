'use client';

import React from 'react';
import { BaseInput, MoneyInput, NumberInput, PercentInput, SliderField, StateSelector } from '@/components/ui/inputs';
import type { InputSize } from '@/components/ui/inputs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { LookupHint } from '@/components/shared/LookupHint';
import {
  formatFieldValue,
  isFieldVisible,
  resolveOptions,
  resolveOverrideDefault,
  resolveText,
} from '@/lib/fields/runtime';
import type { FieldOption, Get } from '@/lib/fields/types';
import { ChoiceGroup } from './ChoiceGroup';
import { CustomSlot } from './CustomSlot';
import { FieldList } from './FieldList';
import { NullableField } from './NullableField';
import type { FieldInputProps, FieldSize } from './types';

/** The wizard's lg is the primitives' xl; md renders them exactly as before. */
const INPUT_SIZE: Record<FieldSize, InputSize> = { md: 'md', lg: 'xl' };
/** BaseInput + Input has no size prop of its own; these match the xl primitives. */
const TEXT_SIZE: Record<FieldSize, string | undefined> = { md: undefined, lg: 'h-14 text-2xl' };

const YES_NO: readonly FieldOption[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
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
}: FieldInputProps) {
  if (!isFieldVisible(spec, get)) return null;

  const value = get(spec.path);
  const name = `${idPrefix}-${spec.path}`;
  const label = spec.label;
  const help = resolveText(spec.help, get);
  const hint = resolveText(spec.hint, get);
  const inputSize = INPUT_SIZE[size];
  const testId = spec.testId;

  // One onWrite call per change: the field's own write, then the spec's
  // coupled writes. The Get handed to onChange already sees the new value
  // (the phase 1 hand-off recommends this), so a coupled write derives from
  // what the visitor just entered, not from the value it replaces.
  const write = (next: unknown) => {
    const after: Get = (path) => (path === spec.path ? next : get(path));
    onWrite([{ path: spec.path, value: next }, ...(spec.onChange?.(next, after) ?? [])]);
  };

  const choice = (options: readonly FieldOption[]) => (
    <ChoiceGroup
      label={label}
      options={options}
      value={value}
      onChange={write}
      onChooseAndAdvance={onChooseAndAdvance}
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
        // into a NumberInput with a $ prefix (the rebalancer's new cash).
        if ((spec.precision ?? 0) > 0) {
          return (
            <NumberInput
              name={name}
              label={label}
              help={help}
              error={error}
              value={asNumber(value)}
              onChange={write}
              placeholder={spec.placeholder}
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
            value={asNumber(value)}
            onChange={write}
            placeholder={spec.placeholder}
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
            value={asNumber(value)}
            onChange={write}
            placeholder={spec.placeholder}
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
            value={asNumber(value)}
            onChange={write}
            placeholder={spec.placeholder}
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
        return (
          <TestIdBox testId={testId}>
            <SelectInput
              name={name}
              label={label}
              help={help}
              error={error}
              value={value === undefined || value === null ? '' : String(value)}
              // The select hands back a string; write the option's own value
              // so numeric and boolean options keep their type.
              onChange={(text) => write(options.find((option) => String(option.value) === text)?.value ?? text)}
              options={options.map((option) => ({ value: String(option.value), label: option.label }))}
              placeholder={spec.placeholder}
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
              value={asString(value)}
              onChange={write}
              placeholder={spec.placeholder}
            />
          </TestIdBox>
        );
      case 'text': {
        // BaseInput links only a direct <input> child, so the Input gets the
        // ids BaseInput derives from the name, for the help or error it renders.
        const inputId = `input-${name}`;
        const describedBy = error ? `${inputId}-error` : help ? `${inputId}-help` : undefined;
        return (
          <BaseInput name={name} label={label} help={help} error={error} testId={testId} size={inputSize}>
            <div className="relative w-full">
              <Input
                id={inputId}
                name={name}
                value={asString(value)}
                onChange={(event) => write(event.target.value)}
                placeholder={spec.placeholder}
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
        return (
          <FieldList
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

export default FieldInput;
