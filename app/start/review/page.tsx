import type { Metadata } from 'next';
import { Wizard } from '@/components/guided/Wizard';

export const metadata: Metadata = {
  title: 'Review your answers',
  description:
    'Step through every profile question with your saved answers filled in, change any of them, and return to your overview. Runs in your browser.',
  // A step in the guided flow, not a landing page worth indexing.
  robots: { index: false, follow: true },
};

/**
 * The one place that re-asks every profile question, prefilled. The guided
 * flow otherwise asks only what is still unanswered, so without this page a
 * saved non-core answer could not be changed.
 */
export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-xl pt-2 md:pt-8">
      <Wizard flow="profile" mode="all" />
    </div>
  );
}
