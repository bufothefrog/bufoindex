'use client';

import React, { useId, useRef } from 'react';
import { MoneyInput, NumberInput, PercentInput, US_STATES } from '@/components/ui/inputs';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import type { IntakeOptionValue, IntakeQuestion } from '@/lib/constants/intake';
import { cn } from '@/lib/utils';
import { OptionCard } from './OptionCard';

export interface WizardStepProps {
  question: IntakeQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  /**
   * Enter on a choice option selects it and advances in one step. The value
   * is passed along because the parent's state has not updated yet.
   */
  onChooseAndAdvance?: (value: IntakeOptionValue) => void;
  /** Visually hide the field label (the screen heading already asks the question). */
  hideLabel?: boolean;
}

// Enlarges the existing input primitives without forking them: the
// descendant selectors outrank the primitives' own size classes.
const LARGE_FIELD =
  '[&_label]:text-base [&_input]:h-14 [&_input]:text-2xl [&_select]:h-14 [&_select]:text-lg';

const STATE_OPTIONS = US_STATES.map((state) => ({ value: state.code, label: state.name }));

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

interface ChoiceGroupProps {
  question: IntakeQuestion;
  value: unknown;
  onChange: (value: IntakeOptionValue) => void;
  onChooseAndAdvance?: (value: IntakeOptionValue) => void;
  hideLabel?: boolean;
}

/**
 * Radio group of OptionCards with the standard keyboard model: Tab enters
 * the group on the selected option, arrow keys move and select, Space
 * selects, Enter selects and advances.
 */
function ChoiceGroup({ question, value, onChange, onChooseAndAdvance, hideLabel }: ChoiceGroupProps) {
  const labelId = useId();
  const helpId = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const options = question.options ?? [];
  const selectedIndex = options.findIndex((option) => option.value === value);
  const tabStop = selectedIndex >= 0 ? selectedIndex : 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const radios = Array.from(
      groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []
    );
    const current = radios.indexOf(event.target as HTMLButtonElement);
    if (current < 0 || options.length === 0) return;

    let next: number | null = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (current + 1) % options.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (current - 1 + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;

    if (next !== null) {
      event.preventDefault();
      onChange(options[next].value);
      radios[next]?.focus();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = options[current].value;
      if (onChooseAndAdvance) onChooseAndAdvance(chosen);
      else onChange(chosen);
    }
  };

  return (
    <div className="space-y-2">
      <p id={labelId} className={cn('text-base font-medium', hideLabel && 'sr-only')}>
        {question.label}
      </p>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={question.help ? helpId : undefined}
        onKeyDown={handleKeyDown}
        className="space-y-2"
      >
        {options.map((option, index) => (
          <OptionCard
            key={String(option.value)}
            title={option.label}
            description={option.description}
            selected={index === selectedIndex}
            onSelect={() => onChange(option.value)}
            tabIndex={index === tabStop ? 0 : -1}
          />
        ))}
      </div>
      {question.help && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {question.help}
        </p>
      )}
    </div>
  );
}

/** Renders one intake question with the matching existing input primitive. */
export function WizardStep({ question, value, onChange, onChooseAndAdvance, hideLabel }: WizardStepProps) {
  const name = `intake-${question.id}`;

  switch (question.kind) {
    case 'money':
      return (
        <MoneyInput
          name={name}
          label={question.label}
          help={question.help}
          value={asNumber(value)}
          onChange={onChange}
          min={question.min ?? 0}
          max={question.max}
          size="lg"
          className={LARGE_FIELD}
        />
      );
    case 'number':
      return (
        <NumberInput
          name={name}
          label={question.label}
          help={question.help}
          value={asNumber(value)}
          onChange={onChange}
          min={question.min}
          max={question.max}
          step={question.step ?? 1}
          allowDecimals={false}
          textAlign="left"
          size="lg"
          className={LARGE_FIELD}
        />
      );
    case 'percent':
      return (
        <PercentInput
          name={name}
          label={question.label}
          help={question.help}
          value={asNumber(value)}
          onChange={onChange}
          min={question.min ?? 0}
          max={question.max ?? 1}
          precision={1}
          size="lg"
          className={LARGE_FIELD}
        />
      );
    case 'state':
      return (
        <SelectInput
          name={name}
          label={question.label}
          help={question.help}
          value={asString(value)}
          onChange={onChange}
          options={STATE_OPTIONS}
          className={LARGE_FIELD}
        />
      );
    case 'frequency':
      return (
        <SelectInput
          name={name}
          label={question.label}
          help={question.help}
          value={asString(value)}
          onChange={onChange}
          options={(question.options ?? []).map((option) => ({
            value: String(option.value),
            label: option.label,
          }))}
          className={LARGE_FIELD}
        />
      );
    case 'filing':
    case 'choice':
      return (
        <ChoiceGroup
          question={question}
          value={value}
          onChange={onChange}
          onChooseAndAdvance={onChooseAndAdvance}
          hideLabel={hideLabel}
        />
      );
  }
}

export default WizardStep;
