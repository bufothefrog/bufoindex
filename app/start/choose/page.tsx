import type { Metadata } from 'next';
import { LearnChooser } from '@/components/guided/LearnChooser';

export const metadata: Metadata = {
  title: 'What do you want to learn?',
  description:
    'Pick a calculator or finish your profile. Each one asks only the questions it still needs, then opens with your answers. Runs in your browser.',
  // A step in the guided flow, not a landing page worth indexing.
  robots: { index: false, follow: true },
};

export default function ChoosePage() {
  return (
    <div className="mx-auto max-w-3xl pt-2 md:pt-8">
      <LearnChooser />
    </div>
  );
}
