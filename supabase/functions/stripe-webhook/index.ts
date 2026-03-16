import "@supabase/functions-js/edge-runtime.d.ts"
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  if (!endpointSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, endpointSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;

        if (userId) {
          const { error } = await supabaseAdmin
            .from("clients")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              status: "active",
              plan: plan
            })
            .eq("owner_user_id", userId);
            
          if (error) {
            console.error("Erreur DB update checkout.session.completed:", error);
          }
        }
        break;
      }
      
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const status = subscription.status; // e.g active, past_due, canceled
        
        const { error } = await supabaseAdmin
            .from("clients")
            .update({ status: status === "active" ? "active" : (status === "canceled" ? "canceled" : "past_due") })
            .eq("stripe_subscription_id", subscription.id);
            
        if (error) {
           console.error("Erreur DB update customer.subscription.updated:", error);
        }
        break;
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const { error } = await supabaseAdmin
            .from("clients")
            .update({ status: "canceled" })
            .eq("stripe_subscription_id", subscription.id);
            
        if (error) {
           console.error("Erreur DB update customer.subscription.deleted:", error);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { "Content-Type": "application/json" },
      status: 200 
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook Error: ${errorMessage}`);
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }
});
