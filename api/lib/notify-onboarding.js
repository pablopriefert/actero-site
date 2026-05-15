/**
 * Send a Slack notification when a Shopify onboarding (E2B) job fails or times
 * out, so the internal team can intervene before the merchant stays stuck.
 *
 * Non-blocking: failures are logged but never thrown. Reuses the same
 * SLACK_WEBHOOK_URL incoming-webhook pattern as notify-signup.js.
 *
 * Env required: SLACK_WEBHOOK_URL (Incoming Webhook URL)
 */

export async function notifyOnboardingFailure({
  jobId,
  clientId,
  shopDomain,
  status,
  error,
}) {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) {
    console.log('[notify-onboarding] Skipped (SLACK_WEBHOOK_URL not set)')
    return { sent: false, reason: 'not_configured' }
  }

  const reason = status === 'timeout' ? '⏱️ timeout' : '❌ failed'
  const text =
    `🚨 *Shopify onboarding ${reason}*\n` +
    `🏪 *${shopDomain || 'unknown shop'}* — client \`${clientId || 'n/a'}\`\n` +
    `🧩 job \`${jobId || 'n/a'}\`\n` +
    `📝 ${error || 'no error message'}\n` +
    `_Merchant may be stuck — they can retry from the onboarding banner._`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      console.error('[notify-onboarding] Slack webhook non-OK:', res.status)
      return { sent: false, status: res.status }
    }
    return { sent: true }
  } catch (err) {
    console.error('[notify-onboarding] Exception:', err.message)
    return { sent: false, error: err.message }
  }
}
