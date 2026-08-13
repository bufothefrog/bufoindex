import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { UtilityBar } from '@/components/shared/UtilityBar'

const inter = Inter({ subsets: ['latin'] })

// Applies the persisted theme (same localStorage key as contexts/ThemeContext.tsx)
// before first paint so dark-preference users don't get a white flash.
const themeInitScript = `(function(){try{var t=localStorage.getItem('bufo-theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var c=document.documentElement.classList;c.remove('light','dark');c.add(d?'dark':'light');}catch(e){}})();`

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
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 pt-3">
              <UtilityBar />
            </div>

            <main id="main-content" className="container mx-auto px-4 pt-2 pb-8">
              {children}
            </main>

            <footer className="container mx-auto px-4 pb-8 text-center text-xs text-muted-foreground">
              <a
                href="https://github.com/bufothefrog/bufoindex"
                className="underline underline-offset-4 hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                Source
              </a>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>AGPL-3.0</span>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
