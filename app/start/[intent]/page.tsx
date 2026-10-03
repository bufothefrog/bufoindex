import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Wizard } from '@/components/guided/Wizard';
import { INTAKE_INTENTS, getIntentOption, isIntakeIntent } from '@/lib/constants/intake';

interface StartPageProps {
  params: Promise<{ intent: string }>;
}

// Only the known intents exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return INTAKE_INTENTS.map((intent) => ({ intent }));
}

export async function generateMetadata({ params }: StartPageProps): Promise<Metadata> {
  const { intent } = await params;
  if (!isIntakeIntent(intent)) return {};
  const option = getIntentOption(intent);
  return {
    title: option.title,
    description: `${option.description} A few quick questions, then the calculator opens with your answers. Runs in your browser.`,
    // Intake screens are a step in a flow, not a landing page worth indexing.
    robots: { index: false, follow: true },
  };
}

export default async function StartPage({ params }: StartPageProps) {
  const { intent } = await params;
  if (!isIntakeIntent(intent)) notFound();
  const option = getIntentOption(intent);

  return (
    <div className="mx-auto max-w-xl space-y-6 pt-2 md:pt-8">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-sage-600 dark:text-sage-300">
          Guided start
        </p>
        <h1 className="text-base font-medium text-foreground">{option.title}</h1>
        <p className="text-xs text-muted-foreground">{option.resultHint}</p>
      </header>
      <Wizard intent={intent} />
    </div>
  );
}
