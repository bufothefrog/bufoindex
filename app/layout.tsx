import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { UtilityBar } from '@/components/shared/UtilityBar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://bufoindex.com'),
  title: {
    template: '%s | BufoIndex',
    default: 'BufoIndex',
  },
  description:
    'Interactive personal-finance calculators: paycheck allocation, Monte Carlo retirement modeling, and portfolio rebalancing. Client-side, shareable by URL.',
  openGraph: {
    siteName: 'BufoIndex',
    type: 'website',
    url: 'https://bufoindex.com',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 pt-3">
              <UtilityBar />
            </div>

            <main className="container mx-auto px-4 pt-2 pb-8">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
