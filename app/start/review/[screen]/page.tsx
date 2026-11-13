import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Wizard } from '@/components/guided/Wizard';
import { PROFILE_FORM } from '@/lib/calculators/forms';
import { isProfileScreenId, profileScreenIds } from '@/lib/calculators/profileReview';

interface ReviewScreenPageProps {
  params: Promise<{ screen: string }>;
}

// Only the profile form's topic screens exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return profileScreenIds().map((screen) => ({ screen }));
}

export async function generateMetadata({ params }: ReviewScreenPageProps): Promise<Metadata> {
  const { screen } = await params;
  const spec = PROFILE_FORM.screens.find((candidate) => candidate.id === screen);
  if (!spec) return {};
  return {
    title: `Edit: ${spec.title}`,
    description: 'Change one topic of your saved profile, then return to the review. Runs in your browser.',
    robots: { index: false, follow: true },
  };
}

/**
 * One profile topic in the wizard's own rendering (single-screen mode):
 * Save checks and saves it as Next does and returns to /start/review at that
 * topic's row; Cancel returns without saving.
 */
export default async function ReviewScreenPage({ params }: ReviewScreenPageProps) {
  const { screen } = await params;
  if (!isProfileScreenId(screen)) notFound();

  return (
    <div className="mx-auto max-w-xl pt-2 md:pt-8">
      <Wizard flow="profile" onlyScreen={screen} />
    </div>
  );
}
