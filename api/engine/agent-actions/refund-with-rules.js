/**
 * Python script — runs inside an E2B sandbox.
 *
 * Reads /workspace/context.json (injected by execute-agent-action.js) and
 * produces a REFUND RECOMMENDATION. It NEVER issues the refund itself:
 *   - Actero does not hold the write_orders scope.
 *   - Shopify App Store policy 1.1.15 requires refunds to be processed through
 *     the merchant's native Admin flow (to the original payment method).
 *
 * So this action decides one of:
 *   1. draft_refund  — within the merchant's rules → propose a draft the
 *                      merchant approves natively in Shopify Admin, OR
 *   2. escalate_human — needs a human decision, OR
 *   3. reject         — the request violates a guardrail.
 *
 * It makes NO HTTP calls: order context (order_total, customer_total_spent) is
 * passed in by the engine, which already fetched it via the GraphQL Admin API.
 *
 * Output: a single JSON line on stdout, e.g.
 *   {"decision":"draft_refund","amount":42.50,"is_vip":true,"order_id":"123"}
 *
 * Guardrails (read from context.guardrails):
 *   - max_auto_refund_eur (default 100) — auto cap for non-VIP
 *   - vip_threshold_eur (default 500)   — total_spent threshold for VIP
 *   - allowed_reasons (default [])      — if non-empty, reason must match
 */

export const REFUND_WITH_RULES_SCRIPT = `
import json
import sys
from pathlib import Path

ctx = json.loads(Path('/workspace/context.json').read_text())
payload = ctx['payload']
guardrails = ctx.get('guardrails') or {}

order_id = payload.get('order_id')
reason = payload.get('reason', 'customer_request')
requested_amount = float(payload['amount'])

# Order context comes from the engine (GraphQL order lookup) — this action
# never calls Shopify directly.
order_total = float(payload.get('order_total', 0) or 0)
customer_total_spent = float(payload.get('customer_total_spent', 0) or 0)

max_auto = float(guardrails.get('max_auto_refund_eur', 100))
vip_threshold = float(guardrails.get('vip_threshold_eur', 500))
allowed_reasons = guardrails.get('allowed_reasons') or []
is_vip = customer_total_spent >= vip_threshold

if allowed_reasons and reason not in allowed_reasons:
    print(json.dumps({
        'decision': 'reject',
        'reason': 'reason_not_allowed',
        'received': reason,
        'allowed': allowed_reasons,
    }))
    sys.exit(0)

if order_total and requested_amount > order_total:
    print(json.dumps({
        'decision': 'reject',
        'reason': 'amount_exceeds_order',
        'requested': requested_amount,
        'order_total': order_total,
    }))
    sys.exit(0)

if requested_amount > max_auto and not is_vip:
    print(json.dumps({
        'decision': 'escalate_human',
        'reason': 'amount_above_auto_threshold_non_vip',
        'amount': requested_amount,
        'threshold': max_auto,
        'is_vip': is_vip,
    }))
    sys.exit(0)

# Within the merchant's rules -> propose a DRAFT refund for the merchant to
# approve natively in Shopify Admin. Actero never issues the refund itself.
print(json.dumps({
    'decision': 'draft_refund',
    'recommended': True,
    'amount': requested_amount,
    'reason': reason,
    'is_vip': is_vip,
    'order_id': order_id,
    'note': 'Brouillon de remboursement a valider par le marchand dans Shopify Admin.',
}))
`
