import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
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
              <div className="container mx-auto px-4 py-4">
                <nav className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h1 className="text-xl font-semibold">BufoIndex</h1>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-muted-foreground">
                      Financial Control, Not Financial Comfort
                    </div>
                    <ThemeToggle />
                  </div>
                </nav>
              </div>
            </header>
          
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
          
          <footer className="border-t bg-muted/50 mt-16">
            <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
              <p>BufoIndex - Educational financial optimization tools. Not investment advice.</p>
            </div>
          </footer>
        </div>
        </ThemeProvider>
      </body>
    </html>
  )
}