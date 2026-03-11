import { supabase } from './supabase'

/**
 * Calls the 'gemini-proxy' Supabase Edge Function to interact with Gemini safely.
 * @param {string} prompt - The prompt to send to Gemini.
 * @returns {Promise<any>} - The response from the Edge Function.
 */
export async function callGemini(prompt) {
  const { data, error } = await supabase.functions.invoke('gemini-proxy', {
    body: { prompt },
  })

  if (error) {
    console.error('Error calling gemini-proxy:', error)
    throw error
  }

  return data
}
