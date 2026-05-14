import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LogLife — Shipping OS',
  description: 'Sistema de gestão de envios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
