'use client'

import { useState, useMemo } from 'react'
import type { ProspectAvecCalcul } from './page'

// ============================================================================
// Styles inline (pas de Tailwind dans le projet)
// ============================================================================

const colors = {
  primary: '#1a1a2e',
  accent: '#e94560',
  success: '#27ae60',
  warning: '#f39c12',
  info: '#3498db',
  bg: '#f8f9fa',
  card: '#ffffff',
  border: '#e0e0e0',
  text: '#333',
  textLight: '#666',
}

const cardStyle: React.CSSProperties = {
  background: colors.card,
  borderRadius: 12,
  padding: '1.25rem',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const kpiStyle: React.CSSProperties = {
  ...cardStyle,
  textAlign: 'center',
  minWidth: 150,
  flex: '1 1 150px',
}

const badgeStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: '0.75rem',
  fontWeight: 600,
  background: color + '18',
  color,
})

const statutColors: Record<string, string> = {
  new: '#3498db',
  enriched: '#9b59b6',
  solar_calculated: '#27ae60',
  microsite_ready: '#e67e22',
  outreach_sent: '#e74c3c',
  opened: '#f39c12',
  replied: '#2ecc71',
  meeting_booked: '#1abc9c',
  qualified: '#16a085',
  client: '#27ae60',
  lost: '#95a5a6',
  refused: '#e74c3c',
  unsubscribed: '#bdc3c7',
}

// ============================================================================
// Fonctions utilitaires
// ============================================================================

function formatEur(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
}

// ============================================================================
// Composants
// ============================================================================

