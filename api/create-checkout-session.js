import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { client } = req.body;

  if (!client) {
    return res.status(400).json({ error: 'Missing client parameter' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          // Setup fee (one-time) added to the first invoice
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Actero — Setup',
              description: 'Frais de mise en place unique',
            },
            unit_amount: 80000, // 800€ in cents
          },
          quantity: 1,
        },
        {
          // Monthly subscription
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Actero — Abonnement mensuel',
              description: 'Automatisation IA du support client',
            },
            unit_amount: 80000, // 800€/month in cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        client,
        service: 'Actero',
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr'}/success?client=${encodeURIComponent(client)}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr'}/cancel?client=${encodeURIComponent(client)}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    return res.status(500).json({ error: 'Erreur lors de la création de la session de paiement.' });
  }
}
