/**
 * Systeme solaire propose - chiffres cles + image satellite avec overlay.
 */

import { couleurs, containerStyle, sectionStyle } from './styles'
import type { MicrositeData } from '@/lib/microsite/mock-data'

export interface SystemeSolaireProps {
  data: MicrositeData
}

function ChiffreCle({
  valeur,
  unite,
  label,
}: {
  valeur: string
  unite: string
  label: string
}) {
  return (
    <div
      style={{
        background: couleurs.fondClair,
        padding: '24px 28px',
        borderRadius: 12,
        flex: '1 1 200px',
        minWidth: 200,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: couleurs.texteSecondaire,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: couleurs.primaire,
          }}
        >
          {valeur}
        </span>
        <span
          style={{
            fontSize: 16,
            color: couleurs.texteSecondaire,
            fontWeight: 500,
          }}
        >
          {unite}
        </span>
      </div>
    </div>
  )
}

export function SystemeSolaire({ data }: SystemeSolaireProps) {
  const c = data.calcul_solaire
  return (
    <section style={{ ...sectionStyle, background: '#fff' }}>
      <div style={containerStyle}>
        <h2
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: couleurs.texte,
            marginBottom: 12,
          }}
        >
          Le système solaire qui correspond à votre toiture
        </h2>
        <p
          style={{
            fontSize: 17,
            color: couleurs.texteSecondaire,
            lineHeight: 1.6,
            maxWidth: 720,
            marginBottom: 40,
          }}
        >
          Dimensionnement calculé à partir de l&apos;imagerie satellite
          haute résolution Google Solar et de la base de données
          nationale du bâtiment (BDNB CSTB).
        </p>

        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 40,
          }}
        >
          <ChiffreCle
            valeur={c.nb_panneaux.toString()}
            unite="panneaux"
            label="Capacité maximale"
          />
          <ChiffreCle
            valeur={c.puissance_kwc.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
            unite="kWc"
            label="Puissance installée"
          />
          <ChiffreCle
            valeur={c.production_kwh_an.toLocaleString('fr-FR')}
            unite="kWh/an"
            label="Production estimée"
          />
          <ChiffreCle
            valeur={c.surface_toiture_utile_m2.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
            unite="m²"
            label="Surface toiture utile"
          />
        </div>

        {c.satellite_image_url && (
          <div
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              border: `1px solid ${couleurs.bordure}`,
            }}
          >
            <img
              src={c.satellite_image_url}
              alt={`Vue satellite du bâtiment ${data.prospect.raison_sociale}`}
              style={{ width: '100%', display: 'block' }}
            />
            <div
              style={{
                background: couleurs.fondClair,
                padding: '12px 20px',
                fontSize: 13,
                color: couleurs.texteSecondaire,
              }}
            >
              📐 Inclinaison toiture : <strong>{c.inclinaison_deg}°</strong>{' '}
              · Azimut : <strong>{c.azimut_deg}°</strong> · Source :
              imagerie satellite haute résolution
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
