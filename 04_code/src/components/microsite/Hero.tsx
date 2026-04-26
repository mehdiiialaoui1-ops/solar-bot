/**
 * Hero du microsite - bandeau d'accroche personnalise pour le decideur.
 */

import { couleurs, containerStyle } from './styles'
import type { MicrositeData } from '@/lib/microsite/mock-data'

export interface HeroProps {
  data: MicrositeData
}

export function Hero({ data }: HeroProps) {
  const { prospect, decideur } = data

  return (
    <section
      style={{
        background: `linear-gradient(135deg, ${couleurs.primaire} 0%, ${couleurs.primaireSombre} 100%)`,
        color: '#fff',
        padding: '72px 0 88px',
      }}
    >
      <div style={containerStyle}>
        <p
          style={{
            color: couleurs.accent,
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginBottom: 16,
          }}
        >
          Étude solaire personnalisée — {prospect.commune}
        </p>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 20,
            maxWidth: 800,
          }}
        >
          {decideur.prenom} {decideur.nom}, votre toiture peut produire
          de l&apos;électricité solaire dès cette année.
        </h1>
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.85)',
            maxWidth: 720,
          }}
        >
          Bâtiment <strong>{prospect.raison_sociale}</strong> au{' '}
          {prospect.adresse}, {prospect.code_postal} {prospect.commune} —{' '}
          {prospect.surface_m2.toLocaleString('fr-FR')} m² d&apos;activité
          {prospect.annee_construction
            ? `, construit en ${prospect.annee_construction}`
            : ''}
          .
        </p>
        {(data.obligations.aper || data.obligations.decret_tertiaire) && (
          <div
            style={{
              marginTop: 32,
              display: 'inline-flex',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {data.obligations.aper && (
              <span
                style={{
                  background: couleurs.accent,
                  color: couleurs.primaireSombre,
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                ⚡ Concerné par la loi APER
              </span>
            )}
            {data.obligations.decret_tertiaire && (
              <span
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                📊 Décret Tertiaire palier 2030
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
