import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

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
              <li>
                <Link
                  href="/tools/paycheck-allocator"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Paycheck Allocator
                </Link>
              </li>
              <li>
                <Link
                  href="/tools/retirement-calculator"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Retirement Calculator
                </Link>
              </li>
              <li>
                <Link
                  href="/tools/portfolio-rebalancing-calculator"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Portfolio Rebalancer
                </Link>
              </li>
            </ul>
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
