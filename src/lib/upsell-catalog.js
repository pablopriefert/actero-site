/**
 * Actero Upsell Catalog
 * Defines all available upsells per vertical (ecommerce / immobilier)
 */

export const UPSELL_CATALOG = {
  ecommerce: [
    {
      id: 'email_sequences_customerio',
      name: 'Séquences email avancées',
      subtitle: 'Customer.io',
      description: 'Automatisez vos campagnes email avancées : nurturing, post-achat, win-back, réactivation.',
      businessValue: 'Augmentation de la rétention, récupération de revenus, fidélisation client.',
      icon: 'Mail',
      badge: 'Recommandé',
      color: 'violet',
    },
    {
      id: 'reporting_premium_ecom',
      name: 'Reporting premium',
      subtitle: 'Insights e-commerce',
      description: 'Recevez des rapports avancés et des recommandations IA pour améliorer votre performance e-commerce.',
      businessValue: 'Visibilité complète, pilotage data-driven, optimisation du ROI.',
      icon: 'BarChart3',
      badge: 'Premium',
      color: 'amber',
    },
  ],
  immobilier: [
    {
      id: 'sms_relance_leads',
      name: 'Relance SMS des leads',
      subtitle: 'Leads entrants',
      description: 'Accélérez le traitement de vos leads avec des relances SMS automatiques.',
      businessValue: 'Conversion plus rapide, moins de leads perdus.',
      icon: 'MessageSquare',
      badge: 'Recommandé',
      color: 'emerald',
    },
    {
      id: 'prise_rdv_auto',
      name: 'Prise de rendez-vous',
      subtitle: 'Automatisée',
      description: 'Automatisez la proposition de créneaux, la confirmation et le suivi des visites.',
      businessValue: 'Gain de temps, plus de visites planifiées automatiquement.',
      icon: 'CalendarCheck',
      badge: 'Recommandé',
      color: 'blue',
    },
    {
      id: 'scoring_leads',
      name: 'Scoring avancé',
      subtitle: 'Leads',
      description: 'Priorisez automatiquement les meilleurs leads selon leur potentiel.',
      businessValue: 'Meilleure allocation du temps commercial, focus sur les meilleurs leads.',
      icon: 'Target',
      badge: 'Premium',
      color: 'violet',
    },
    {
      id: 'reporting_premium_immo',
      name: 'Reporting premium',
      subtitle: 'Performance agence',
      description: 'Suivez vos leads, vos visites et vos performances avec des rapports premium et recommandations IA.',
      businessValue: 'Visibilité, pilotage, performance commerciale.',
      icon: 'BarChart3',
      badge: 'Premium',
      color: 'amber',
    },
  ],
};

/**
 * Get catalog items for a given client type
 */
export const getUpsellsForVertical = (clientType) => {
  return UPSELL_CATALOG[clientType] || UPSELL_CATALOG.ecommerce;
};
