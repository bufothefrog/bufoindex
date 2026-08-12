import type { Metadata } from 'next';
import { DemoClient } from './DemoClient';

export const metadata: Metadata = {
  title: 'Component Gallery',
  description:
    'Visual catalog of the reusable UI components used across BufoIndex calculators.',
};

export default function DemoPage() {
  return <DemoClient />;
}
