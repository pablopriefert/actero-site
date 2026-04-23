/**
 * Portal tone helper — switches copy between tutoiement ('tu') and
 * vouvoiement ('vous') based on the client's portal_tone setting
 * stored in client_settings.
 *
 * Usage:
 *   applyTone('Ton email', 'Votre email', tone)
 */

export const DEFAULT_PORTAL_TONE = 'tu';

export function applyTone(tuText, vousText, tone) {
  return tone === 'vous' ? vousText : tuText;
}
