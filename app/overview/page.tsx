import type { Metadata } from 'next';
import OverviewDashboard from '@/components/dashboard/OverviewDashboard';

export const metadata: Metadata = {
  title: 'Your overview',
  description:
    'One screen computed from your saved profile: this paycheck’s allocation, simulated retirement odds, the cash buffer under two strategy presets, and a leverage comparison for monthly contributions.',
  robots: { index: false },
};

export default function OverviewPage() {
  return <OverviewDashboard />;
}
