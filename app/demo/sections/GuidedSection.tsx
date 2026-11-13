'use client';

import React, { useState } from 'react';
import { Calculator, Compass, User } from 'lucide-react';
import { BackControl } from '@/components/guided/BackControl';
import { CoreSummary } from '@/components/guided/CoreSummary';
import { NextSteps } from '@/components/guided/NextSteps';
import { OptionCard } from '@/components/guided/OptionCard';
import { ProgressDots } from '@/components/guided/ProgressDots';
import { ReviewTopicRow } from '@/components/guided/ReviewTopicRow';
import { CalculatorLinks } from '@/components/shared/CalculatorLinks';
import { CORE_PATHS } from '@/lib/constants/intake';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { Code, DemoBlock, DemoEntry, DemoSection } from './DemoBlock';

// The default profile with every core answer marked as saved, so the summary
// shows the full one-line recap.
const DEMO_CORE_PROFILE = { ...getDefaultFinancialProfile(), provided: [...CORE_PATHS] };

type Coverage = 'individual' | 'family';

export function GuidedSection() {
  const [coverage, setCoverage] = useState<Coverage>('individual');

  return (
    <DemoSection title="Guided flow" intro="The intake wizard, the chooser and the post-results card are built from these.">
      <DemoBlock title="Guided-flow widgets" icon={Compass}>
        <DemoEntry
          name="OptionCard"
          description="Link mode (default and emphasis tones) and radio mode, which ChoiceGroup builds on; a radio card can carry a small tag (the intake's Typical). Minimum height 64px."
        >
          <div className="max-w-xl space-y-2">
            <OptionCard href="/tools" icon={Calculator} title="Link mode" description="Full-width link with an icon tile and a chevron." />
            <OptionCard
              href="/tools"
              tone="emphasis"
              icon={User}
              title="Emphasis tone"
              description="The returning visitor's 'Continue with my profile' card."
            />
          </div>
          <div className="mt-4 max-w-xl space-y-2" role="radiogroup" aria-label="HSA coverage (demo)">
            <OptionCard
              title="Individual"
              selected={coverage === 'individual'}
              onSelect={() => setCoverage('individual')}
              tabIndex={coverage === 'individual' ? 0 : -1}
              tag={{ id: 'demo-option-tag', text: 'Typical' }}
            />
            <OptionCard
              title="Family"
              selected={coverage === 'family'}
              onSelect={() => setCoverage('family')}
              tabIndex={coverage === 'family' ? 0 : -1}
            />
          </div>
        </DemoEntry>
        <DemoEntry
          name="ProgressDots and BackControl"
          description="The wizard's step indicator, with an optional section label, and the Back control beside it (absent on the first screen)."
        >
          <div className="flex min-h-11 items-center gap-3">
            <BackControl onBack={() => {}} />
            <ProgressDots total={6} current={2} label="Retirement" className="ml-auto justify-end" />
          </div>
        </DemoEntry>
        <DemoEntry
          name="NextSteps"
          description={<>The &quot;What next?&quot; card CalculatorPage passes to CalculatorLayout as <Code>resultFooter</Code>. It reflects this browser&apos;s saved profile and renders after hydration. With <Code>layout=&quot;columns&quot;</Code> (a calculator with its inputs above the results) its body sits in two columns from lg, so the full-width card keeps short lines; it needs a card as wide as the page, so it is not sampled in this narrow column (see the leverage comparison).</>}
        >
          <div className="max-w-xl">
            <NextSteps intent="paycheck" />
          </div>
        </DemoEntry>
        <DemoEntry
          name="CalculatorLinks"
          description={<>A labelled list of direct links to the calculators (bare paths from <Code>calculatorHref</Code>), built from OptionCard. The empty overview lists all four; NextSteps passes <Code>exclude</Code> to leave out the calculator it sits on, as here.</>}
        >
          <div className="max-w-xl">
            <CalculatorLinks label="Try another calculator" exclude={['paycheck']} />
          </div>
        </DemoEntry>
        <DemoEntry
          name="CoreSummary"
          description="One-line recap of the saved basics with an 'Edit the basics' link, at the top of the chooser. This sample is the default profile with every core answer marked as saved."
        >
          <div className="max-w-xl">
            <CoreSummary profile={DEMO_CORE_PROFILE} />
          </div>
        </DemoEntry>
        <DemoEntry
          name="ReviewTopicRow"
          description="One topic on the review page (/start/review): the title, a one-line summary of the answers given and a link to edit that topic alone, whose accessible name includes the topic. A topic with no answer reads 'Not answered' and its link 'Answer'."
        >
          <ul className="max-w-xl divide-y divide-border rounded-lg border border-border px-3">
            <li>
              <ReviewTopicRow
                anchorId="demo-topic-pay"
                title="What does a typical paycheck look like?"
                summary="$4,000 gross every 2 weeks, $2,550 take-home"
                status="answered"
                href="/start/review/pay"
              />
            </li>
            <li>
              <ReviewTopicRow
                anchorId="demo-topic-debts"
                title="Debts"
                summary="Not answered"
                status="unanswered"
                href="/start/review/debts"
              />
            </li>
          </ul>
        </DemoEntry>
      </DemoBlock>
    </DemoSection>
  );
}

export default GuidedSection;
