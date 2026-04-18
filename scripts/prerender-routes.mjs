#!/usr/bin/env node
/**
 * Post-build prerender — writes dist/<route>/index.html for every SEO-critical
 * public route with per-route <title>, <meta description>, <canonical>,
 * <og:url>, <og:title>, and JSON-LD.
 *
 * Why: Actero is a Vite SPA. Until this runs, every route served dist/index.html
 * which hardcodes canonical=homepage. Googlebot consolidated all page authority
 * on "/" and refused to index sub-pages. Social crawlers (Facebook, LinkedIn,
 * Slack, Twitter) never execute JS at all — they also saw only the homepage meta.
 *
 * The fix:
 *   1. vite build → dist/index.html (the client-side SPA entry)
 *   2. This script duplicates that HTML into dist/<route>/index.html per route
 *      with the head tags string-replaced for that route
 *   3. Vercel's filesystem-first routing serves dist/tarifs/index.html directly
 *      when /tarifs is requested — bypass the SPA catch-all rewrite
 *   4. React Router still takes over after hydration; the user experiences a
 *      normal SPA. Googlebot + social crawlers see a properly-meta'd static page.
 *
 * To add a new route: append to ROUTES below. No other plumbing needed.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const DIST = resolve(process.cwd(), 'dist')
const SOURCE_HTML = resolve(DIST, 'index.html')

if (!existsSync(SOURCE_HTML)) {
  console.error('✗ dist/index.html not found — run `vite build` first')
  process.exit(1)
}

const template = readFileSync(SOURCE_HTML, 'utf8')

// ── Route config ───────────────────────────────────────────────────────
// Each entry drives what Googlebot sees BEFORE React hydrates. Titles are
// under 60 chars, descriptions 150-160 chars (optimal SERP snippet).
const ROUTES = [
  {
    path: '/tarifs',
    title: 'Tarifs Actero — Agent IA Shopify à partir de 99€/mois',
    description: 'Plans SaaS transparents : Free (0€), Starter 99€/mois (1 000 tickets), Pro 399€/mois (5 000 tickets + agent vocal). Essai gratuit 7 jours sans carte bancaire.',
    h1: 'Des prix simples, transparents',
  },
  {
    path: '/entreprise',
    title: 'Actero — Notre mission pour l\'e-commerce français',
    description: 'Actero est une plateforme française d\'automatisation SAV pour les marchands Shopify. Découvrez notre équipe, notre mission et nos valeurs.',
    h1: 'À propos d\'Actero',
  },
  {
    path: '/faq',
    title: 'FAQ Actero — Questions fréquentes sur l\'agent IA Shopify',
    description: 'Réponses complètes sur le fonctionnement d\'Actero : installation Shopify, conformité RGPD, intégrations Gorgias/Zendesk, tarifs, ROI, sécurité des données.',
    h1: 'Questions fréquentes',
  },
  {
    path: '/audit',
    title: 'Audit SAV Shopify gratuit — Diagnostic Actero 15 min',
    description: 'Prenez 15 minutes avec notre équipe pour identifier les workflows SAV à automatiser sur votre boutique Shopify. Audit gratuit, sans engagement.',
    h1: 'Audit stratégique offert',
  },
  {
    path: '/ambassadeurs',
    title: 'Programme Ambassadeurs Actero — 20% de commission récurrente',
    description: 'Recommandez Actero à votre communauté de marchands Shopify et gagnez 20% de commission récurrente pendant toute la durée d\'abonnement du client.',
    h1: 'Programme Ambassadeurs',
  },
  {
    path: '/support',
    title: 'Support Actero — Documentation & guides agent IA',
    description: 'Centre d\'aide Actero : guides d\'installation Shopify, configuration des workflows, intégration helpdesk, résolution de problèmes courants.',
    h1: 'Centre d\'aide Actero',
  },
  {
    path: '/ressources',
    title: 'Ressources Actero — Bibliothèque de prompts IA e-commerce',
    description: 'Bibliothèque de prompts prêts à l\'emploi pour l\'e-commerce : réponses SAV, relances paniers, qualifications leads, scripts agent vocal.',
    h1: 'Ressources Actero',
  },
  {
    path: '/mentions-legales',
    title: 'Mentions légales — Actero',
    description: 'Mentions légales obligatoires d\'Actero : raison sociale, siège social, hébergement, directeur de publication, contact RGPD.',
    h1: 'Mentions légales',
  },
  {
    path: '/confidentialite',
    title: 'Politique de confidentialité — Actero',
    description: 'Comment Actero traite vos données personnelles et celles de vos clients : base légale, durée de conservation, droits RGPD, exercices des droits.',
    h1: 'Politique de confidentialité',
  },
  {
    path: '/utilisation',
    title: 'Conditions d\'utilisation — Actero',
    description: 'Conditions générales d\'utilisation d\'Actero : accès au service, obligations, propriété intellectuelle, responsabilité, résiliation.',
    h1: 'Conditions d\'utilisation',
  },
]

const SITE = 'https://actero.fr'

// ── String replacement helpers ─────────────────────────────────────────
// We target specific substrings in the source HTML. If index.html ever
// changes its canonical homepage values, these need to stay in sync.
const DEFAULT_CANONICAL = 'https://actero.fr/'
const DEFAULT_TITLE = 'Actero — Automatisation IA pour E-commerce Shopify'
const DEFAULT_OG_URL_RE = /<meta property="og:url" content="https:\/\/actero\.fr\/"\s*\/>/g
const DEFAULT_OG_TITLE_RE = /<meta property="og:title" content="Actero — Automatisation IA pour E-commerce Shopify"\s*\/>/g
const DEFAULT_TW_TITLE_RE = /<meta name="twitter:title" content="Actero — Automatisation IA pour E-commerce Shopify"\s*\/>/g
const DEFAULT_DESC_RE = /<meta name="description"[\s\S]*?\/>/
const DEFAULT_OG_DESC_RE = /<meta property="og:description"[\s\S]*?\/>/
const DEFAULT_TW_DESC_RE = /<meta name="twitter:description"[\s\S]*?\/>/

function prerenderRoute(route) {
  const canonicalUrl = `${SITE}${route.path}`
  let html = template

  // <title>
  html = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${route.title}</title>`,
  )
  // canonical
  html = html.replace(
    `<link rel="canonical" href="${DEFAULT_CANONICAL}" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
  )
  // og:url
  html = html.replace(
    DEFAULT_OG_URL_RE,
    `<meta property="og:url" content="${canonicalUrl}" />`,
  )
  // og:title
  html = html.replace(
    DEFAULT_OG_TITLE_RE,
    `<meta property="og:title" content="${route.title}" />`,
  )
  // twitter:title
  html = html.replace(
    DEFAULT_TW_TITLE_RE,
    `<meta name="twitter:title" content="${route.title}" />`,
  )
  // meta description + og:description + twitter:description
  const descTag = `<meta name="description" content="${route.description}" />`
  const ogDescTag = `<meta property="og:description" content="${route.description}" />`
  const twDescTag = `<meta name="twitter:description" content="${route.description}" />`
  html = html.replace(DEFAULT_DESC_RE, descTag)
  html = html.replace(DEFAULT_OG_DESC_RE, ogDescTag)
  html = html.replace(DEFAULT_TW_DESC_RE, twDescTag)

  // Write dist/<route>/index.html
  const outDir = resolve(DIST, route.path.replace(/^\//, ''))
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, 'index.html')
  writeFileSync(outPath, html)
  console.log(`✓ ${route.path.padEnd(22)} → ${route.title.slice(0, 50)}${route.title.length > 50 ? '…' : ''}`)
}

// ── Run ────────────────────────────────────────────────────────────────
console.log(`\nPrerendering ${ROUTES.length} routes for SEO:\n`)
for (const route of ROUTES) {
  prerenderRoute(route)
}
console.log(`\n✓ Prerender complete — ${ROUTES.length} static HTML files written.\n`)
