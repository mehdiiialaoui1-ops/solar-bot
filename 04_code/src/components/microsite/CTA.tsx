/**
 * Call-to-action final - prise de RDV.
 */

import { couleurs, containerStyle } from './styles'
import type { MicrositeData } from '@/lib/microsite/mock-data'

export interface CTAProps {
  data: MicrositeData
}

export function CTA({ data }: CTAProps) {
  return (
    <section
      style={{
        background: `linear-gradient(135deg, ${couleurs.primaire} 0%, ${couleurs.primaireSombre} 100%)`,
        color: '#fff',
        padding: '72px 0',
      }}
    >
      <div style={{ ...containerStyle, textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 16,
            maxWidth: 720,
            margin: '0 auto 16px',
          }}
        >
          Discutons concrètement de votre projet en 15 minutes
        </h2>
        <p
          style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.6,
            maxWidth: 600,
            margin: '0 auto 32px',
          }}
        >
          Un échange de 15 minutes, sans engagement, pour valider
          ces résultats et répondre à vos questions.
        </p>
        <a
          href={data.cta.rdv_url}
          style={{
            display: 'inline-block',
            background: couleurs.accent,
            color: couleurs.primaireSombre,
            padding: '16px 40px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 16,
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(244,168,58,0.3)',
          }}
        >
          Réserver mon créneau
        </a>
        <p
          style={{
            marginTop: 24,
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          {data.decideur.prenom}, vous pouvez également répondre directement à
          l&apos;email — un expert vous rappellera dans la journée.
        </p>
      </div>
    </section>
  )
}
