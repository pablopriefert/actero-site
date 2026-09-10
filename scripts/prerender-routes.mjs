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
    path: '/demo',
    title: 'Démo Actero — parlez à l\'agent SAV maintenant',
    description: 'Posez une vraie question à l\'agent SAV Actero et voyez sa réponse, sa confiance et sa décision de passer la main à un humain. Sans compte, sans carte bancaire.',
    h1: 'Parlez à l\'agent',
  },
  {
    path: '/tarifs',
    title: 'Tarifs Actero — Agent IA Shopify à partir de 99€/mois',
    description: 'Plans SaaS transparents : Free (0€), Starter 99€/mois (1 000 tickets), Pro 399€/mois (5 000 tickets + agents spécialisés). Essai gratuit 7 jours sans carte bancaire.',
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
  // Comparison / alternatives pages — high-intent SEO that competitors rank
  // for. Without prerender these served the homepage canonical and were
  // de-prioritised by Google.
  {
    path: '/alternative-gorgias',
    title: 'Alternative à Gorgias — Actero, agent IA SAV Shopify',
    description: 'Comparez Actero et Gorgias : prix, fonctionnalités, automatisation IA, intégrations Shopify. Découvrez pourquoi les marchands migrent vers Actero.',
    h1: 'Alternative à Gorgias',
  },
  {
    path: '/alternative-tidio',
    title: 'Alternative à Tidio — Actero, agent IA SAV e-commerce',
    description: 'Tidio vs Actero : agent IA conversationnel, automatisation SAV Shopify, intégration helpdesk. Pourquoi Actero est l\'alternative française à Tidio.',
    h1: 'Alternative à Tidio',
  },
  {
    path: '/alternative-zendesk',
    title: 'Alternative à Zendesk — Actero, SAV IA pour Shopify',
    description: 'Comparatif Zendesk vs Actero : automatisation IA, prix, simplicité, support en français. Pourquoi les marchands Shopify préfèrent Actero à Zendesk.',
    h1: 'Alternative à Zendesk',
  },
  {
    path: '/alternative-intercom',
    title: 'Alternative à Intercom Fin pour Shopify — Actero | SAV IA FR',
    description: 'Intercom Fin facture 0,99 $/résolution + 29 $/seat. Actero forfaitise dès 99 €/mois — agent IA, vocal, paniers abandonnés inclus, hébergé UE. Migration en 1 jour.',
    h1: 'Alternative à Intercom',
  },
  {
    path: '/alternative-siena',
    title: 'Alternative à Siena AI pour e-commerce FR — Actero | SAV IA',
    description: 'Siena AI demande 750 $/mois plateforme + 0,90 $/ticket et un appel commercial. Actero affiche ses prix, parle français et héberge en UE — IA, vocal et relance dès 99 €/mois.',
    h1: 'Alternative à Siena AI',
  },
  {
    path: '/alternative-crisp',
    title: 'Alternative à Crisp pour Shopify — Actero | Agent IA SAV FR',
    description: "Crisp est un super chat français mais l'IA est limitée par crédits. Actero est un vrai agent IA spécialisé Shopify, voice incluse, dashboard ROI. Dès 99 €/mois.",
    h1: 'Alternative à Crisp',
  },
  {
    path: '/alternative-reamaze',
    title: 'Alternative à Re:amaze pour Shopify FR — Actero | Agent IA SAV',
    description: "Re:amaze facture par agent + 0,85 $ par résolution IA en overage. Actero forfaitise dès 99 €/mois, en français, hébergé UE, voice inclus. Migration en 1 jour.",
    h1: 'Alternative à Re:amaze',
  },
  {
    path: '/gorgias-vs-actero',
    title: 'Gorgias vs Actero — Comparatif détaillé 2026 | Lequel choisir ?',
    description: "Comparatif factuel Gorgias vs Actero : prix, features, IA, voice, RGPD. Sur 1 000 tickets/mois, Gorgias coûte ~1 280 $/mois (Pro + AI), Actero 99 €/mois.",
    h1: 'Gorgias vs Actero',
  },
  {
    path: '/tidio-vs-actero',
    title: 'Tidio vs Actero — Comparatif IA SAV Shopify 2026 | Lequel choisir',
    description: "Tidio Lyro est un chatbot IA léger, Actero est un agent autonome spécialisé Shopify avec voice et actions. Comparatif détaillé prix, features, ROI.",
    h1: 'Tidio vs Actero',
  },
  {
    path: '/zendesk-vs-actero',
    title: 'Zendesk vs Actero — Comparatif 2026 pour PME e-commerce | Verdict',
    description: "Zendesk vise l'enterprise (55-169 $/agent + 50 $ AI). Actero est forfaitaire pour PME Shopify (99 €/mois tout compris). Comparatif détaillé prix et features.",
    h1: 'Zendesk vs Actero',
  },
  {
    path: '/intercom-vs-actero',
    title: 'Intercom vs Actero — Comparatif 2026 | Lequel choisir pour Shopify',
    description: "Intercom Fin facture 0,99 $ par outcome + 29 $/seat. Actero forfaitise dès 99 €/mois — IA, voice, paniers inclus. Sur 5 000 résolutions, Actero divise par 12.",
    h1: 'Intercom vs Actero',
  },
  {
    path: '/calculateur-gorgias',
    title: 'Calculateur Gorgias — Combien votre helpdesk va vraiment vous coûter',
    description: "Calculez en 30 secondes le coût annuel réel de Gorgias (plan + AI Agent à 0,95 $/résolution) face au forfait Actero. Tarifs officiels avril 2026, rapport PDF gratuit.",
    h1: 'Calculateur Gorgias vs Actero',
  },
  {
    path: '/partners',
    title: 'Partenaires Actero — Agences certifiées agent IA Shopify',
    description: 'Annuaire des partenaires Actero certifiés : agences spécialisées dans la mise en place d\'agents IA pour le SAV e-commerce Shopify.',
    h1: 'Nos partenaires certifiés',
  },
  {
    path: '/partners/apply',
    title: 'Devenir partenaire Actero — Programme agences IA',
    description: 'Rejoignez le programme partenaires Actero : commissions, formation, leads qualifiés, certification officielle. Pour agences et freelances Shopify.',
    h1: 'Devenir partenaire Actero',
  },
  {
    path: '/startups',
    title: 'Actero pour les startups — 50% off pendant 12 mois',
    description: 'Programme Actero for Startups : 50% de réduction pendant 12 mois pour les jeunes pousses e-commerce. Conditions et candidature en ligne.',
    h1: 'Actero pour les startups',
  },
  {
    path: '/produit',
    title: 'Produit Actero — Agent IA SAV Shopify autonome',
    description: 'Découvrez l\'agent IA Actero : classification tickets, réponses automatiques, escalade, intégration Shopify, helpdesk, WhatsApp, analyse photo.',
    h1: 'Le produit Actero',
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
