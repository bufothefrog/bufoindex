'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ALL_RENDERERS, INTAKE_DESTINATION, INTAKE_PREWARM, RENDERERS } from '@/components/calculators/renderers';
import { FieldInput } from '@/components/fields/FieldInput';
import { ScreenNotes } from '@/components/fields/ScreenNotes';
import type { CustomRenderers } from '@/components/fields/types';
import { PROFILE_FORM_SECTION_LABELS, profileFormSection } from '@/lib/calculators/forms';
import { REVIEW_PATH, reviewTopicReturnHref } from '@/lib/calculators/profileReview';
import {
  BLANK_FIELDS_NOTE,
  EXAMPLE_ROWS_NOTE,
  EXAMPLE_ROWS_NOTE_ON_SAVE,
  coreDestination,
  coreStartLink,
  getIntakeScreens,
  getLearnOption,
  intakeForm,
  intentNeedsCore,
  isCoreComplete,
  isIntakeIntent,
  nextNeedsOwnAnswer,
  ownAnswerMessage,
  validateIntakeScreen,
  type IntakeFlow,
  type IntakeIntent,
  type IntakeMode,
} from '@/lib/constants/intake';
import { applyWrites, getAt, makeGet } from '@/lib/fields/paths';
import { fieldWrites, listRows, relationErrors, visibleScreenFields } from '@/lib/fields/runtime';
import type { FieldErrors, FieldSpec, Get, ScreenSpec, Write } from '@/lib/fields/types';
import { DERIVED_PATHS, withDerivedValues } from '@/lib/profile/derived';
import type { FinancialProfile } from '@/lib/profile/types';
import { useProfileStore } from '@/lib/store/profileStore';
import { cn } from '@/lib/utils';
import { BackControl } from './BackControl';
import { ProgressDots } from './ProgressDots';
import {
  EMPTY_LEDGER,
  answerScreen,
  clearField,
  editScreen,
  isBlankField,
  isUnder,
  saveWrites,
  skipScreens,
  startProgress,
  type SaveLedger,
  type WizardProgress,
} from './wizardProgress';

export interface WizardProps {
  /** 'core' asks the shared basics; an intent asks that intent's form. */
  flow: IntakeFlow;
  /**
   * 'all' asks every screen of the flow; 'remaining' skips the screens the
   * saved profile already answers (and, for an intent, the core). Defaults
   * to 'all' for the core and 'remaining' for intents.
   */
  mode?: IntakeMode;
  /** Core flow only: the intent to continue to (an IntakeIntent); otherwise the chooser. */
  next?: string;
  /**
   * Single-screen mode (the profile flow's /start/review/<id>): asks only the
   * screen with this id, in 'all' mode, with Save and Cancel in place of Skip
   * and Next. Save checks and saves the screen as Next does, then returns to
   * the review page at that topic's row; Cancel returns without saving.
   */
  onlyScreen?: string;
}

// The basics can be finished with questions skipped (skipped answers keep
// their value on arrival and stay out of profile.provided), so a strict
// isCoreComplete guard would send that visitor back to the basics forever.
// Finishing the core stamps the profile's updatedAt here for this tab; the
// guards accept a profile whose last edit is at or after that stamp. A
// profile reset (updatedAt 0) clears the effect.
const CORE_FINISHED_KEY = 'bufo-core-finished';

function markCoreFinished(updatedAt: number) {
  try {
    window.sessionStorage.setItem(CORE_FINISHED_KEY, String(updatedAt));
  } catch {
    // Storage blocked (private mode, sandboxed preview): the strict check applies.
  }
}

function coreFinishedAt(): number | null {
  try {
    const raw = window.sessionStorage.getItem(CORE_FINISHED_KEY);
    const stamp = raw === null ? NaN : Number(raw);
    return Number.isFinite(stamp) && stamp > 0 ? stamp : null;
  } catch {
    return null;
  }
}

/**
 * Whether the guided flow can move past the basics: every core answer is
 * saved, or the core intake was finished in this tab (some questions skipped)
 * and the profile has not been reset since. Call only after hydration.
 */
export function isCoreReady(profile: FinancialProfile): boolean {
  if (isCoreComplete(profile)) return true;
  const stamp = coreFinishedAt();
  return stamp !== null && profile.updatedAt >= stamp;
}

