'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Route } from 'next';

interface Breadcrumb {
  name: string;
  href: Route;
  showArrow: boolean;
}

export function Navigation() {
  const pathname = usePathname();
  
  // Don't show navigation on home page
  if (pathname === '/') {
    return null;
  }

  // Generate breadcrumbs based on pathname
  const generateBreadcrumbs = (): Breadcrumb[] => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: Breadcrumb[] = [];

    // Always start with Home
    breadcrumbs.push({
      name: 'Back to Home',
      href: '/' as Route,
      showArrow: true
    });

    // Add current page
    if (segments.length >= 2) {
      const toolName = segments[segments.length - 1]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      breadcrumbs.push({
        name: toolName,
        href: pathname as Route,
        showArrow: false
      });
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center space-x-4 mt-3 pt-3 border-t border-gray-200/50">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center">
          {index > 0 && (
            <div className="w-1 h-4 bg-border mr-4"></div>
          )}
          {crumb.showArrow ? (
            <Link 
              href={crumb.href}
              className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {crumb.name}
            </Link>
          ) : (
            <span className="text-sm font-medium">
              {crumb.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}