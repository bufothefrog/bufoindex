import type { Route } from 'next';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CALCULATORS } from '@/lib/calculators/registry';
import type { CalculatorId } from '@/lib/calculators/types';

/** The calculators this page links to. */
const NOT_FOUND_CALCULATORS: readonly CalculatorId[] = ['paycheck', 'retirement', 'portfolio'];

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <Card>
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            The page you requested does not exist. It may have moved, or the URL may be mistyped.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <nav aria-label="Site pages">
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-primary underline-offset-4 hover:underline">
                  Home
                </Link>
              </li>
              {NOT_FOUND_CALCULATORS.map((id) => (
                <li key={id}>
                  <Link
                    href={CALCULATORS[id].path as Route}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {CALCULATORS[id].shortTitle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
