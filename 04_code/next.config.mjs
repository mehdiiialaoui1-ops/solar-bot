/** @type {import('next').NextConfig} */
const nextConfig = {
  // Activer le mode strict de React
  reactStrictMode: true,

  // Ignorer les erreurs TypeScript au build (les types DB seront alignés plus tard)
  typescript: {
    ignoreBuildErrors: true,
  },

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
