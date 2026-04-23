import { Inngest } from 'inngest'

// Single shared client. id = stable app identifier shown in Inngest dashboard.
// Event/signing keys are injected by the Vercel ↔ Inngest integration:
// - INNGEST_EVENT_KEY (prod/preview)
// - INNGEST_SIGNING_KEY (prod/preview)
export const inngest = new Inngest({
  id: 'actero-site',
  name: 'Actero',
})
