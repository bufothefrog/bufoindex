import type { Metadata } from 'next';
import { DemoClient } from './DemoClient';

export const metadata: Metadata = {
  title: 'Component Gallery',
  description:
    'Visual catalog of the reusable UI components used across BufoIndex calculators.',
  // A developer surface: reachable, but kept out of search results.
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoClient />;
}
