'use client';

import React, { useState } from 'react';
import { Calculator, Compass, User } from 'lucide-react';
import { CoreSummary } from '@/components/guided/CoreSummary';
import { NextSteps } from '@/components/guided/NextSteps';
import { OptionCard } from '@/components/guided/OptionCard';
import { ProgressDots } from '@/components/guided/ProgressDots';
import { CalculatorLinks } from '@/components/shared/CalculatorLinks';
import { CORE_PATHS } from '@/lib/constants/intake';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { Code, DemoBlock, DemoEntry, DemoSection } from './DemoBlock';

// The default profile with every core answer marked as saved, so the summary
// shows the full one-line recap.
const DEMO_CORE_PROFILE = { ...getDefaultFinancialProfile(), provided: [...CORE_PATHS] };

type Preset = 'standard' | 'cashflow-investor';

export function GuidedSection() {
  const [preset, setPreset] = useState<Preset>('cashflow-investor');

  return (
    <DemoSection title="Guided flow" intro="The intake wizard, the chooser and the post-results card are built from these.">
      <DemoBlock title="Guided-flow widgets" icon={Compass}>
        <DemoEntry
          name="OptionCard"
          description="Link mode (default and emphasis tones) and radio mode, which ChoiceGroup builds on. Minimum height 64px."
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
          <div className="mt-4 max-w-xl space-y-2" role="radiogroup" aria-label="Strategy preset (demo)">
            <OptionCard
              title="Standard"
              description="About 3 months of must-pay costs in cash."
              selected={preset === 'standard'}
              onSelect={() => setPreset('standard')}
              tabIndex={preset === 'standard' ? 0 : -1}
            />
            <OptionCard
              title="Cash-flow investor"
              description="About 1 month of must-pay costs in cash."
              selected={preset === 'cashflow-investor'}
              onSelect={() => setPreset('cashflow-investor')}
              tabIndex={preset === 'cashflow-investor' ? 0 : -1}
            />
          </div>
        </DemoEntry>
        <DemoEntry name="ProgressDots" description="The wizard's step indicator, with an optional section label.">
          <ProgressDots total={6} current={2} label="Retirement" />
        </DemoEntry>
        <DemoEntry
          name="NextSteps"
          description={<>The &quot;What next?&quot; card CalculatorPage passes to CalculatorLayout as <Code>resultFooter</Code>. It reflects this browser&apos;s saved profile and renders after hydration.</>}
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
      </DemoBlock>
    </DemoSection>
  );
}

export default GuidedSection;
