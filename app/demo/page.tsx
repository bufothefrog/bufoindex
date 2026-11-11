import type { Metadata } from 'next';
import { DemoClient } from './DemoClient';

export const metadata: Metadata = {
  title: 'Component Gallery',
  description:
    'Visual catalog of the reusable UI components used across BufoIndex calculators.',
  // The gallery is a developer reference: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoClient />;
}
