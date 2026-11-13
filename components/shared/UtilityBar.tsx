'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CALCULATOR_IDS, CALCULATORS, calculatorHref } from '@/lib/calculators/registry';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
}

const OVERVIEW: NavItem = { href: '/overview', label: 'Overview' };

/** The calculators, in registry order, by their short names and bare paths. */
const CALCULATOR_ITEMS: readonly NavItem[] = CALCULATOR_IDS.map((id) => ({
  href: calculatorHref(id),
  label: CALCULATORS[id].shortTitle,
}));

/**
 * "page" on the link's own route; "true" on a page below it (the retirement
 * methodology marks the Retirement Calculator), so the section still reads as
 * current without claiming to be the page itself.
 */
function currentFor(pathname: string, href: string): 'page' | 'true' | undefined {
  if (pathname === href) return 'page';
  if (href !== '/' && pathname.startsWith(`${href}/`)) return 'true';
  return undefined;
}

const LINK =
  'inline-flex min-h-10 items-center whitespace-nowrap rounded-md px-1.5 text-sm sm:px-2 text-muted-foreground transition-colors ' +
  'hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ' +
  'aria-[current]:font-medium aria-[current]:text-foreground';

/**
 * The bar at the top of every route (app/layout.tsx): the site name as the
 * way home, a site navigation with Overview and the four calculators, and the
 * theme toggle. From lg up the calculators sit inline; below that they
 * collapse into one "Calculators" disclosure button that opens a list. The
 * list closes on Escape (focus returns to the button), on choosing a link and
 * on a click or tap outside it.
 */
export function UtilityBar() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  // Close the list when the route changes by any other way (back button, a
  // link elsewhere on the page): adjust state during render, not in an effect.
  const [openedOn, setOpenedOn] = useState(pathname);
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    setOpen(false);
  }
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (target && containerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const currentCalculator = CALCULATOR_ITEMS.find((item) => currentFor(pathname, item.href) !== undefined);
  const onCalculatorPage = currentCalculator !== undefined;

  return (
    <header className="flex min-h-12 items-center justify-between gap-2">
      <Link
        href="/"
        aria-current={pathname === '/' ? 'page' : undefined}
        className="inline-flex min-h-10 shrink-0 items-center rounded-md text-base font-semibold tracking-tight text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        BufoIndex
      </Link>

      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <nav aria-label="Site" className="flex min-w-0 items-center">
          <ul className="flex items-center gap-0.5 sm:gap-1">
            <li>
              <Link href={OVERVIEW.href as Route} aria-current={currentFor(pathname, OVERVIEW.href)} className={LINK}>
                {OVERVIEW.label}
              </Link>
            </li>
            {CALCULATOR_ITEMS.map((item) => (
              <li key={item.href} className="hidden lg:block">
                <Link href={item.href as Route} aria-current={currentFor(pathname, item.href)} className={LINK}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="lg:hidden">
              <div ref={containerRef} className="relative">
                <button
                  ref={buttonRef}
                  type="button"
                  aria-expanded={open}
                  aria-controls={menuId}
                  onClick={() => setOpen((value) => !value)}
                  className={cn(
                    LINK,
                    'gap-1',
                    onCalculatorPage && 'font-medium text-foreground'
                  )}
                >
                  Calculators
                  {/* Below lg the inline links (and their aria-current) are
                      hidden, so the button names the current calculator. */}
                  {currentCalculator && <span className="sr-only">, current: {currentCalculator.label}</span>}
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>
                {open && (
                  <ul
                    id={menuId}
                    className="absolute right-0 top-full z-50 mt-1 w-60 max-w-[calc(100vw-2rem)] space-y-0.5 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
                  >
                    {CALCULATOR_ITEMS.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href as Route}
                          aria-current={currentFor(pathname, item.href)}
                          onClick={() => setOpen(false)}
                          className={cn(LINK, 'min-h-11 w-full px-3 hover:bg-accent aria-[current]:bg-accent')}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          </ul>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}

export default UtilityBar;