/** Where an intent's intake leads: the seeded calculator, or the overview for 'profile'. */
export function intentDestination(intent: IntakeIntent, profile: FinancialProfile): string {
  return intent === 'profile' ? '/overview' : INTAKE_DESTINATION[intent](profile);
}

function destinationFor(flow: IntakeFlow, profile: FinancialProfile, next?: string): string {
  return flow === 'core' ? coreDestination(next) : intentDestination(flow, profile);
}

function resolveMode(flow: IntakeFlow, mode?: IntakeMode): IntakeMode {
  return mode ?? (flow === 'core' ? 'all' : 'remaining');
}

/** The custom renderers a flow's fields can name: the intent's own, or all four for the profile. */
function renderersFor(flow: IntakeFlow): CustomRenderers | undefined {
  if (flow === 'core') return undefined;
  return flow === 'profile' ? ALL_RENDERERS : RENDERERS[flow];
}

/**
 * Runs `task` once the browser is idle (requestIdleCallback, or a timeout
 * where it is missing). Returns the cancel function for an effect cleanup.
 */
function whenIdle(task: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(() => task());
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(task, 1);
  return () => window.clearTimeout(handle);
}

/**
 * The spec with the option its field held on arrival kept on offer. A
 * choice the intake offers only in part (options that add the saved value)
 * adds the saved value's option from the working answers; once the visitor
 * clicks another option, that option would vanish, so the one chosen on
 * arrival is resolved against the arrival profile and kept.
 */
function keepArrivalOption(spec: FieldSpec, arrival: Get): FieldSpec {
  const options = spec.options;
  if (typeof options !== 'function') return spec;
  return {
    ...spec,
    options: (get) => {
      const now = options(get);
      const saved = arrival(spec.path);
      if (now.some((option) => option.value === saved)) return now;
      const kept = options(arrival).find((option) => option.value === saved);
      return kept ? [...now, kept] : now;
    },
  };
}

/**
 * Splits a screen's errors: field errors show inline, and the cross-field
 * (relation) messages show once, as the screen-level alert. A field's own
 * error wins over a relation on the same path, as in validateFields.
 */
function splitErrors(errors: FieldErrors, relations: FieldErrors): { inline: FieldErrors; alert: string[] } {
  const inline: FieldErrors = {};
  const alert: string[] = [];
  for (const [path, message] of Object.entries(errors)) {
    if (relations[path] === message) alert.push(message);
    else inline[path] = message;
  }
  return { inline, alert };
}

function WizardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading questions">
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="h-8 w-3/4 rounded bg-muted" />
      <div className="h-14 w-full rounded-md bg-muted" />
      <div className="h-12 w-full rounded-md bg-muted" />
    </div>
  );
}

interface WizardHeaderProps {
  flow: IntakeFlow;
  next?: string;
  onlyScreen?: string;
}

/**
 * Page heading for the flow (the basics, or the intent the visitor picked)
 * and one short line; in single-screen mode, the review page's name and the
 * topic's section.
 */
function WizardHeader({ flow, next, onlyScreen }: WizardHeaderProps) {
  let eyebrow = 'Guided start';
  let title: string;
  let line: string | undefined;

  if (onlyScreen !== undefined) {
    const section = profileFormSection(onlyScreen);
    eyebrow = 'Review your answers';
    title = section ? PROFILE_FORM_SECTION_LABELS[section] : 'Your answers';
  } else if (flow === 'core') {
    title = 'A few basics';
    line =
      next && isIntakeIntent(next)
        ? `Every calculator uses these. Then: ${getLearnOption(next).title}.`
        : 'Every calculator uses these answers.';
  } else {
    const option = getLearnOption(flow);
    title = option.title;
    line = option.resultHint;
  }

  return (
    <header className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-sage-600 dark:text-sage-300">
        {eyebrow}
      </p>
      <h1 className="text-base font-medium text-foreground">{title}</h1>
      {line && <p className="text-sm text-muted-foreground">{line}</p>}
    </header>
  );
}

const SKIP_BUTTON_CLASS =
  'min-h-11 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50';

interface WizardFlowProps {
  flow: IntakeFlow;
  mode: IntakeMode;
  next?: string;
  onlyScreen?: string;
  initialProfile: FinancialProfile;
}

