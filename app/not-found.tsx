import Link from 'next/link';
import type { Route } from 'next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CALCULATOR_LIST } from '@/lib/calculators/registry';

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
            <ul className="space-y-1 text-sm">
              <li>
                <Link href="/" className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">
                  Home
                </Link>
              </li>
              {CALCULATOR_LIST.map((calculator) => (
                <li key={calculator.id}>
                  <Link
                    href={calculator.path as Route}
                    className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
                  >
                    {calculator.shortTitle}
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
