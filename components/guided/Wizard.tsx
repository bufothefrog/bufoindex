'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { AlertTriangle, ArrowRight, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  INTAKE_SECTION_LABELS,
  buildIntakeSubmission,
  coreDestination,
  coreStartLink,
  getIntakeScreens,
  getLearnOption,
  isCoreComplete,
  isIntakeIntent,
  validateIntakeScreen,
  type IntakeFlow,
  type IntakeIntent,
  type IntakeMode,
  type IntakeOptionValue,
  type IntakeScreen,
  type IntakeValueGetter,
} from '@/lib/constants/intake';
import { PROFILE_FIELDS, getProfileValue } from '@/lib/profile/defaults';
import { leverageLink, paycheckLink, portfolioLink, retirementLink } from '@/lib/profile/links';
import type { FinancialProfile } from '@/lib/profile/types';
import { useProfileStore } from '@/lib/store/profileStore';
import { cn } from '@/lib/utils';
import { ProgressDots } from './ProgressDots';
import { WizardStep } from './WizardStep';

export interface WizardProps {
  /** 'core' asks the shared basics; an intent asks that intent's questions. */
  flow: IntakeFlow;
  /**
   * 'all' asks every question in the flow; 'remaining' skips what the saved
   * profile already answers (and, for an intent, the core). Defaults to
   * 'all' for the core and 'remaining' for intents.
   */
  mode?: IntakeMode;
  /** Core flow only: the intent to continue to (an IntakeIntent); otherwise the chooser. */
  next?: string;
}

type Answers = Record<string, unknown>;

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

const CALCULATOR_LINKS: Record<Exclude<IntakeIntent, 'profile'>, (profile: FinancialProfile) => string> = {
  paycheck: paycheckLink,
  retirement: retirementLink,
  portfolio: portfolioLink,
  leverage: leverageLink,
};

/** Where an intent's intake leads: the seeded calculator, or the overview for 'profile'. */
export function intentDestination(intent: IntakeIntent, profile: FinancialProfile): string {
  return intent === 'profile' ? '/overview' : CALCULATOR_LINKS[intent](profile);
}

function destinationFor(flow: IntakeFlow, profile: FinancialProfile, next?: string): string {
  return flow === 'core' ? coreDestination(next) : intentDestination(flow, profile);
}

function resolveMode(flow: IntakeFlow, mode?: IntakeMode): IntakeMode {
  return mode ?? (flow === 'core' ? 'all' : 'remaining');
}

/** Every profile leaf, so cross-field checks see the full picture. */
function seedAnswers(profile: FinancialProfile): Answers {
  const answers: Answers = {};
  for (const field of PROFILE_FIELDS) answers[field.path] = getProfileValue(profile, field.path);
  return answers;
}

