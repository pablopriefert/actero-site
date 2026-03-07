import * as amplitude from '@amplitude/analytics-browser';

let isInitialized = false;

/**
 * Initialise Amplitude avec la clé API.
 * Ne fait rien si la clé API est absente (pratique pour le dev local sans polluer les stats).
 */
export const initAmplitude = () => {
    const apiKey = import.meta.env.VITE_AMPLITUDE_API_KEY;

    if (!apiKey) {
        console.warn('Amplitude Analytics: VITE_AMPLITUDE_API_KEY is missing. Tracking is disabled in this environment.');
        return;
    }

    if (isInitialized) return;

    try {
        amplitude.init(apiKey, {
            defaultTracking: {
                sessions: true,
                pageViews: true,
                formInteractions: true,
                fileDownloads: true,
            },
        });
        isInitialized = true;
        console.log('Amplitude Analytics initialized successfully.');
    } catch (error) {
        console.error('Failed to initialize Amplitude:', error);
    }
};

/**
 * Envoie un événement personnalisé à Amplitude.
 * Utile pour tracker des actions spécifiques comme le clic sur un CTA ou l'utilisation d'une feature.
 * 
 * @param {string} eventName - Le nom de l'événement (ex: 'Hero_Chat_Submitted', 'Calendly_Clicked')
 * @param {object} eventProperties - Un objet Javascript avec des données supplémentaires (ex: { method: 'voice', plan: 'pro' })
 */
export const trackEvent = (eventName, eventProperties = {}) => {
    if (!isInitialized) return; // Ne tente pas d'envoyer si Amplitude n'est pas actif

    try {
        amplitude.track(eventName, eventProperties);
    } catch (error) {
        console.error(`Failed to track event ${eventName}:`, error);
    }
};

/**
 * Associe l'utilisateur actuel à un ID unique (ex: une fois connecté ou un email donné).
 * 
 * @param {string} userId - L'identifiant unique de l'utilisateur
 */
export const setUserId = (userId) => {
    if (!isInitialized || !userId) return;
    try {
        amplitude.setUserId(userId);
    } catch (error) {
        console.error('Failed to set user ID in Amplitude:', error);
    }
};
