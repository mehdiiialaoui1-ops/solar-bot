/**
 * =============================================================================
 * ERE SOLAR BOT - Génération overlay SVG des panneaux solaires (SOL-14)
 * =============================================================================
 * Produit un SVG transparent à superposer sur l'image satellite Google Maps
 * Static : un rectangle par panneau, positionné via projection Mercator
 * (réutilise gpsVersPixelImage de google-maps-static.ts).
 *
 * Inputs :
 *   - BuildingInsightsResponse (avec solarPanels[] de Google Solar API)
 *   - dimensions de l'image cible (width, height en px)
 *   - centre image + zoom (cohérents avec l'image récupérée)
 *
 * Output :
 *   - Chaîne SVG (ouvrante + group + rects + fermante)
 *   - Stocké dans la table calculs_solaires.overlay_svg_url après upload
 *     dans Supabase Storage (J9 pipeline).
 * =============================================================================
 */

import type { BuildingInsightsResponse, LatLng } from './types'
import { gpsVersPixelImage } from './google-maps-static'

// ----------------------------------------------------------------------------
// Type SolarPanel local
// ----------------------------------------------------------------------------
// Note : Google Solar API renvoie ce champ dans `solarPotential.solarPanels`
// mais le champ n'a pas ete inclus dans types.ts initial (pas necessaire pour
// le dimensionnement). On le definit ici localement pour eviter de toucher
// aux types deja merges. A consolider si on ajoute le champ a SolarPotential
// dans une PR ulterieure.

export interface SolarPanel {
  center: LatLng
  /** PORTRAIT (vertical) ou LANDSCAPE (horizontal) */
  orientation?: 'PORTRAIT' | 'LANDSCAPE'
  yearlyEnergyDcKwh?: number
  /** Index du segment de toiture auquel le panneau appartient */
  segmentIndex?: number
}

/**
 * Extrait les solarPanels[] d'une reponse BuildingInsights, en gerant le
 * cas ou le champ n'a pas ete declare dans le type SolarPotential.
 */
function extrairePanneaux(insights: BuildingInsightsResponse): SolarPanel[] {
  const sp = insights.solarPotential as
    | (NonNullable<BuildingInsightsResponse['solarPotential']> & {
        solarPanels?: SolarPanel[]
      })
    | undefined
  return sp?.solarPanels ?? []
}

/** Couleur des panneaux (or solaire ERE Experts) */
export const COULEUR_PANNEAU = '#f4a83a'
/** Bordure des panneaux (bleu profond ERE Experts) */
export const COULEUR_BORDURE = '#1a3a5c'
/** Opacité du remplissage des panneaux (laisse voir la toiture en dessous) */
export const OPACITE_PANNEAU = 0.65

export interface OverlayOptions {
  insights: BuildingInsightsResponse
  /** Dimensions de l'image cible en pixels */
  imageWidth: number
  imageHeight: number
  /** Centre GPS de l'image (souvent = insights.center) */
  centerLat?: number
  centerLng?: number
  /** Zoom Maps Static (souvent 20 pour batiments) */
  zoom?: number
  /** Index de la config panneaux a representer. Defaut : max */
  configIndex?: number
}

/**
 * Calcule le facteur "metres par pixel" pour un zoom et une latitude
 * donnés selon la projection Web Mercator de Google Maps.
 *
 * Formule de référence : 156543.03392 m * cos(lat) / 2^zoom
 */
