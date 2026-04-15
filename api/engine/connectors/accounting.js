import { createClient } from '@supabase/supabase-js'
import { decryptToken } from '../../lib/crypto.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Fetch overdue invoices from the client's accounting tool.
 */
export async function fetchOverdueInvoices(clientId) {
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('provider, api_key, extra_config')
    .eq('client_id', clientId)
    .in('provider', ['axonaut', 'pennylane', 'ipaidthat'])
    .eq('status', 'active')
    .maybeSingle()

  if (!integration) return { invoices: [], provider: null }

  const apiKey = decryptToken(integration.api_key)

  try {
    switch (integration.provider) {
      case 'axonaut': return await fetchAxonautInvoices(apiKey)
      case 'pennylane': return await fetchPennylaneInvoices(apiKey)
      case 'ipaidthat': return await fetchIpaidthatInvoices(apiKey)
      default: return { invoices: [], provider: integration.provider }
    }
  } catch (err) {
    console.error(`[accounting] ${integration.provider} fetch error:`, err.message)
    return { invoices: [], provider: integration.provider, error: err.message }
  }
}

async function fetchAxonautInvoices(apiKey) {
  const res = await fetch('https://axonaut.com/api/v2/invoices?status=late', {
    headers: { 'userApiKey': apiKey }
  })
  if (!res.ok) throw new Error(`Axonaut API ${res.status}`)
  const data = await res.json()
  return {
    invoices: (data.invoices || data || []).map(inv => ({
      id: inv.id,
      number: inv.number || inv.invoice_number,
      client_name: inv.company_name || inv.customer_name,
      client_email: inv.email,
      amount: inv.total_amount || inv.amount,
      due_date: inv.due_date,
      days_overdue: Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000),
    })),
    provider: 'axonaut',
  }
}

async function fetchPennylaneInvoices(apiKey) {
  const res = await fetch('https://app.pennylane.com/api/external/v1/customer_invoices?filter[status]=overdue', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  })
  if (!res.ok) throw new Error(`Pennylane API ${res.status}`)
  const data = await res.json()
  return {
    invoices: (data.invoices || data.data || []).map(inv => ({
      id: inv.id,
      number: inv.invoice_number,
      client_name: inv.customer?.name,
      client_email: inv.customer?.email,
      amount: inv.amount || inv.total,
      due_date: inv.due_date || inv.deadline,
      days_overdue: Math.floor((Date.now() - new Date(inv.due_date || inv.deadline).getTime()) / 86400000),
    })),
    provider: 'pennylane',
  }
}

async function fetchIpaidthatInvoices(apiKey) {
  const res = await fetch('https://app.ipaidthat.io/api/v2/invoices?status=overdue', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  })
  if (!res.ok) throw new Error(`iPaidThat API ${res.status}`)
  const data = await res.json()
  return {
    invoices: (data.results || data.invoices || []).map(inv => ({
      id: inv.id,
      number: inv.reference,
      client_name: inv.contact_name || inv.supplier_name,
      client_email: inv.contact_email,
      amount: inv.total_amount || inv.amount,
      due_date: inv.due_date,
      days_overdue: Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000),
    })),
    provider: 'ipaidthat',
  }
}

/**
 * Fetch treasury/cash balance summary.
 */
export async function fetchTreasuryBalance(clientId) {
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('provider, api_key')
    .eq('client_id', clientId)
    .in('provider', ['axonaut', 'pennylane', 'ipaidthat'])
    .eq('status', 'active')
    .maybeSingle()

  if (!integration) return { balance: null, provider: null }

  // Each provider has different treasury endpoints
  // For now, return the overdue total as a proxy
  const { invoices } = await fetchOverdueInvoices(clientId)
  const totalOverdue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)

  return {
    total_overdue: totalOverdue,
    overdue_count: invoices.length,
    provider: integration.provider,
  }
}
