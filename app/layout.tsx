import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Knights Player Reports',
  description: 'Lone Peak Knights - Player Film Reports',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: '#121212', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}