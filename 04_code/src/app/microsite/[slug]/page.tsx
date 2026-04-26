/**
 * Route dynamique microsite - /microsite/[slug]
 *
 * Squelette J6 alimente par des donnees mockees. Sera branche sur
 * la table `microsites` (jointures prospects + calculs_solaires)
 * apres le merge J2.
 */

import { notFound } from 'next/navigation'
import { getMicrositeData } from '@/lib/microsite/mock-data'
import { Hero } from '@/components/microsite/Hero'
import { SystemeSolaire } from '@/components/microsite/SystemeSolaire'
import { Aides } from '@/components/microsite/Aides'
import { CTA } from '@/components/microsite/CTA'
import { fonts } from '@/components/microsite/styles'

interface MicrositePageProps {
  params: { slug: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: MicrositePageProps) {
  const data = await getMicrositeData(params.slug)
  if (!data) return { title: 'Microsite introuvable' }
  return {
    title: `Étude solaire — ${data.prospect.raison_sociale}`,
    description: `Potentiel solaire de votre toiture ${data.prospect.adresse}, ${data.prospect.commune} : ${data.calcul_solaire.production_kwh_an.toLocaleString('fr-FR')} kWh/an estimés.`,
  }
}

export default async function MicrositePage({ params }: MicrositePageProps) {
  const data = await getMicrositeData(params.slug)
  if (!data) {
    notFound()
  }

  return (
    <main style={{ fontFamily: fonts.famille, color: '#1f2937' }}>
      <Hero data={data} />
      <SystemeSolaire data={data} />
      <Aides data={data} />
      <CTA data={data} />
      <footer
        style={{
          background: '#0f2540',
          color: 'rgba(255,255,255,0.7)',
          padding: '32px 0',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        <div>
          ERE Experts — Cabinet de conseil en architecture et bâtiment
        </div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          Données réglementaires 2026 : loi APER, décret tertiaire,
          arrêté tarifaire EDF OA. Étude indicative non contractuelle.
        </div>
        <div style={{ marginTop: 12 }}>
          <a
            href="#"
            style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }}
          >
            Mentions légales
          </a>{' '}
          ·{' '}
          <a
            href="#"
            style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }}
          >
            Politique de confidentialité
          </a>{' '}
          ·{' '}
          <a
            href="#"
            style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }}
          >
            Se désinscrire
          </a>
        </div>
      </footer>
    </main>
  )
}
