import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CoreStartWizard } from '@/components/guided/CoreStartWizard';
import { WizardPlaceholder } from '@/components/guided/Wizard';

export const metadata: Metadata = {
  title: 'A few basics',
  description:
    'Age, state, filing status, pay, and must-pay costs: a few quick questions every calculator shares, so you answer them once. Runs in your browser.',
  // A step in the guided flow, not a landing page worth indexing.
  robots: { index: false, follow: true },
};

/**
 * The shared core intake, prerendered as a static page. `?next=<intent>`
 * continues to that intent's remaining questions afterwards; without it (or
 * with an unknown value) the flow continues to the /start/choose chooser.
 * The query is read on the client inside the Suspense boundary, so the
 * prerendered HTML is the header and the first screen's skeleton.
 */
export default function CoreStartPage() {
  return (
    <div className="mx-auto max-w-xl pt-2 md:pt-8">
      <Suspense fallback={<WizardPlaceholder flow="core" />}>
        <CoreStartWizard />
      </Suspense>
    </div>
  );
}
