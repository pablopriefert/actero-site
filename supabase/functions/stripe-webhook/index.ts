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

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") || "Actero <onboarding@resend.dev>";
const SITE_URL = Deno.env.get("SITE_URL") || "https://actero.fr";

async function sendDashboardAccessEmail(email: string, password: string, companyName: string, clientType: string) {
  const isImmo = clientType === "immobilier";
  const dashboardDesc = isImmo
    ? "votre dashboard de suivi immobilier"
    : "votre dashboard e-commerce";

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8f8;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:40px 40px 0 40px;">
          <div style="font-size:22px;font-weight:700;color:#000000;letter-spacing:-0.5px;">Actero</div>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <h1 style="font-size:24px;font-weight:700;color:#000000;margin:0 0 20px 0;line-height:1.3;">
            Bienvenue ${companyName} !
          </h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px 0;">
            Votre paiement a été confirmé. Voici vos identifiants pour accéder à ${dashboardDesc}.
          </p>
          <div style="background-color:#fafafa;border:1px solid #eee;border-radius:12px;padding:20px;margin:0 0 24px 0;">
            <div style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0 0 12px 0;">Vos identifiants</div>
            <div style="font-size:15px;color:#222;margin:0 0 8px 0;">Email : <strong>${email}</strong></div>
            <div style="font-size:15px;color:#222;">Mot de passe : <strong>${password}</strong></div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:4px 0 28px 0;">
              <a href="${SITE_URL}/login" style="display:inline-block;background-color:#000000;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:12px;letter-spacing:-0.2px;">
                Accéder à mon dashboard
              </a>
            </td></tr>
          </table>
          <p style="font-size:13px;color:#888;margin:0;">Pensez à modifier votre mot de passe après votre première connexion.</p>
        </td></tr>
        <tr><td style="padding:20px 40px;background-color:#fafafa;border-top:1px solid #eee;">
          <p style="font-size:11px;color:#aaa;margin:0;text-align:center;line-height:1.5;">Cet email a été envoyé par Actero · actero.fr</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [email],
      subject: "Vos accès Actero sont prêts",
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
  }
}

function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
  let password = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, endpointSecret!);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const slug = session.metadata?.client;
        const clientType = session.metadata?.client_type || "ecommerce";
        const userId = session.metadata?.user_id;

        // Flow 1: Funnel-based checkout (slug in metadata, no user_id)
        if (slug && !userId) {
          // Look up funnel client
          const { data: funnelClient, error: funnelErr } = await supabaseAdmin
            .from("funnel_clients")
            .select("*")
            .eq("slug", slug)
            .single();

          if (funnelErr || !funnelClient) {
            console.error("Funnel client not found for slug:", slug, funnelErr);
            break;
          }

          const email = funnelClient.email;
          const companyName = funnelClient.company_name;
          const password = generatePassword();

          // Create auth user
          const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { company_name: companyName },
          });

          if (authErr) {
            console.error("Error creating auth user:", authErr);
            break;
          }

          const newUserId = authData.user.id;

          // Create profile
          await supabaseAdmin.from("profiles").upsert({
            id: newUserId,
            email,
            role: "client",
          });

          // Create client record
          const { data: newClient, error: clientErr } = await supabaseAdmin
            .from("clients")
            .insert({
              brand_name: companyName,
              owner_user_id: newUserId,
              client_type: clientType,
              status: "active",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan: "actero_custom",
            })
            .select()
            .single();

          if (clientErr) {
            console.error("Error creating client:", clientErr);
            break;
          }

          // Create client_users mapping
          await supabaseAdmin.from("client_users").insert({
            client_id: newClient.id,
            user_id: newUserId,
            role: "owner",
          });

          // Create client_settings with ROI config from funnel
          await supabaseAdmin.from("client_settings").insert({
            client_id: newClient.id,
            hourly_cost: funnelClient.hourly_cost || (clientType === "immobilier" ? 30 : 25),
            avg_ticket_time_min: funnelClient.avg_ticket_time_min || (clientType === "immobilier" ? 8 : 5),
            actero_monthly_price: funnelClient.actero_monthly_price || funnelClient.monthly_price || 800,
            currency: "EUR",
          });

          // Update funnel client status to paid
          await supabaseAdmin
            .from("funnel_clients")
            .update({ status: "paid" })
            .eq("id", funnelClient.id);

          // Send dashboard access email
          await sendDashboardAccessEmail(email, password, companyName, clientType);

          console.log(`Funnel client ${companyName} activated: ${newClient.id}`);
        }

        // Flow 2: Direct checkout (user_id in metadata)
        if (userId) {
          const { error } = await supabaseAdmin
            .from("clients")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              status: "active",
              plan: session.metadata?.plan,
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
        const status = subscription.status;

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
