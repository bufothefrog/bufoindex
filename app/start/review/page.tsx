import type { Metadata } from 'next';
import { ProfileReview } from '@/components/guided/ProfileReview';

export const metadata: Metadata = {
  title: 'Review your answers',
  description:
    'Every saved profile answer at a glance, one line per topic, with a link to change any topic. Runs in your browser.',
  // A step in the guided flow, not a landing page worth indexing.
  robots: { index: false, follow: true },
};

/**
 * The saved profile at a glance: one line per topic with the answers given,
 * and a link per topic to /start/review/<topic>, the one place a saved
 * non-core answer can be changed outside a calculator page.
 */
export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-xl pt-2 md:pt-8">
      <ProfileReview />
    </div>
  );
}
