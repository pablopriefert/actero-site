import "@supabase/functions-js/edge-runtime.d.ts"
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const { plan, returnUrl } = await req.json();

    // Validate returnUrl against allowed domains to prevent open redirect
    const ALLOWED_DOMAINS = ['actero.fr', 'www.actero.fr'];
    let safeReturnUrl = 'https://actero.fr';
    if (returnUrl) {
      try {
        const parsedUrl = new URL(returnUrl);
        if (ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
          safeReturnUrl = returnUrl;
        }
      } catch {
        // Invalid URL, use default
      }
    }

    const planPrices: Record<string, number> = {
      "croissance_automatisee": 119900, // 1199.00€
    };

    const amount = planPrices[plan];
    if (!amount) {
      throw new Error("Invalid plan specified");
    }

    const { data: clientData } = await supabaseClient
      .from("clients")
      .select("stripe_customer_id")
      .eq("owner_user_id", user.id)
      .single();

    let customerId = clientData?.stripe_customer_id;

    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
                supabase_user_id: user.id
            }
        });
        customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: plan === "croissance_automatisee" ? "Croissance Automatisée" : "Abonnement Actero",
              description: "Facturation mensuelle pour l'infrastructure."
            },
            unit_amount: amount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${safeReturnUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${safeReturnUrl}/payment/cancel`,
      metadata: {
        user_id: user.id,
        plan: plan,
      },
    });

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
