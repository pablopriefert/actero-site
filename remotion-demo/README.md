# Actero Demo Video — Remotion

Projet Remotion autonome qui génère la démo vidéo de 40 secondes utilisée
dans le `VideoModal` du site (`src/components/ui/VideoModal.jsx`).

## Prérequis

- Node.js ≥ 20
- Chrome ou Chromium installé (Remotion utilise Puppeteer pour le rendu)

## Installation

```bash
cd remotion-demo
npm install
```

## Développement interactif (Remotion Studio)

Ouvre le preview live avec timeline, scrub, inspector :

```bash
npm run dev
```

→ s'ouvre sur `http://localhost:3000`. Chaque scène est scrubbable
indépendamment. Les changements de code déclenchent un hot reload.

## Rendu final

```bash
# MP4 (1920×1080 @ 30fps, ~40s, qualité CRF 18)
npm run build
# → out/actero-demo.mp4

# GIF animé pour emails / Twitter
npm run build:gif
# → out/actero-demo.gif

# Still PNG du frame 60 (pour poster frame du modal)
npm run build:thumbnail
# → out/actero-demo-thumbnail.png
```

## Structure

```
src/
├── index.ts                        — entry point (registerRoot)
├── index.css                       — tokens cream/forest Tailwind 4
├── Root.tsx                        — <Composition id="ActeroDemo">
└── ActeroDemo/
    ├── Composition.tsx             — orchestre les 6 scènes via <Series>
    ├── constants.ts                — FPS, dimensions, COLORS, timings
    ├── fonts.ts                    — Instrument Serif + Inter + JetBrains Mono
    ├── components/
    │   ├── Eyebrow.tsx             — label uppercase vert
    │   └── Logo.tsx                — mark triangle/cercle Actero
    └── scenes/
        ├── SceneHook.tsx           — 40h/semaine (4s)
        ├── SceneSolution.tsx       — Actero logo + tagline (6s)
        ├── SceneSetup.tsx          — OAuth Shopify 1-clic (6s)
        ├── SceneAgent.tsx          — chat conversation + compteur (8s)
        ├── SceneResults.tsx        — 3 KPIs animés (8s)
        └── SceneCta.tsx            — CTA final dark forest (8s)
```

**Total : 1 200 frames @ 30 fps = 40 secondes** (configuré dans `constants.ts`).

## Après rendu — hébergement

Une fois `out/actero-demo.mp4` rendu :

1. **Option A — Loom** : upload via leur interface, récupère l'URL `loom.com/embed/<id>`
2. **Option B — hébergement self-hosted** : push le MP4 dans `public/demo.mp4`
   et modifie `src/config/demo.js` du projet principal pour utiliser une
   balise `<video src>` au lieu d'un iframe (ou un service comme Mux,
   Cloudflare Stream…)
3. **Option C — Bunny.net / Cloudflare Stream** : services CDN vidéo
   optimisés pour l'embed web

Puis mets à jour `src/config/demo.js` :

```js
export const DEMO_VIDEO = {
  url: 'https://www.loom.com/embed/TON_VRAI_ID',
  // ou un URL iframe-friendly
}
```

## Personnaliser

- **Durée des scènes** : `src/ActeroDemo/constants.ts` → `SCENE_FRAMES`
- **Couleurs** : `constants.ts` → `COLORS` (déjà alignés aux tokens Actero)
- **Chiffres** : édite directement les scènes — ex. `SceneResults.tsx` a
  les 3 KPIs en dur dans un array `kpis`
- **Audio / voice-over** : ajoute un `<Audio src="..." />` dans
  `Composition.tsx` ; Remotion aligne automatiquement avec la timeline

## Rendre depuis le cloud (recommandé pour la prod)

Pour éviter d'occuper la machine locale pendant 30-60 secondes :

```bash
npx @remotion/lambda render ActeroDemo
```

Requiert une config AWS Lambda (voir doc Remotion).