function KPICard({ label, value, unit, color }: {
  label: string
  value: string | number
  unit?: string
  color?: string
}) {
  return (
    <div style={kpiStyle}>
      <div style={{ fontSize: '0.8rem', color: colors.textLight, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: color ?? colors.primary }}>
        {value}
        {unit && <span style={{ fontSize: '0.9rem', fontWeight: 400, marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: colors.textLight }}>—</span>
  const color = score >= 70 ? colors.success : score >= 50 ? colors.warning : colors.accent
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 50,
        height: 6,
        borderRadius: 3,
        background: '#eee',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${score}%`,
          height: '100%',
          borderRadius: 3,
          background: color,
        }} />
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color }}>{score}</span>
    </div>
  )
}

// ============================================================================
// Dashboard principal
// ============================================================================

export function DashboardClient({ prospects }: { prospects: ProspectAvecCalcul[] }) {
  const [filtreStatut, setFiltreStatut] = useState<string>('tous')
  const [filtreCommune, setFiltreCommune] = useState<string>('toutes')
  const [tri, setTri] = useState<'score' | 'surface' | 'production' | 'roi'>('score')

  // Communes uniques
  const communes = useMemo(() => {
    const set = new Set(prospects.map((p) => p.commune))
    return ['toutes', ...Array.from(set).sort()]
  }, [prospects])

  // Statuts uniques
  const statuts = useMemo(() => {
    const set = new Set(prospects.map((p) => p.statut))
    return ['tous', ...Array.from(set).sort()]
  }, [prospects])

  // Filtrage
  const filtres = useMemo(() => {
    return prospects.filter((p) => {
      if (filtreStatut !== 'tous' && p.statut !== filtreStatut) return false
      if (filtreCommune !== 'toutes' && p.commune !== filtreCommune) return false
      return true
    })
  }, [prospects, filtreStatut, filtreCommune])

  // Tri
  const tries = useMemo(() => {
    return [...filtres].sort((a, b) => {
      switch (tri) {
        case 'score':
          return (b.score ?? 0) - (a.score ?? 0)
        case 'surface':
          return b.surface_m2 - a.surface_m2
        case 'production':
          return (b.calcul?.production_kwh_an ?? 0) - (a.calcul?.production_kwh_an ?? 0)
        case 'roi':
          return (a.calcul?.retour_investissement_ans ?? 99) - (b.calcul?.retour_investissement_ans ?? 99)
        default:
          return 0
      }
    })
  }, [filtres, tri])

  // KPIs
  const totalProspects = prospects.length
  const totalPuissance = prospects.reduce((s, p) => s + (p.calcul?.puissance_kwc ?? 0), 0)
  const totalProduction = prospects.reduce((s, p) => s + (p.calcul?.production_kwh_an ?? 0), 0)
  const totalEconomie = prospects.reduce((s, p) => s + (p.calcul?.economie_annuelle_eur ?? 0), 0)
  const totalCA = prospects.reduce((s, p) => s + (p.calcul?.cout_installation_eur ?? 0), 0)
  const scoresMoyen = Math.round(
    prospects.reduce((s, p) => s + (p.score ?? 0), 0) / (totalProspects || 1),
  )

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 6,
    border: `1px solid ${colors.border}`,
    fontSize: '0.85rem',
    background: colors.card,
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <KPICard label="Prospects" value={totalProspects} color={colors.info} />
        <KPICard label="Puissance totale" value={formatNum(totalPuissance)} unit="kWc" color={colors.success} />
        <KPICard label="Production annuelle" value={formatNum(totalProduction)} unit="kWh" color={colors.warning} />
        <KPICard label="Économies/an" value={formatEur(totalEconomie)} color={colors.success} />
        <KPICard label="CA potentiel" value={formatEur(totalCA)} color={colors.accent} />
        <KPICard label="Score moyen" value={scoresMoyen} unit="/100" color={colors.primary} />
      </div>

      {/* Filtres */}
      <div style={{ ...cardStyle, display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.85rem', color: colors.textLight }}>
          Statut :
          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value)}
            style={{ ...selectStyle, marginLeft: 6 }}
          >
            {statuts.map((s) => (
              <option key={s} value={s}>
                {s === 'tous' ? 'Tous' : s} {s !== 'tous' ? `(${prospects.filter((p) => p.statut === s).length})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: '0.85rem', color: colors.textLight }}>
          Commune :
          <select
            value={filtreCommune}
            onChange={(e) => setFiltreCommune(e.target.value)}
            style={{ ...selectStyle, marginLeft: 6 }}
          >
            {communes.map((c) => (
              <option key={c} value={c}>
                {c === 'toutes' ? 'Toutes' : c}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: '0.85rem', color: colors.textLight }}>
          Trier par :
          <select
            value={tri}
            onChange={(e) => setTri(e.target.value as typeof tri)}
            style={{ ...selectStyle, marginLeft: 6 }}
          >
            <option value="score">Score</option>
            <option value="surface">Surface</option>
            <option value="production">Production</option>
            <option value="roi">ROI</option>
          </select>
        </label>

        <span style={{ fontSize: '0.85rem', color: colors.textLight, marginLeft: 'auto' }}>
          {filtres.length} prospect{filtres.length > 1 ? 's' : ''} affiché{filtres.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Tableau */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: colors.bg, borderBottom: `2px solid ${colors.border}` }}>
              {['Score', 'Commune', 'Adresse', 'Surface', 'Usage', 'Puissance', 'Production', 'Économie/an', 'ROI', 'Aides', 'Statut', 'Microsite'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 12px',
                    textAlign: h === 'Adresse' ? 'left' : 'right',
                    fontWeight: 600,
                    color: colors.textLight,
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tries.map((p) => (
              <tr
                key={p.id}
                style={{
                  borderBottom: `1px solid ${colors.border}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f7ff' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
              >
                <td style={{ padding: '10px 12px' }}>
                  <ScoreBar score={p.score} />
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {p.commune}
                </td>
                <td style={{
                  padding: '10px 12px',
                  maxWidth: 250,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {p.adresse}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>
                  {formatNum(p.surface_m2)} m²
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <span style={badgeStyle(p.usage.toLowerCase().includes('tertiaire') ? colors.info : colors.warning)}>
                    {p.usage}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>
                  {formatNum(p.calcul?.puissance_kwc)} kWc
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {formatNum(p.calcul?.production_kwh_an)} kWh
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: colors.success }}>
                  {formatEur(p.calcul?.economie_annuelle_eur)}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {p.calcul?.retour_investissement_ans != null
                    ? `${p.calcul.retour_investissement_ans.toFixed(1)} ans`
                    : '—'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: colors.info }}>
                  {formatEur(p.calcul?.total_aides_eur)}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <span style={badgeStyle(statutColors[p.statut] ?? colors.textLight)}>
                    {p.statut}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {p.microsite_slug ? (
                    <a
                      href={`/microsite/${p.microsite_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: colors.info,
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        textDecoration: 'none',
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: colors.info + '12',
                      }}
                    >
                      Voir
                    </a>
                  ) : (
                    <span style={{ color: colors.textLight, fontSize: '0.8rem' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
