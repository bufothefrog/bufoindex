import Link from 'next/link';
import { DemoClient } from './DemoClient';

function isDemoEnabled() {
  if (process.env.VERCEL_ENV === 'production') return false;
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.ENABLE_DEMO === 'true';
}

export default function DemoPage() {
  if (!isDemoEnabled()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Page Not Available</h1>
          <p className="text-muted-foreground mb-6">
            This demo page is only available in development mode.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return <DemoClient />;
}