export function metresParPixel(lat: number, zoom: number): number {
  return (156_543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
}

/**
 * Echappe un texte pour insertion sécurisée dans un attribut SVG.
 */
function escapeSvgAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Construit l'élément <rect> SVG pour un panneau donné.
 *
 * Les dimensions du rect sont calculées à partir de panelHeightMeters
 * et panelWidthMeters convertis en pixels au zoom courant.
 *
 * On applique un transform="rotate(angle, x, y)" basé sur l'azimut du
 * panneau (issu du segment auquel il appartient).
 */
export function panneauVersSvgRect(opts: {
  panneau: SolarPanel
  panelHeightMeters: number
  panelWidthMeters: number
  imageWidth: number
  imageHeight: number
  centerLat: number
  centerLng: number
  zoom: number
  /** Azimut du segment du panneau (deg). Si absent, pas de rotation. */
  azimuthDeg?: number
  /** Index unique pour data-attr (debug) */
  index: number
}): string {
  const mpp = metresParPixel(opts.centerLat, opts.zoom)
  // Conversion m → px
  const heightPx = opts.panelHeightMeters / mpp
  const widthPx = opts.panelWidthMeters / mpp

  const orient = opts.panneau.orientation ?? 'PORTRAIT'
  // En PORTRAIT, le panneau est vertical : largeur < hauteur
  // En LANDSCAPE, il est horizontal : largeur > hauteur
  const rectW = orient === 'PORTRAIT' ? widthPx : heightPx
  const rectH = orient === 'PORTRAIT' ? heightPx : widthPx

  const px = gpsVersPixelImage({
    lat: opts.panneau.center.latitude,
    lng: opts.panneau.center.longitude,
    centerLat: opts.centerLat,
    centerLng: opts.centerLng,
    zoom: opts.zoom,
    width: opts.imageWidth,
    height: opts.imageHeight,
  })

  // SVG rect est positionné par son coin haut-gauche, on centre donc.
  const x = px.x - rectW / 2
  const y = px.y - rectH / 2

  const transform =
    typeof opts.azimuthDeg === 'number' && Number.isFinite(opts.azimuthDeg)
      ? ` transform="rotate(${opts.azimuthDeg.toFixed(2)} ${px.x} ${px.y})"`
      : ''

  return `<rect data-panel-index="${opts.index}" x="${x.toFixed(2)}" y="${y.toFixed(
    2,
  )}" width="${rectW.toFixed(2)}" height="${rectH.toFixed(
    2,
  )}" fill="${COULEUR_PANNEAU}" fill-opacity="${OPACITE_PANNEAU}" stroke="${COULEUR_BORDURE}" stroke-width="0.5"${transform} />`
}

/**
 * Construit l'overlay SVG complet pour un bâtiment.
 *
 * Si `insights.solarPotential.solarPanels` est absent, l'overlay sera
 * vide (juste le svg ouvrant/fermant). Le scenario dégradé est traité
 * en amont par le pipeline (fallback sur PVGIS, etc.).
 */
export function genererOverlaySvg(opts: OverlayOptions): string {
  const sp = opts.insights.solarPotential
  if (!sp) {
    return svgEnveloppe(opts.imageWidth, opts.imageHeight, '')
  }
  const panels = extrairePanneaux(opts.insights)
  const panelHeight = sp.panelHeightMeters ?? 1.879
  const panelWidth = sp.panelWidthMeters ?? 1.045
  const segments = sp.roofSegmentStats ?? []
  const centerLat = opts.centerLat ?? opts.insights.center.latitude
  const centerLng = opts.centerLng ?? opts.insights.center.longitude
  const zoom = opts.zoom ?? 20

  const rects = panels
    .map((panneau, i) => {
      const seg =
        typeof panneau.segmentIndex === 'number' ? segments[panneau.segmentIndex] : undefined
      return panneauVersSvgRect({
        panneau,
        panelHeightMeters: panelHeight,
        panelWidthMeters: panelWidth,
        imageWidth: opts.imageWidth,
        imageHeight: opts.imageHeight,
        centerLat,
        centerLng,
        zoom,
        azimuthDeg: seg?.azimuthDegrees,
        index: i,
      })
    })
    .join('\n  ')

  const titre = escapeSvgAttr(
    `${panels.length} panneaux solaires - ${opts.insights.name}`,
  )
  const inner = `<title>${titre}</title>\n  ${rects}`
  return svgEnveloppe(opts.imageWidth, opts.imageHeight, inner)
}

function svgEnveloppe(width: number, height: number, contenu: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  ${contenu}
</svg>`
}
