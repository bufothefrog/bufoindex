import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Wizard } from '@/components/guided/Wizard';
import { INTAKE_INTENTS, getLearnOption, isIntakeIntent } from '@/lib/constants/intake';

interface StartPageProps {
  params: Promise<{ intent: string }>;
}

// Only the known intents exist; anything else is a 404. The static
// /start/choose segment takes precedence over this dynamic one.
export const dynamicParams = false;

export function generateStaticParams() {
  return INTAKE_INTENTS.map((intent) => ({ intent }));
}

export async function generateMetadata({ params }: StartPageProps): Promise<Metadata> {
  const { intent } = await params;
  if (!isIntakeIntent(intent)) return {};
  const option = getLearnOption(intent);
  return {
    title: option.title,
    description: `${option.description} Only the questions not answered yet, then ${
      intent === 'profile' ? 'your overview' : 'the calculator'
    } opens with your answers. Runs in your browser.`,
    // Intake screens are a step in a flow, not a landing page worth indexing.
    robots: { index: false, follow: true },
  };
}

/**
 * One intent's remaining questions: the non-core questions the saved profile
 * does not answer yet. The wizard sends visitors without the basics to
 * /start?next=<intent> first, and goes straight to the result when nothing
 * is left to ask.
 */
export default async function StartPage({ params }: StartPageProps) {
  const { intent } = await params;
  if (!isIntakeIntent(intent)) notFound();

  return (
    <div className="mx-auto max-w-xl pt-2 md:pt-8">
      <Wizard flow={intent} mode="remaining" />
    </div>
  );
}
