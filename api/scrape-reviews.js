import { withSentry } from './lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './lib/admin-auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function handler(req, res) {
  // Restrict CORS to our own domain
  const allowedOrigin = process.env.SITE_URL || 'https://actero.fr';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check: admin only (uses paid SerpAPI credits)
  const adminUser = await requireAdmin(req, res, supabase);
  if (!adminUser) return;

  const { storeName } = req.body;
  if (!storeName) return res.status(400).json({ error: 'storeName required' });

  const SERPAPI_KEY = process.env.SERPAPI_KEY;
  if (!SERPAPI_KEY) return res.status(500).json({ error: 'SERPAPI_KEY not configured' });

  try {
    // Search for the store on Google to find reviews
    const searchQuery = `${storeName} avis clients site:trustpilot.com OR site:google.com`;
    const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(searchQuery)}&hl=fr&gl=fr&api_key=${SERPAPI_KEY}`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    // Try to find Trustpilot or Google reviews
    let reviews = [];
    let averageRating = 0;
    let totalReviews = 0;
    let source = 'google';

    // Check if there's a knowledge panel with reviews
    if (searchData.knowledge_graph?.reviews) {
      averageRating = searchData.knowledge_graph.reviews.rating || 0;
      totalReviews = searchData.knowledge_graph.reviews.total || 0;
    }

    // Try Google Maps/Place reviews via SerpAPI
    const placeSearchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(storeName)}&hl=fr&api_key=${SERPAPI_KEY}`;
    const placeRes = await fetch(placeSearchUrl);
    const placeData = await placeRes.json();

    if (placeData.place_results?.place_id) {
      const reviewsUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeData.place_results.place_id}&hl=fr&sort_by=newestFirst&api_key=${SERPAPI_KEY}`;
      const reviewsRes = await fetch(reviewsUrl);
      const reviewsData = await reviewsRes.json();

      if (reviewsData.reviews) {
        reviews = reviewsData.reviews
          .filter(r => r.rating <= 2)
          .slice(0, 10)
          .map(r => ({
            author: r.user?.name || 'Anonyme',
            stars: r.rating || 1,
            date: r.date || '',
            text: r.snippet || r.extracted_snippet?.original || 'Pas de commentaire',
            source: 'google',
          }));
        averageRating = reviewsData.place_info?.rating || averageRating;
        totalReviews = reviewsData.place_info?.reviews || totalReviews;
      }
    }

    // Also try Trustpilot via organic results
    const trustpilotResult = searchData.organic_results?.find(r =>
      r.link?.includes('trustpilot.com') || r.link?.includes('trustpilot.fr')
    );

    if (trustpilotResult) {
      // Search Trustpilot specifically for negative reviews
      const tpSearchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(storeName + ' avis 1 etoile site:trustpilot.com')}&hl=fr&gl=fr&num=10&api_key=${SERPAPI_KEY}`;
      const tpRes = await fetch(tpSearchUrl);
      const tpData = await tpRes.json();

      if (tpData.organic_results) {
        const tpReviews = tpData.organic_results
          .filter(r => r.link?.includes('trustpilot'))
          .slice(0, 5)
          .map(r => ({
            author: 'Trustpilot User',
            stars: 1,
            date: r.date || '',
            text: r.snippet || '',
            source: 'trustpilot',
          }));
        reviews = [...reviews, ...tpReviews];
        source = 'trustpilot+google';
      }

      // Extract Trustpilot rating from snippet
      if (trustpilotResult.snippet) {
        const ratingMatch = trustpilotResult.snippet.match(/(\d[.,]\d)/);
        if (ratingMatch) {
          averageRating = parseFloat(ratingMatch[1].replace(',', '.'));
        }
      }
    }

    // Extract pain points using keyword detection
    const painPointKeywords = {
      'Temps de réponse lent': ['réponse', 'répondre', 'attendre', 'attente', 'jours', 'semaines', 'délai'],
      'SAV inexistant': ['sav', 'service client', 'service après-vente', 'injoignable', 'impossible de joindre'],
      'Remboursement lent': ['rembours', 'remboursement', 'argent', 'paiement'],
      'Pas de suivi': ['suivi', 'tracking', 'aucune nouvelle', 'sans nouvelle'],
      'Produit endommagé': ['cassé', 'endommagé', 'abîmé', 'défectueux', 'qualité'],
      'Livraison problématique': ['livraison', 'colis', 'expédition', 'retard', 'perdu'],
      'FAQ incomplète': ['faq', 'information', 'info', 'comprendre'],
      'Réponses génériques': ['copier-coller', 'générique', 'automatique', 'robot', 'bot'],
      'Politique retours floue': ['retour', 'échange', 'politique', 'conditions'],
      'Mauvaise communication': ['communication', 'mail', 'email', 'contact'],
    };

    reviews.forEach(review => {
      const text = (review.text || '').toLowerCase();
      review.painPoints = [];
      for (const [painPoint, keywords] of Object.entries(painPointKeywords)) {
        if (keywords.some(kw => text.includes(kw))) {
          review.painPoints.push(painPoint);
        }
      }
      if (review.painPoints.length === 0) {
        review.painPoints.push('Insatisfaction générale');
      }
    });

    // Aggregate pain points
    const painPointCounts = {};
    reviews.forEach(r => {
      (r.painPoints || []).forEach(pp => {
        painPointCounts[pp] = (painPointCounts[pp] || 0) + 1;
      });
    });

    return res.status(200).json({
      storeName,
      source,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews,
      negativeReviews: reviews.length,
      reviews,
      painPoints: painPointCounts,
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return res.status(500).json({ error: 'Erreur lors du scraping: ' + error.message });
  }
}

export default withSentry(handler)
