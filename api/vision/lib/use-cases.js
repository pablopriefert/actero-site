// api/vision/lib/use-cases.js
/**
 * Prompt library for the 6 primary e-commerce vision use-cases.
 * Each template returns a strict JSON contract that brain.js injects
 * into the LLM context when composing the final customer reply.
 */

const JSON_SHAPE = `{
  "description": "short neutral description of what is visible (max 40 words)",
  "detected_issue": "what is wrong if anything, null otherwise",
  "extracted_data": { "key1": "value1", "...": "..." },
  "recommended_action": "one of: create_return | create_exchange | escalate_tech | lookup_order | request_more_info | answer_directly",
  "confidence": 0.0 to 1.0
}`

export const USE_CASES = {
  broken_product: {
    prompt: `The customer sent this photo claiming their product is BROKEN or DEFECTIVE. Analyze the visible damage (cracks, dents, missing parts, stains, malfunction). Output JSON:\n${JSON_SHAPE}\n\nextracted_data keys to include if visible: product_name, visible_damage, damage_severity (minor|moderate|severe).`,
    default_action: 'create_return',
  },
  checkout_error: {
    prompt: `The customer sent a screenshot of a CHECKOUT or PAYMENT ERROR on the merchant's Shopify store. Identify the error shown. Output JSON:\n${JSON_SHAPE}\n\nextracted_data keys to include: error_message, step (cart|checkout|payment|shipping|other), browser_if_visible.`,
    default_action: 'escalate_tech',
  },
  shipping_label: {
    prompt: `The customer sent a photo of a SHIPPING LABEL or tracking barcode. Extract the tracking number and carrier. Output JSON:\n${JSON_SHAPE}\n\nextracted_data keys to include: carrier (colissimo|dhl|ups|mondial_relay|chronopost|other), tracking_number, destination_if_visible.`,
    default_action: 'lookup_order',
  },
  invoice_receipt: {
    prompt: `The customer sent a photo of an INVOICE or ORDER RECEIPT (maybe from our store, maybe physical). Extract the order number. Output JSON:\n${JSON_SHAPE}\n\nextracted_data keys to include: order_number, order_date_if_visible, total_amount_if_visible, currency.`,
    default_action: 'lookup_order',
  },
  product_received: {
    prompt: `The customer sent a photo of a product they RECEIVED but something is wrong (wrong size, wrong color, wrong item, not what was ordered). Output JSON:\n${JSON_SHAPE}\n\nextracted_data keys to include: product_name, visible_issue (wrong_size|wrong_color|wrong_item|other), received_details.`,
    default_action: 'create_exchange',
  },
  other: {
    prompt: `Analyze this customer-support image and describe what you see. Output JSON:\n${JSON_SHAPE}\n\nextracted_data can include any relevant fields you identify.`,
    default_action: 'request_more_info',
  },
}

/**
 * If the caller doesn't pass a hint, we let Claude auto-detect using all
 * prompts concatenated. In practice, we'll route by use-case once the
 * context_text gives hints (see brain.js heuristics).
 */
export function buildPromptFor(useCase, contextText) {
  const uc = USE_CASES[useCase] || USE_CASES.other
  const ctx = contextText ? `\n\nCUSTOMER MESSAGE CONTEXT (may help interpret the image):\n"${contextText.slice(0, 500)}"` : ''
  return uc.prompt + ctx
}

export function defaultActionFor(useCase) {
  return USE_CASES[useCase]?.default_action || 'request_more_info'
}
