/**
 * Configuration du modal de démo vidéo.
 *
 * La vidéo est générée par Remotion (voir remotion-demo/ à la racine).
 * Elle est servie statique depuis public/actero-demo.mp4 — aucun CDN
 * tiers, aucun tracker externe, aucune dépendance externe.
 *
 * Pour la régénérer : `cd remotion-demo && npm run build`, puis
 * `cp out/actero-demo.mp4 ../public/actero-demo.mp4`.
 */
export const DEMO_VIDEO = {
  /** Source vidéo — self-hosted, 1920×1080 @ 30fps, ~40s, ~4 MB */
  src: '/actero-demo.mp4',
  /** Image de preview, frame 210 (logo Actero plein écran) */
  poster: '/actero-demo-thumbnail.png',
  title: 'Démo Actero — 40 secondes',
  duration: '40 sec',
  aspectRatio: 16 / 9,
}

/** Toujours disponible depuis qu'on self-host — gardé pour rétrocompatibilité */
export const DEMO_VIDEO_AVAILABLE = true
