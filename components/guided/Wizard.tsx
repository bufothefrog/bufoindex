'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { AlertTriangle, ArrowRight, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ALL_RENDERERS, INTAKE_DESTINATION, INTAKE_PREWARM, RENDERERS } from '@/components/calculators/renderers';
import { FieldInput } from '@/components/fields/FieldInput';
import { ScreenNotes } from '@/components/fields/ScreenNotes';
import type { CustomRenderers } from '@/components/fields/types';
import { PROFILE_FORM_SECTION_LABELS, profileFormSection } from '@/lib/calculators/forms';
import {
  buildIntakeSubmission,
  coreDestination,
  coreStartLink,
  getIntakeScreens,
  getLearnOption,
  intakeForm,
  intentNeedsCore,
  isCoreComplete,
  isIntakeIntent,
  skipLabelFor,
  validateIntakeScreen,
  type IntakeFlow,
  type IntakeIntent,
  type IntakeMode,
} from '@/lib/constants/intake';
import { applyWrites, getAt, makeGet } from '@/lib/fields/paths';
import { fieldWrites, relationErrors, screenPaths, visibleScreenFields } from '@/lib/fields/runtime';
import type { FieldErrors, FieldSpec, Get, ScreenSpec, Write } from '@/lib/fields/types';
import type { FinancialProfile } from '@/lib/profile/types';
import { useProfileStore } from '@/lib/store/profileStore';
import { cn } from '@/lib/utils';
import { ProgressDots } from './ProgressDots';

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
}

// The basics can be finished with questions skipped (skipped answers keep
// their typical value and stay out of profile.provided), so a strict
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

/** True when `path` is one of `paths` or lies under one (a list row under its list). */
function isUnder(path: string, paths: readonly string[]): boolean {
  return paths.some((answered) => path === answered || path.startsWith(`${answered}.`));
}

/**
 * The paths among `writes` that are not the screen's own: a field's coupled
 * writes (onChange) to paths on no field of this screen. They are answers
 * too, so the screen saves and marks them as the calculator page would.
 */
function coupledPaths(writes: readonly Write[], own: readonly string[]): string[] {
  return writes.map((w) => w.path).filter((path) => !isUnder(path, own));
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
  mode: IntakeMode;
  next?: string;
}

/** Page heading for the flow: the basics, or the intent the visitor picked. */
function WizardHeader({ flow, mode, next }: WizardHeaderProps) {
  let title: string;
  let lead: string;
  let hint: string | undefined;

  if (flow === 'core') {
    title = 'A few basics';
    lead = 'Every calculator shares these answers, so you only give them once.';
    hint = next && isIntakeIntent(next) ? `After this: ${getLearnOption(next).title}.` : undefined;
  } else {
    const option = getLearnOption(flow);
    title = option.title;
    hint = option.resultHint;
    lead =
      mode === 'remaining'
        ? flow === 'profile'
          ? 'Just the questions your profile still needs.'
          : 'Everything this calculator uses, a few related questions per screen.'
        : option.description;
  }

  return (
    <header className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-sage-600 dark:text-sage-300">
        Guided start
      </p>
      <h1 className="text-base font-medium text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{lead}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </header>
  );
}

const SKIP_BUTTON_CLASS =
  'min-h-11 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50';

interface WizardFlowProps {
  flow: IntakeFlow;
  mode: IntakeMode;
  next?: string;
  initialProfile: FinancialProfile;
}

