/**
 * The read-only review of the saved profile (/start/review): every profile
 * topic screen, grouped by its profile section, with a one-line summary of
 * the answers the visitor gave. Pure.
 *
 * Only answered facts appear. A value the visitor never confirmed (a
 * typical value still standing in for an answer) is never shown as theirs:
 *
 * - a topic whose every visible fact is answered shows the same summary the
 *   collapsed calculator card shows (summarizeScreen);
 * - a partly answered topic lists only its answered facts, each in the
 *   generic "Label: value" form (fallbackSummary). The hand-written
 *   summaries can read a sibling fact on the same screen (gross pay reads
 *   the pay frequency), which could still be a typical value, so they are
 *   not used there;
 * - a topic with no answered fact shows NOT_ANSWERED.
 *
 * A fact counts as answered when its own path is in profile.provided, the
 * rule profileCompleteness and the 'remaining' intake use.
 */

import { makeGet } from '@/lib/fields/paths';
import { fallbackSummary, summarizeScreen, visibleScreenFields } from '@/lib/fields/runtime';
import type { FieldSpec, FormSpec, Get, ScreenSpec } from '@/lib/fields/types';
import type { FinancialProfile } from '@/lib/profile/types';
import {
  PROFILE_FORM,
  PROFILE_FORM_SECTION_LABELS,
  intakeScreens,
  profileFormSection,
  type ProfileFormSection,
} from './forms';

/** The review page's path. */
export const REVIEW_PATH = '/start/review';

/** What a topic without any answered fact shows in place of a summary. */
export const NOT_ANSWERED = 'Not answered';

/** What an answered topic shows when none of its answers can be put in words (an object value). */
export const ANSWERED_WITHOUT_SUMMARY = 'Answered';

/**
 * The profile section whose topics are optional (the profile form puts the
 * optional screens there): an unanswered optional topic does not bring up
 * "Answer the remaining questions". The review reads optionality only here.
 */
export const OPTIONAL_SECTION: string = 'optional';

export function isOptionalSection(section: string): boolean {
  return section === OPTIONAL_SECTION;
}

/** 'unanswered': no visible fact answered; 'partial': some; 'answered': all. */
export type TopicStatus = 'unanswered' | 'partial' | 'answered';

export interface TopicReview {
  status: TopicStatus;
  /** The one-line summary of the answered facts; NOT_ANSWERED when there are none. */
  summary: string;
}

function toSet(provided: ReadonlySet<string> | readonly string[]): ReadonlySet<string> {
  return Array.isArray(provided) ? new Set(provided) : (provided as ReadonlySet<string>);
}

/** The screen's visible fields whose own path is answered, in screen order. */
export function answeredScreenFields(
  form: FormSpec,
  screen: ScreenSpec,
  get: Get,
  provided: ReadonlySet<string> | readonly string[]
): FieldSpec[] {
  const answered = toSet(provided);
  return visibleScreenFields(form, screen, get).filter((spec) => answered.has(spec.path));
}

/** The status and answered-only summary of one topic screen (the rules in this file's header). */
export function reviewTopic(
  form: FormSpec,
  screen: ScreenSpec,
  get: Get,
  provided: ReadonlySet<string> | readonly string[]
): TopicReview {
  const visible = visibleScreenFields(form, screen, get);
  const answered = answeredScreenFields(form, screen, get, provided);
  if (answered.length === 0) return { status: 'unanswered', summary: NOT_ANSWERED };

  const complete = answered.length === visible.length;
  const summary = complete
    ? summarizeScreen(form, screen, get)
    : answered
        .map((spec) => fallbackSummary(spec, get(spec.path), get))
        .filter((part): part is string => Boolean(part))
        .join(', ');
  return { status: complete ? 'answered' : 'partial', summary: summary || ANSWERED_WITHOUT_SUMMARY };
}

/** The anchor id of a topic's row on the review page. */
export function reviewTopicAnchor(screenId: string): string {
  return `topic-${screenId}`;
}

/** The review page scrolled to a topic's row (where Save and Cancel return). */
export function reviewTopicReturnHref(screenId: string): string {
  return `${REVIEW_PATH}#${reviewTopicAnchor(screenId)}`;
}

/** The single-screen edit page of a topic. */
export function reviewTopicEditHref(screenId: string): string {
  return `${REVIEW_PATH}/${screenId}`;
}

export interface ReviewTopicItem extends TopicReview {
  id: string;
  title: string;
  optional: boolean;
}

export interface ReviewGroup {
  section: ProfileFormSection;
  label: string;
  topics: ReviewTopicItem[];
}

export interface ProfileReview {
  /** One group per profile section, in profile form order. */
  groups: ReviewGroup[];
  /** Whether a non-optional topic is not fully answered (the remaining questions link shows). */
  hasUnansweredRequired: boolean;
}

/**
 * The review of a saved profile: the profile form's intake screens visible
 * for its values (the screens profileCompleteness counts, plus the optional
 * ones), grouped by section.
 */
export function profileReview(profile: FinancialProfile, form: FormSpec = PROFILE_FORM): ProfileReview {
  const get = makeGet(profile);
  const provided = new Set(profile.provided);
  const groups: ReviewGroup[] = [];

  for (const screen of intakeScreens(form, get, { mode: 'all' })) {
    const section = profileFormSection(screen.id) ?? 'core';
    let group = groups.find((candidate) => candidate.section === section);
    if (!group) {
      group = { section, label: PROFILE_FORM_SECTION_LABELS[section], topics: [] };
      groups.push(group);
    }
    group.topics.push({
      id: screen.id,
      title: screen.title,
      optional: isOptionalSection(section),
      ...reviewTopic(form, screen, get, provided),
    });
  }

  const hasUnansweredRequired = groups.some((group) =>
    group.topics.some((topic) => !topic.optional && topic.status !== 'answered')
  );
  return { groups, hasUnansweredRequired };
}

/** Whether `screenId` names a profile topic screen (the single-screen edit route accepts only these). */
export function isProfileScreenId(screenId: string, form: FormSpec = PROFILE_FORM): boolean {
  return form.screens.some((screen) => screen.id === screenId);
}

/** The profile topic screen ids, for the single-screen edit route's static params. */
export function profileScreenIds(form: FormSpec = PROFILE_FORM): string[] {
  return form.screens.map((screen) => screen.id);
}
