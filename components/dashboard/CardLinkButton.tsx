import React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CardLinkButtonProps<T extends string = string> {
  /** Hash or query-string links are built as strings; cast them with `as Route`. */
  href: Route<T>;
  children: React.ReactNode;
  variant?: 'default' | 'outline';
  className?: string;
}

/**
 * Full-width (on phones) link styled as a 44px-tall button, used for each
 * card's "open the calculator" action.
 */
export function CardLinkButton<T extends string>({
  href,
  children,
  variant = 'outline',
  className,
}: CardLinkButtonProps<T>) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size: 'lg' }), 'w-full px-4 sm:w-auto', className)}
    >
      <span>{children}</span>
      <ArrowRight className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}

export default CardLinkButton;