/**
 * The flow's screens in form order, or in single-screen mode that one screen
 * of the form, visible or not (the gate checks it is visible on arrival; its
 * fields are filtered for visibility as on any screen).
 */
function flowScreens(
  flow: IntakeFlow,
  get: Get,
  mode: IntakeMode,
  provided: readonly string[],
  onlyScreen?: string
): ScreenSpec[] {
  if (onlyScreen !== undefined) return intakeForm(flow, mode).screens.filter((screen) => screen.id === onlyScreen);
  return getIntakeScreens(flow, get, { mode, provided });
}

function WizardFlow({ flow, mode, next, onlyScreen, initialProfile }: WizardFlowProps) {
  const router = useRouter();
  const setValues = useProfileStore((state) => state.setValues);

  // The answers are a working copy of the profile as it was on arrival;
  // fields write into it by path, so lists edit in place. It always holds a
  // complete value per path; what a field shows is the display layer below.
  const [seed] = useState<FinancialProfile>(initialProfile);
  const [progress, setProgress] = useState<WizardProgress>(() => startProgress(seed));
  // What the saves of this visit wrote and marked (see saveWrites).
  const ledger = useRef<SaveLedger>(EMPTY_LEDGER);
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Bumped to move focus to the first field with an error.
  const [focusError, setFocusError] = useState(0);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // 'remaining' mode filters on what the profile held when the flow opened,
  // not on answers given here (or saved as the visitor goes), so screens do
  // not vanish mid-flow.
  const [initiallyProvided] = useState<readonly string[]>(() => initialProfile.provided);
  const form = intakeForm(flow, mode);
  const renderers = renderersFor(flow);
  const single = onlyScreen !== undefined;
  const screensAt = (values: FinancialProfile) =>
    flowScreens(flow, makeGet(values), mode, initiallyProvided, onlyScreen);

  // Answered on arrival or in this visit: shown with the saved value.
  const answeredPaths = useMemo(
    () => [...initiallyProvided, ...progress.provided],
    [initiallyProvided, progress.provided]
  );
  // A derived leaf (lib/profile/derived.ts) the visitor has neither answered
  // nor edited follows the working answers: the emergency fund balance shown
  // on its screen is three months of the must-pay costs answered earlier.
  const derivedOver = (values: FinancialProfile, edited: readonly string[]) =>
    withDerivedValues(values, [...answeredPaths, ...edited]);
  const editedPaths = useMemo(() => Object.values(progress.touched).flat(), [progress.touched]);
  const answers = useMemo(
    () => withDerivedValues(progress.answers, [...answeredPaths, ...editedPaths]),
    [progress.answers, answeredPaths, editedPaths]
  );
  // The typical value of each derived leaf, ignoring the visitor's edit of it
  // (the choice's "Typical" tag once another option is picked).
  const typicals = useMemo(() => withDerivedValues(progress.answers, answeredPaths), [progress.answers, answeredPaths]);
  const get = useMemo(() => makeGet(answers), [answers]);
  const arrival = useMemo(() => makeGet(seed), [seed]);
  const screens = useMemo(
    () => flowScreens(flow, get, mode, initiallyProvided, onlyScreen),
    [flow, mode, initiallyProvided, get, onlyScreen]
  );
  const step = Math.min(index, screens.length - 1);
  const screen = screens[step];
  const isLast = step === screens.length - 1;
  const isProfileIntent = flow === 'profile';
  const acceptsTypical = !nextNeedsOwnAnswer(screen);

  // Move focus to the new question (and back to the top on phones) whenever
  // the screen changes, but not on first load.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  // A blank field on a screen whose Next needs the visitor's own entry: focus
  // the first one (the first radio of a choice group).
  useEffect(() => {
    if (focusError === 0) return;
    const invalid = fieldsRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target =
      invalid?.getAttribute('role') === 'radiogroup'
        ? invalid.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
        : invalid;
    target?.focus();
  }, [focusError]);

  // Start the intent's warm-up (audit H5) while the visitor answers, once,
  // when the browser is idle; an unmount before then cancels it.
  useEffect(() => {
    const prewarm = flow === 'core' || flow === 'profile' ? undefined : INTAKE_PREWARM[flow];
    return prewarm ? whenIdle(prewarm) : undefined;
  }, [flow]);

  /**
   * Saves what the visitor has confirmed so far (after every Next and Skip),
   * so leaving through the site header loses nothing.
   */
  const save = (confirmed: WizardProgress) => {
    const { writes, options, ledger: next } = saveWrites(flow, seed, confirmed, ledger.current, form.screens);
    ledger.current = next;
    setValues(writes, options);
  };

  const finish = () => {
    setSubmitting(true);
    const saved = useProfileStore.getState().profile;
    const destination = destinationFor(flow, saved, next) as Route;
    if (flow === 'core') {
      // The basics stay in history, so Back from the chooser (or the intent's
      // questions) returns to them, prefilled, for editing.
      markCoreFinished(saved.updatedAt);
      router.push(destination);
    } else {
      // An intent's page replaces itself with its result. Kept in history,
      // Back from the calculator or overview would land on it with nothing
      // left to ask, and the gate would send the visitor forward again; this
      // way Back reaches the chooser (or the basics on the ?next path).
      router.replace(destination);
    }
  };

  const clearErrors = () => {
    setErrors({});
    setAlert([]);
  };

  const advance = (writes?: Write[]) => {
    if (submitting) return;
    const raw = writes ? applyWrites(progress.answers, writes) : progress.answers;
    const nextAnswers = writes ? derivedOver(raw, [...editedPaths, ...writes.map((w) => w.path)]) : answers;
    const nextScreens = writes ? screensAt(nextAnswers) : screens;
    const current = nextScreens[Math.min(step, nextScreens.length - 1)];
    const nextGet = makeGet(nextAnswers);
    // Next takes a blank derived leaf's grey value as the answer, like any
    // typical value: it is written before the screen is marked answered.
    const own = visibleScreenFields(form, current, nextGet).map((spec) => spec.path);
    const derivedWrites: Write[] = DERIVED_PATHS.filter(
      (path) => own.includes(path) && getAt(nextAnswers, path) !== getAt(raw, path)
    ).map((path) => ({ path, value: getAt(nextAnswers, path) }));
    const keepWrites = () => {
      if (writes) setProgress((prev) => editScreen(form, prev, current, writes));
    };

    if (nextNeedsOwnAnswer(current)) {
      // No typical value is saved from here: every visible field needs an entry.
      const touched = [...(progress.touched[current.id] ?? []), ...(writes ?? []).map((w) => w.path)];
      const blanks = visibleScreenFields(form, current, nextGet).filter((spec) =>
        isBlankField(spec, nextGet(spec.path), answeredPaths, touched)
      );
      if (blanks.length > 0) {
        keepWrites();
        setErrors(Object.fromEntries(blanks.map((spec) => [spec.path, ownAnswerMessage(spec)])));
        setAlert([]);
        setFocusError((n) => n + 1);
        return;
      }
    }

    const found = validateIntakeScreen(flow, current, nextGet);
    if (Object.keys(found).length > 0) {
      const split = splitErrors(found, relationErrors(form, nextGet, { screen: current }));
      keepWrites();
      setErrors(split.inline);
      setAlert(split.alert);
      return;
    }

    const confirmed = answerScreen(form, progress, current, [...derivedWrites, ...(writes ?? [])]);
    setProgress(confirmed);
    save(confirmed);
    clearErrors();

    if (single) {
      setSubmitting(true);
      router.push(reviewTopicReturnHref(current.id) as Route);
      return;
    }
    if (step >= nextScreens.length - 1) finish();
    else setIndex(step + 1);
  };

  const skip = () => {
    if (submitting) return;
    const skipped = skipScreens(form, progress, seed, [screen], screens);
    setProgress(skipped);
    save(skipped);
    clearErrors();
    const nextScreens = screensAt(skipped.answers);
    if (step >= nextScreens.length - 1) finish();
    else setIndex(step + 1);
  };

  const back = () => {
    clearErrors();
    setIndex(Math.max(0, step - 1));
  };

  const write = (writes: Write[]) => {
    setProgress((prev) => editScreen(form, prev, screen, writes));
    clearErrors();
  };

  /** The visitor emptied an unanswered input: it goes back to its value on arrival and shows blank. */
  const clear = (spec: FieldSpec) => {
    setProgress((prev) =>
      clearField(form, prev, screen, spec.path, fieldWrites(spec, getAt(seed, spec.path), makeGet(prev.answers)))
    );
    clearErrors();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    advance();
  };

  // Enter on the focused heading advances too (focus lands there after each
  // screen change); inputs already submit the form natively.
  const handleHeadingKeyDown = (event: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      advance();
    }
  };

  const section = isProfileIntent ? profileFormSection(screen.id) : undefined;
  const fields = visibleScreenFields(form, screen, get).map((spec) => keepArrivalOption(spec, arrival));
  const touchedHere = progress.touched[screen.id] ?? [];
  const shown = fields.map((spec) => {
    const value = get(spec.path);
    const unanswered = !isUnder(spec.path, answeredPaths);
    const blank = isBlankField(spec, value, answeredPaths, touchedHere);
    return {
      spec,
      unanswered,
      display: {
        blank,
        // What Next would accept: the working value while blank, the value on
        // arrival (for the choice's tag) once the visitor has chosen.
        typical: blank ? value : getAt(DERIVED_PATHS.includes(spec.path) ? typicals : seed, spec.path),
        typicalTag: acceptsTypical && unanswered,
        onClear: unanswered ? () => clear(spec) : undefined,
        showZero: true,
      },
    };
  });
  const showsExampleRows = shown.some(
    ({ spec, unanswered }) =>
      unanswered && (spec.kind === 'list' || spec.kind === 'custom') && listRows(get(spec.path)).length > 0
  );
  // Single-screen mode has Save in place of Skip and Next; the notes name it.
  const screenNote = showsExampleRows
    ? single
      ? EXAMPLE_ROWS_NOTE_ON_SAVE
      : EXAMPLE_ROWS_NOTE
    : shown.some(({ display }) => display.blank)
      ? acceptsTypical
        ? single
          ? BLANK_FIELDS_NOTE.typicalOnSave
          : BLANK_FIELDS_NOTE.typical
        : BLANK_FIELDS_NOTE.examples
      : undefined;
  const singleQuestion = fields.length === 1;
  const sectionLabel = section ? PROFILE_FORM_SECTION_LABELS[section] : undefined;
  const errorId = `intake-error-${screen.id}`;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {!single && (
        <div className="flex min-h-11 items-center gap-3">
          {/* The site-wide header already links home, so the first screen has no Back. */}
          {step > 0 && <BackControl onBack={back} />}
          <ProgressDots total={screens.length} current={step} label={sectionLabel} className="ml-auto justify-end" />
        </div>
      )}

      <div className="space-y-2">
        <h2
          ref={headingRef}
          tabIndex={-1}
          onKeyDown={handleHeadingKeyDown}
          className="text-2xl font-semibold tracking-tight focus:outline-hidden md:text-3xl"
        >
          {screen.question ?? screen.title}
        </h2>
        {screen.description && <p className="text-sm text-muted-foreground">{screen.description}</p>}
        {screenNote && <p className="text-xs text-muted-foreground">{screenNote}</p>}
      </div>

      <div ref={fieldsRef} className="space-y-5">
        {shown.map(({ spec, display }) => (
          <FieldInput
            key={spec.path}
            spec={spec}
            get={get}
            onWrite={write}
            error={errors[spec.path]}
            errors={errors}
            size="lg"
            hideLabel={singleQuestion}
            renderers={renderers}
            onChooseAndAdvance={(value) => advance(fieldWrites(spec, value, get))}
            idPrefix="intake"
            display={display}
          />
        ))}
      </div>

      <ScreenNotes screen={screen} get={get} />

      {alert.length > 0 && (
        // Dark mode's --destructive is a deep red (about 1.8:1 on the page
        // background), so the message text switches to foreground there and
        // the red stays on the border, tint, and icon.
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-negative dark:border-destructive dark:bg-destructive/25 dark:text-foreground"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{alert.join(' ')}</span>
        </p>
      )}

      {/* Sticky on phones so the primary action stays under the thumb. Two
          actions on every screen: Skip, and Next (Finish on the last); in
          single-screen mode, Cancel and Save. */}
      <div
        className={cn(
          'sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur-sm',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          'md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none'
        )}
      >
        <div className="mb-1 flex items-center">
          {single ? (
            <Link href={reviewTopicReturnHref(screen.id) as Route} className={cn(SKIP_BUTTON_CLASS, 'inline-flex items-center')}>
              Cancel
            </Link>
          ) : (
            <button type="button" onClick={skip} disabled={submitting} className={SKIP_BUTTON_CLASS}>
              Skip
            </button>
          )}
        </div>
        <Button type="submit" disabled={submitting} className="h-12 w-full text-base">
          {single ? (
            submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Saving
              </>
            ) : (
              'Save'
            )
          ) : submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Opening
            </>
          ) : (
            <>
              {isLast ? 'Finish' : 'Next'}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

interface WizardGateProps {
  flow: IntakeFlow;
  mode: IntakeMode;
  next?: string;
  onlyScreen?: string;
  initialProfile: FinancialProfile;
}

/**
 * Decides once, from the profile as it was on arrival, whether to ask
 * anything. In 'remaining' mode an intent sends a visitor without the basics
 * to the core intake first (unless it needs none of them, O5), and any flow goes straight to its destination
 * when nothing is left to ask (so an empty wizard never renders). Frozen at
 * mount so the save on finish does not re-trigger a redirect.
 */
function WizardGate({ flow, mode, next, onlyScreen, initialProfile }: WizardGateProps) {
  const router = useRouter();
  const [profileOnArrival] = useState(initialProfile);
  const [redirect] = useState<string | null>(() => {
    if (onlyScreen !== undefined) {
      // A topic the saved answers hide (the match terms without a 401(k))
      // has nothing to edit: back to the review list.
      const shown = getIntakeScreens(flow, makeGet(profileOnArrival), { mode });
      return shown.some((screen) => screen.id === onlyScreen) ? null : REVIEW_PATH;
    }
    if (mode !== 'remaining') return null;
    if (flow !== 'core' && intentNeedsCore(flow) && !isCoreReady(profileOnArrival)) return coreStartLink(flow);
    const screens = getIntakeScreens(flow, makeGet(profileOnArrival), {
      mode,
      provided: profileOnArrival.provided,
    });
    return screens.length === 0 ? destinationFor(flow, profileOnArrival, next) : null;
  });

  useEffect(() => {
    if (redirect) router.replace(redirect as Route);
  }, [redirect, router]);

  if (redirect) return <WizardSkeleton />;
  return <WizardFlow flow={flow} mode={mode} next={next} onlyScreen={onlyScreen} initialProfile={profileOnArrival} />;
}

/**
 * Intake wizard. Runs the flow's FormSpec (lib/constants/intake.ts) one
 * topic screen at a time over a working copy of the persisted profile, taken
 * once the store has hydrated (a skeleton renders until then so server and
 * client markup match). After every Next and Skip it saves the answered
 * screens and the form's derived values to the profile. The core flow then continues to the chosen intent or the
 * "What do you want to learn?" chooser; an intent opens the matching
 * calculator at its `?from=profile` handoff link (or the overview for 'profile'),
 * replacing its own history entry so Back returns to the chooser. In
 * single-screen mode (`onlyScreen`, the /start/review/<id> page) it asks that
 * one screen and Save returns to the review page.
 */
export function Wizard({ flow, mode, next, onlyScreen }: WizardProps) {
  const hasHydrated = useProfileStore((state) => state.hasHydrated);
  const profile = useProfileStore((state) => state.profile);
  // Single-screen mode always asks its screen, answered or not.
  const resolvedMode = onlyScreen !== undefined ? 'all' : resolveMode(flow, mode);
  const nextIntent = flow === 'core' && next && isIntakeIntent(next) ? next : undefined;

  return (
    <div className="space-y-6">
      <WizardHeader flow={flow} next={nextIntent} onlyScreen={onlyScreen} />
      {hasHydrated ? (
        <WizardGate
          key={`${flow}:${resolvedMode}:${nextIntent ?? ''}:${onlyScreen ?? ''}`}
          flow={flow}
          mode={resolvedMode}
          next={nextIntent}
          onlyScreen={onlyScreen}
          initialProfile={profile}
        />
      ) : (
        <WizardSkeleton />
      )}
    </div>
  );
}

export default Wizard;
