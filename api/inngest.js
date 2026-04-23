// Inngest webhook endpoint. Inngest Cloud calls this URL to discover our
// functions (`PUT`) and to trigger runs (`POST`).
//
// The Vercel ↔ Inngest integration syncs us automatically on each deploy,
// but you can also hit PUT /api/inngest manually to force a re-sync.

import { serve } from 'inngest/next'
import { inngest } from './lib/inngest-client.js'
import { functions } from './lib/inngest-functions.js'

// `inngest/next` also works for raw Vercel Functions in /api since both use
// the Next.js Pages-Router-style (req, res) signature.
export default serve({
  client: inngest,
  functions,
})
