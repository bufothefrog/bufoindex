import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { UtilityBar } from '@/components/shared/UtilityBar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bufo Index - Personal Finance Optimization',
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
