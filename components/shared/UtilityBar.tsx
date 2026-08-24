'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function UtilityBar() {
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <div className="flex items-center justify-between h-10">
      <div>
        {!isHome && (
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Link>
        )}
      </div>
      <ThemeToggle />
    </div>
  );
}