function screenPaths(screen: IntakeScreen): string[] {
  return screen.questions.map((question) => question.path);
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
          : 'Just the questions this calculator still needs.'
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

interface WizardFlowProps {
  flow: IntakeFlow;
  mode: IntakeMode;
  next?: string;
  initialProfile: FinancialProfile;
}

function WizardFlow({ flow, mode, next, initialProfile }: WizardFlowProps) {
  const router = useRouter();
  const setFields = useProfileStore((state) => state.setFields);

  const [seed] = useState<Answers>(() => seedAnswers(initialProfile));
  const [answers, setAnswers] = useState<Answers>(seed);
  const [provided, setProvided] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  // 'remaining' mode filters on what the profile held when the flow opened,
  // not on answers given here (or saved on finish), so screens do not vanish
  // mid-flow.
  const [initiallyProvided] = useState<readonly string[]>(() => initialProfile.provided);
  const screensFor = (getValue: IntakeValueGetter) =>
    getIntakeScreens(flow, getValue, { mode, provided: initiallyProvided });

  const screens = useMemo(
    () => getIntakeScreens(flow, (path) => answers[path], { mode, provided: initiallyProvided }),
    [flow, mode, initiallyProvided, answers]
  );
  const step = Math.min(index, screens.length - 1);
  const screen = screens[step];
  const isLast = step === screens.length - 1;
  const isProfileIntent = flow === 'profile';
  // Returning visitors reach the core again through the landing-page cards;
  // their saved basics are prefilled, and they can keep them as they are.
  const coreSavedOnArrival = flow === 'core' && isCoreComplete(initialProfile);
  const screenIsPlaceholder = screenPaths(screen).every(
    (path) => !initiallyProvided.includes(path) && !provided.includes(path)
  );

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

  const finish = (finalAnswers: Answers, finalProvided: string[]) => {
    const alreadyProvided = useProfileStore.getState().profile.provided;
    const { patch, providedPaths } = buildIntakeSubmission(finalAnswers, finalProvided, alreadyProvided);
    setFields(patch, providedPaths);
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

  const advance = (overrides?: Answers) => {
    if (submitting) return;
    const nextAnswers = overrides ? { ...answers, ...overrides } : answers;
    const nextScreens = overrides ? screensFor((path) => nextAnswers[path]) : screens;
    const current = nextScreens[Math.min(step, nextScreens.length - 1)];

    const issue = validateIntakeScreen(current.questions, (path) => nextAnswers[path]);
    if (issue) {
      if (overrides) setAnswers(nextAnswers);
      setError(issue);
      return;
    }

    const nextProvided = Array.from(new Set([...provided, ...screenPaths(current)]));
    if (overrides) setAnswers(nextAnswers);
    setProvided(nextProvided);
    setError(null);

    if (step >= nextScreens.length - 1) finish(nextAnswers, nextProvided);
    else setIndex(step + 1);
  };

  /** Restore the given paths to their starting values and unmark them. */
  const revert = (paths: string[]) => {
    const reverted = { ...answers };
    for (const path of paths) reverted[path] = seed[path];
    const remaining = provided.filter((path) => !paths.includes(path));
    return { reverted, remaining };
  };

  const skip = () => {
    if (submitting) return;
    const { reverted, remaining } = revert(screenPaths(screen));
    setAnswers(reverted);
    setProvided(remaining);
    setError(null);
    const nextScreens = screensFor((path) => reverted[path]);
    if (step >= nextScreens.length - 1) finish(reverted, remaining);
    else setIndex(step + 1);
  };

  const skipSection = () => {
    if (submitting) return;
    const section = screen.section;
    const sectionPaths = screens
      .slice(step)
      .filter((s) => s.section === section)
      .flatMap(screenPaths);
    const { reverted, remaining } = revert(sectionPaths);
    setAnswers(reverted);
    setProvided(remaining);
    setError(null);
    const nextScreens = screensFor((path) => reverted[path]);
    const nextIndex = nextScreens.findIndex((s, i) => i > step && s.section !== section);
    if (nextIndex < 0) finish(reverted, remaining);
    else setIndex(nextIndex);
  };

  const back = () => {
    setError(null);
    setIndex(Math.max(0, step - 1));
  };

  const setValue = (path: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [path]: value }));
    setError(null);
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

  const singleQuestion = screen.questions.length === 1;
  const showSectionSkip =
    isProfileIntent && screen.section !== 'core' && screens.slice(step + 1).some((s) => s.section === screen.section);
  const sectionLabel = isProfileIntent ? INTAKE_SECTION_LABELS[screen.section] : undefined;
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
          {screen.title}
        </h2>
        {screen.description && <p className="text-sm text-muted-foreground">{screen.description}</p>}
        {screenIsPlaceholder && (
          <p className="text-xs text-muted-foreground">
            Filled in with a typical value. Replace it with yours, or skip.
          </p>
        )}
      </div>

      <div className="space-y-5">
        {screen.questions.map((question) => (
          <WizardStep
            key={question.id}
            question={question}
            value={answers[question.path]}
            onChange={(value) => setValue(question.path, value)}
            onChooseAndAdvance={(value: IntakeOptionValue) => advance({ [question.path]: value })}
            hideLabel={singleQuestion}
          />
        ))}
      </div>

      {error && (
        // Dark mode's --destructive is a deep red (about 1.8:1 on the page
        // background), so the message text switches to foreground there and
        // the red stays on the border, tint, and icon.
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:border-destructive dark:bg-destructive/25 dark:text-foreground"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {isLast && (
        <p className="text-sm text-muted-foreground">
          {flow === 'core'
            ? 'Good enough to start. You can edit the basics later.'
            : isProfileIntent
              ? 'Good enough to start. You can refine the details from your overview.'
              : 'Good enough to start. You can refine the details on the calculator.'}
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
          <button
            type="button"
            onClick={skip}
            disabled={submitting}
            className="min-h-11 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          >
            {screen.questions[0].skipLabel ?? 'Skip'}
          </button>
          {showSectionSkip && (
            <button
              type="button"
              onClick={skipSection}
              disabled={submitting}
              className="min-h-11 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
            >
              Skip the rest of this section
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
 * to the core intake first, and any flow goes straight to its destination
 * when nothing is left to ask (so an empty wizard never renders). Frozen at
 * mount so the save on finish does not re-trigger a redirect.
 */
function WizardGate({ flow, mode, next, initialProfile }: WizardGateProps) {
  const router = useRouter();
  const [profileOnArrival] = useState(initialProfile);
  const [redirect] = useState<string | null>(() => {
    if (mode !== 'remaining') return null;
    if (flow !== 'core' && !isCoreReady(profileOnArrival)) return coreStartLink(flow);
    const seed = seedAnswers(profileOnArrival);
    const screens = getIntakeScreens(flow, (path) => seed[path], {
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
 * Intake wizard. Seeds its answers from the persisted profile once the store
 * has hydrated (rendering a skeleton until then so server and client markup
 * match), asks one screen at a time, and on finish writes the answers to the
 * profile. The core flow then continues to the chosen intent or the
 * "What do you want to learn?" chooser; an intent opens the matching
 * calculator through its URL-hash deep link (or the overview for 'profile'),
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
