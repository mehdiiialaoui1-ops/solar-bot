import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Activer le mode strict de React
  reactStrictMode: true,

  // Variables d'environnement exposées côté client
  env: {
    NEXT_PUBLIC_APP_NAME: 'ERE Solar Bot',
    NEXT_PUBLIC_APP_VERSION: '0.1.0',
  },

  // Headers de sécurité
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
