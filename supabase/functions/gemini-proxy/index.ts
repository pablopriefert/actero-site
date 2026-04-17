import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const ALLOWED_ORIGINS = new Set([
  "https://actero.fr",
  "https://www.actero.fr",
])

function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? ""
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://actero.fr"
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }
}

async function isAdmin(userId: string): Promise<boolean> {
  if (!userId || !SUPABASE_SERVICE_ROLE_KEY) return false
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: row } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle()
  if (row) return true
  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  return authUser?.user?.app_metadata?.role === "admin"
}

serve(async (req) => {
  const cors = buildCors(req)

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  if (!(await isAdmin(userData.user.id))) {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { prompt, temperature, maxOutputTokens } = body as {
      prompt?: unknown
      temperature?: unknown
      maxOutputTokens?: unknown
    }

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const safeMaxTokens = Math.min(Number(maxOutputTokens) || 1500, 4096)
    const safeTemp = Math.max(0, Math.min(Number(temperature) || 0.7, 1.0))

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: safeTemp, maxOutputTokens: safeMaxTokens },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error("Gemini error:", geminiRes.status, errText)
      return new Response(JSON.stringify({ error: "Gemini request failed" }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const data = await geminiRes.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
    return new Response(JSON.stringify({ text }), {
      headers: { ...cors, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("gemini-proxy error:", error)
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})
