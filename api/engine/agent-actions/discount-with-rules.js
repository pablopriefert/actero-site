/**
 * Wrapper script that runs in an E2B sandbox to evaluate the merchant's
 * discount policy. Same architecture as refund-with-rules.js — keeps the
 * merchant's Python code in a per-call isolated VM, returns a JSON
 * decision, audits everything in agent_action_logs.
 *
 * Inputs in /workspace/context.json:
 *   {
 *     policy_code: string  (Python source defining `decide_discount`)
 *     cart: { total_value, currency, items_count, items?, ... }
 *     customer: { clv, orders_count, email_domain, is_subscribed?, ... }
 *     policy_caps: { max_pct }   (hard cap enforced after the policy returns)
 *   }
 *
 * Output (last stdout line, JSON):
 *   { discount_pct: number 0..max_pct, reason: string, raw?: any }
 */

export const DISCOUNT_SANDBOX_SCRIPT = `
import json
import traceback
from pathlib import Path

ctx = json.loads(Path('/workspace/context.json').read_text())

namespace = {}
try:
    exec(ctx['policy_code'], namespace)
except Exception as e:
    print(json.dumps({
        'error': 'policy_compile_error',
        'detail': str(e),
        'trace': traceback.format_exc().splitlines()[-3:],
    }))
    raise SystemExit(0)

if 'decide_discount' not in namespace or not callable(namespace['decide_discount']):
    print(json.dumps({
        'error': 'missing_decide_discount',
        'detail': 'Policy must define a callable decide_discount(cart, customer, policy_caps).',
    }))
    raise SystemExit(0)

try:
    raw = namespace['decide_discount'](
        ctx.get('cart', {}),
        ctx.get('customer', {}),
        ctx.get('policy_caps', {}),
    )
except Exception as e:
    print(json.dumps({
        'error': 'policy_runtime_error',
        'detail': str(e),
        'trace': traceback.format_exc().splitlines()[-3:],
    }))
    raise SystemExit(0)

# Coerce + clamp the result so a sloppy policy can't blow the margin.
max_pct = float(ctx.get('policy_caps', {}).get('max_pct', 15))
try:
    pct = float(raw.get('discount_pct', 0)) if isinstance(raw, dict) else float(raw or 0)
except Exception:
    pct = 0.0
pct = max(0.0, min(pct, max_pct))
reason = str(raw.get('reason', 'unspecified')) if isinstance(raw, dict) else 'unspecified'

print(json.dumps({
    'discount_pct': round(pct, 2),
    'reason': reason,
    'capped_at': max_pct,
    'raw': raw if isinstance(raw, (dict, list, str, int, float, bool)) or raw is None else str(raw),
}))
`

/**
 * Default policy shipped to new merchants — they edit this in the dashboard.
 * Conservative: zero discount on first orders, modest tier for repeat customers,
 * higher tier for proven VIPs. Caps enforced by the wrapper above.
 */
export const DEFAULT_DISCOUNT_POLICY = `def decide_discount(cart, customer, policy_caps):
    """Return {'discount_pct': N, 'reason': '...'}.
    Hard cap (policy_caps['max_pct']) is enforced AFTER this function returns.

    Available data:
      cart.total_value      EUR cart subtotal
      cart.currency         'EUR' / 'USD' / ...
      cart.items_count      int
      customer.clv          lifetime value EUR
      customer.orders_count int
      customer.email_domain string
    """
    cart_value = float(cart.get('total_value', 0))
    clv = float(customer.get('clv', 0))
    orders = int(customer.get('orders_count', 0))

    # First-time buyer with a tiny cart: don't burn margin
    if orders == 0 and cart_value < 50:
        return {'discount_pct': 0, 'reason': 'first_order_low_cart_no_discount'}

    # VIP repeat customer with a meaningful cart
    if clv >= 500 and cart_value >= 100:
        return {'discount_pct': 15, 'reason': 'vip_high_cart'}

    # Standard repeat customer
    if orders >= 1 and cart_value >= 80:
        return {'discount_pct': 10, 'reason': 'repeat_customer_above_80'}

    # Default win-back nudge
    return {'discount_pct': 5, 'reason': 'standard_default'}
`
