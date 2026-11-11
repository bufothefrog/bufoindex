import type { Metadata } from 'next';
import { Wizard } from '@/components/guided/Wizard';
import { isIntakeIntent } from '@/lib/constants/intake';

interface CoreStartPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: 'A few basics',
  description:
    'Age, state, filing status, pay, and must-pay costs: a few quick questions every calculator shares, so you answer them once. Runs in your browser.',
  // A step in the guided flow, not a landing page worth indexing.
  robots: { index: false, follow: true },
};

/**
 * The shared core intake. `?next=<intent>` continues to that intent's
 * remaining questions afterwards; without it (or with an unknown value) the
 * flow continues to the /start/choose chooser.
 */
export default async function CoreStartPage({ searchParams }: CoreStartPageProps) {
  const { next } = await searchParams;
  const raw = Array.isArray(next) ? next[0] : next;
  const nextIntent = raw && isIntakeIntent(raw) ? raw : undefined;

  return (
    <div className="mx-auto max-w-xl pt-2 md:pt-8">
      <Wizard flow="core" next={nextIntent} />
    </div>
  );
}
