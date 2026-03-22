import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BufoIndex - Personal Finance Optimization',
  description: 'For Those Who Want Financial Control, Not Financial Comfort',
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
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container mx-auto px-4 py-3">
                <nav className="flex items-center justify-between">
                  <Link href="/" className="text-xl font-semibold hover:text-sage-600 dark:hover:text-sage-300 transition-colors">
                    BufoIndex
                  </Link>
                  <ThemeToggle />
                </nav>
              </div>
            </header>
          
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
          
          <footer className="border-t bg-muted/50 mt-16">
            <div className="container mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
              Not investment advice.
            </div>
          </footer>
        </div>
        </ThemeProvider>
      </body>
    </html>
  )
}