/**
 * Section aides financieres et rentabilite.
 */

import { couleurs, containerStyle, sectionStyle } from './styles'
import type { MicrositeData } from '@/lib/microsite/mock-data'

export interface AidesProps {
  data: MicrositeData
}

function LigneAide({
  label,
  montant,
  description,
}: {
  label: string
  montant: string
  description: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 0',
        borderBottom: `1px solid ${couleurs.bordure}`,
        gap: 24,
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: couleurs.texte,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 14, color: couleurs.texteSecondaire }}>
          {description}
        </div>
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: couleurs.succes,
          whiteSpace: 'nowrap',
        }}
      >
        {montant}
      </div>
    </div>
  )
}

export function Aides({ data }: AidesProps) {
  const c = data.calcul_solaire
  const a = data.aides
  const aidesTotales =
    a.prime_autoconsommation_eur +
    a.suramortissement_eur +
    a.cee_eur

  return (
    <section
      style={{
        ...sectionStyle,
        background: couleurs.fondClair,
      }}
    >
      <div style={containerStyle}>
        <h2
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: couleurs.texte,
            marginBottom: 12,
          }}
        >
          Les aides mobilisables et votre retour sur investissement
        </h2>
        <p
          style={{
            fontSize: 17,
            color: couleurs.texteSecondaire,
            marginBottom: 40,
            maxWidth: 720,
          }}
        >
          Cumul des dispositifs nationaux 2026 : suramortissement
          article 39 decies B, certificats d&apos;économies d&apos;énergie
          (CEE), prime à l&apos;autoconsommation et tarif de rachat
          EDF OA pour le surplus.
        </p>

        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '8px 32px',
            border: `1px solid ${couleurs.bordure}`,
            marginBottom: 32,
          }}
        >
          {a.prime_autoconsommation_eur > 0 && (
            <LigneAide
              label="Prime à l'autoconsommation"
              montant={`${a.prime_autoconsommation_eur.toLocaleString('fr-FR')} €`}
              description="Versée par EDF OA, lissée sur 5 ans (≤ 100 kWc)"
            />
          )}
          <LigneAide
            label="Suramortissement (39 decies B)"
            montant={`${a.suramortissement_eur.toLocaleString('fr-FR')} €`}
            description="Économie d'IS sur l'amortissement majoré"
          />
          <LigneAide
            label="Certificats d'économies d'énergie (CEE)"
            montant={`${a.cee_eur.toLocaleString('fr-FR')} €`}
            description="Fiches IND-UT et BAT-EN pour le tertiaire/industriel"
          />
          <LigneAide
            label="Rachat surplus EDF OA"
            montant={`${a.rachat_surplus_eur_par_an.toLocaleString('fr-FR')} €/an`}
            description="Tarif d'obligation d'achat sur 20 ans"
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <ChiffreCleSucces
            label="Coût d'installation estimé"
            valeur={`${c.cout_installation_eur.toLocaleString('fr-FR')} €`}
          />
          <ChiffreCleSucces
            label="Aides cumulées"
            valeur={`${aidesTotales.toLocaleString('fr-FR')} €`}
            highlight
          />
          <ChiffreCleSucces
            label="Économie annuelle"
            valeur={`${c.economie_annuelle_eur.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €/an`}
          />
          <ChiffreCleSucces
            label="Retour sur investissement"
            valeur={`${c.retour_investissement_ans.toLocaleString('fr-FR', {
              maximumFractionDigits: 1,
            })} ans`}
            highlight
          />
        </div>
      </div>
    </section>
  )
}

function ChiffreCleSucces({
  label,
  valeur,
  highlight = false,
}: {
  label: string
  valeur: string
  highlight?: boolean
}) {
  return (
    <div
      style={{
        background: highlight ? couleurs.primaire : '#fff',
        color: highlight ? '#fff' : couleurs.texte,
        padding: '20px 24px',
        borderRadius: 12,
        border: highlight ? 'none' : `1px solid ${couleurs.bordure}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          opacity: highlight ? 0.8 : 1,
          color: highlight ? 'rgba(255,255,255,0.85)' : couleurs.texteSecondaire,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{valeur}</div>
    </div>
  )
}
