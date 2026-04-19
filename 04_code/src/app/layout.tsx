import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ERE Solar Bot — Pipeline Solarisation Tertiaire',
  description:
    'Outil de prospection automatisée pour la solarisation de bâtiments tertiaires et industriels.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