function WizardFlow({ flow, mode, next, initialProfile }: WizardFlowProps) {
  const router = useRouter();
  const setValues = useProfileStore((state) => state.setValues);

  // The answers are a working copy of the profile as it was on arrival;
  // fields write into it by path, so lists edit in place.
  const [seed] = useState<FinancialProfile>(initialProfile);
  const [answers, setAnswers] = useState<FinancialProfile>(seed);
  const [provided, setProvided] = useState<string[]>([]);
  // Coupled-write paths each screen touched, by screen id (see coupledPaths).
  const [coupled, setCoupled] = useState<Readonly<Record<string, readonly string[]>>>({});
  // The values each answered screen gave, by screen id: its own paths and its
  // coupled writes, as they stood when the visitor moved on from it.
  const [answered, setAnswered] = useState<Readonly<Record<string, Readonly<Record<string, unknown>>>>>({});
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  // 'remaining' mode filters on what the profile held when the flow opened,
  // not on answers given here (or saved on finish), so screens do not vanish
  // mid-flow.
  const [initiallyProvided] = useState<readonly string[]>(() => initialProfile.provided);
  const form = intakeForm(flow, mode);
  const renderers = renderersFor(flow);
  const screensAt = (values: FinancialProfile) =>
    getIntakeScreens(flow, makeGet(values), { mode, provided: initiallyProvided });

  const get = useMemo(() => makeGet(answers), [answers]);
  const arrival = useMemo(() => makeGet(seed), [seed]);
  const screens = useMemo(
    () => getIntakeScreens(flow, get, { mode, provided: initiallyProvided }),
    [flow, mode, initiallyProvided, get]
  );
  const step = Math.min(index, screens.length - 1);
  const screen = screens[step];
  const isLast = step === screens.length - 1;
  const isProfileIntent = flow === 'profile';
  // Returning visitors reach the core again through the landing-page cards;
  // their saved basics are prefilled, and they can keep them as they are.
  const coreSavedOnArrival = flow === 'core' && isCoreComplete(initialProfile);
  const paths = screenPaths(form, screen, get);
  const screenIsPlaceholder = paths.every((path) => !initiallyProvided.includes(path) && !provided.includes(path));

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

  // Start the intent's warm-up (audit H5) while the visitor answers, once,
  // when the browser is idle; an unmount before then cancels it.
  useEffect(() => {
    const prewarm = flow === 'core' || flow === 'profile' ? undefined : INTAKE_PREWARM[flow];
    return prewarm ? whenIdle(prewarm) : undefined;
  }, [flow]);

  const finish = (finalAnswers: FinancialProfile, finalProvided: string[]) => {
    const alreadyProvided = useProfileStore.getState().profile.provided;
    const { writes, providedPaths } = buildIntakeSubmission(flow, finalAnswers, finalProvided, alreadyProvided);
    setValues(writes, { provide: providedPaths });
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
    const nextAnswers = writes ? applyWrites(answers, writes) : answers;
    const nextScreens = writes ? screensAt(nextAnswers) : screens;
    const current = nextScreens[Math.min(step, nextScreens.length - 1)];
    const nextGet = makeGet(nextAnswers);

    const found = validateIntakeScreen(flow, current, nextGet);
    if (Object.keys(found).length > 0) {
      const split = splitErrors(found, relationErrors(form, nextGet, { screen: current }));
      if (writes) setAnswers(nextAnswers);
      setErrors(split.inline);
      setAlert(split.alert);
      return;
    }

    const own = screenPaths(form, current, nextGet);
    const touched = [...(coupled[current.id] ?? []), ...coupledPaths(writes ?? [], own)];
    const nextProvided = Array.from(new Set([...provided, ...own, ...touched]));
    if (writes) setAnswers(nextAnswers);
    setProvided(nextProvided);
    setAnswered((prev) => ({
      ...prev,
      [current.id]: Object.fromEntries([...own, ...touched].map((path) => [path, getAt(nextAnswers, path)])),
    }));
    clearErrors();

    if (step >= nextScreens.length - 1) finish(nextAnswers, nextProvided);
    else setIndex(step + 1);
  };

  /**
   * Restores the given screens' answers and unmarks them. A path that another
   * answered screen also gave (a coupled write over an earlier answer) goes
   * back to that screen's value and stays marked; any other path goes back to
   * its value on arrival.
   */
  const revert = (skipped: readonly ScreenSpec[]) => {
    const skippedIds = new Set(skipped.map((s) => s.id));
    const skippedPaths = skipped.flatMap((s) => [...screenPaths(form, s, get), ...(coupled[s.id] ?? [])]);
    const kept = Object.entries(answered).filter(([id]) => !skippedIds.has(id));
    const keptValue = (path: string) => {
      // The latest screen in flow order wins, as it did when it was answered.
      const order = (id: string) => screens.findIndex((s) => s.id === id);
      const holders = kept.filter(([, values]) => path in values).sort(([a], [b]) => order(a) - order(b));
      return holders.length > 0 ? { value: holders[holders.length - 1][1][path] } : undefined;
    };
    const reverted = applyWrites(
      answers,
      skippedPaths.map((path) => {
        const earlier = keptValue(path);
        return { path, value: earlier ? earlier.value : getAt(seed, path) };
      })
    );
    const remaining = provided.filter((path) => !skippedPaths.includes(path) || keptValue(path) !== undefined);
    setAnswers(reverted);
    setProvided(remaining);
    const drop = <T,>(prev: Readonly<Record<string, T>>) => {
      const next = { ...prev };
      for (const id of skippedIds) delete next[id];
      return next;
    };
    setCoupled(drop);
    setAnswered(drop);
    clearErrors();
    return { reverted, remaining };
  };

  const skip = () => {
    if (submitting) return;
    const { reverted, remaining } = revert([screen]);
    const nextScreens = screensAt(reverted);
    if (step >= nextScreens.length - 1) finish(reverted, remaining);
    else setIndex(step + 1);
  };

  const skipRest = () => {
    if (submitting) return;
    const { reverted, remaining } = revert(screens.slice(step));
    finish(reverted, remaining);
  };

  const section = isProfileIntent ? profileFormSection(screen.id) : undefined;

  const skipSection = () => {
    if (submitting) return;
    const { reverted, remaining } = revert(
      screens.slice(step).filter((s) => profileFormSection(s.id) === section)
    );
    const nextScreens = screensAt(reverted);
    const nextIndex = nextScreens.findIndex((s, i) => i > step && profileFormSection(s.id) !== section);
    if (nextIndex < 0) finish(reverted, remaining);
    else setIndex(nextIndex);
  };

  const back = () => {
    clearErrors();
    setIndex(Math.max(0, step - 1));
  };

  const write = (writes: Write[]) => {
    setAnswers((prev) => applyWrites(prev, writes));
    const extra = coupledPaths(writes, paths);
    if (extra.length > 0) {
      setCoupled((prev) => ({ ...prev, [screen.id]: Array.from(new Set([...(prev[screen.id] ?? []), ...extra])) }));
    }
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

  const fields = visibleScreenFields(form, screen, get).map((spec) => keepArrivalOption(spec, arrival));
  const singleQuestion = fields.length === 1;
  const showSectionSkip =
    section !== undefined &&
    section !== 'core' &&
    screens.slice(step + 1).some((s) => profileFormSection(s.id) === section);
  const showSkipRest = flow !== 'core' && !isLast;
  const sectionLabel = section ? PROFILE_FORM_SECTION_LABELS[section] : undefined;
  const errorId = `intake-error-${screen.id}`;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {coreSavedOnArrival && (
        <div className="flex flex-wrap items-center gap-x-3 rounded-lg border border-border bg-muted/40 px-4 py-1 text-sm">
          <span className="py-2 text-muted-foreground">Your basics are already saved.</span>
          <Link
            href={coreDestination(next) as Route}
            className="inline-flex min-h-11 items-center gap-1 font-medium text-sage-600 underline underline-offset-4 hover:text-sage-700 dark:text-sage-300 dark:hover:text-sage-200"
          >
            Keep them and continue
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="flex min-h-11 items-center gap-3">
        {/* The site-wide utility bar already links home, so the first screen
            has no previous-question control. */}
        {step > 0 && (
          <button
            type="button"
            onClick={back}
            aria-label="Previous question"
            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </button>
        )}
        <ProgressDots total={screens.length} current={step} label={sectionLabel} className="ml-auto justify-end" />
      </div>

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
        {screenIsPlaceholder && (
          <p className="text-xs text-muted-foreground">
            Filled in with a typical value. Replace it with yours, or skip.
          </p>
        )}
      </div>

      <div className="space-y-5">
        {fields.map((spec) => (
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

      {isLast && (
        <p className="text-sm text-muted-foreground">
          {flow === 'core'
            ? 'Good enough to start. You can edit the basics later.'
            : isProfileIntent
              ? 'Good enough to start. You can refine the details from your overview.'
              : 'Good enough to start. You can change any answer on the calculator.'}
        </p>
      )}

      {/* Sticky on phones so the primary action stays under the thumb. */}
      <div
        className={cn(
          'sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur-sm',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          'md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none'
        )}
      >
        {/* The skip affordances live inside the sticky bar so they are visible
            on first paint; outside it they sat under the bar until the user
            scrolled. */}
        <div className="mb-1 flex flex-wrap items-center gap-x-4">
          <button type="button" onClick={skip} disabled={submitting} className={SKIP_BUTTON_CLASS}>
            {skipLabelFor(screen)}
          </button>
          {showSectionSkip && (
            <button type="button" onClick={skipSection} disabled={submitting} className={SKIP_BUTTON_CLASS}>
              Skip the rest of this section
            </button>
          )}
          {showSkipRest && (
            <button type="button" onClick={skipRest} disabled={submitting} className={SKIP_BUTTON_CLASS}>
              Skip the rest
            </button>
          )}
        </div>
        <Button type="submit" disabled={submitting} className="h-12 w-full text-base">
          {submitting ? (
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
  initialProfile: FinancialProfile;
}

/**
 * Decides once, from the profile as it was on arrival, whether to ask
 * anything. In 'remaining' mode an intent sends a visitor without the basics
 * to the core intake first (unless it needs none of them, O5), and any flow goes straight to its destination
 * when nothing is left to ask (so an empty wizard never renders). Frozen at
 * mount so the save on finish does not re-trigger a redirect.
 */
function WizardGate({ flow, mode, next, initialProfile }: WizardGateProps) {
  const router = useRouter();
  const [profileOnArrival] = useState(initialProfile);
  const [redirect] = useState<string | null>(() => {
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
  return <WizardFlow flow={flow} mode={mode} next={next} initialProfile={profileOnArrival} />;
}

/**
 * Intake wizard. Runs the flow's FormSpec (lib/constants/intake.ts) one
 * topic screen at a time over a working copy of the persisted profile, taken
 * once the store has hydrated (a skeleton renders until then so server and
 * client markup match), and on finish writes the answered screens and the
 * form's derived values to the profile. The core flow then continues to the chosen intent or the
 * "What do you want to learn?" chooser; an intent opens the matching
 * calculator at its `?from=profile` handoff link (or the overview for 'profile'),
 * replacing its own history entry so Back returns to the chooser.
 */
export function Wizard({ flow, mode, next }: WizardProps) {
  const hasHydrated = useProfileStore((state) => state.hasHydrated);
  const profile = useProfileStore((state) => state.profile);
  const resolvedMode = resolveMode(flow, mode);
  const nextIntent = flow === 'core' && next && isIntakeIntent(next) ? next : undefined;

  return (
    <div className="space-y-6">
      <WizardHeader flow={flow} mode={resolvedMode} next={nextIntent} />
      {hasHydrated ? (
        <WizardGate
          key={`${flow}:${resolvedMode}:${nextIntent ?? ''}`}
          flow={flow}
          mode={resolvedMode}
          next={nextIntent}
          initialProfile={profile}
        />
      ) : (
        <WizardSkeleton />
      )}
    </div>
  );
}

export default Wizard;
