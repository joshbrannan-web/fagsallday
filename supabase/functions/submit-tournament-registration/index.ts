// Public registration submission with auto account creation + welcome email.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Rate limit per IP
const ipLimits = new Map<string, { count: number; resetAt: number }>();
const IP_LIMIT = 10;
const IP_WINDOW_MS = 60 * 60 * 1000;
function checkIpLimit(ip: string): boolean {
  const now = Date.now();
  const e = ipLimits.get(ip);
  if (!e || now > e.resetAt) {
    ipLimits.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    return true;
  }
  if (e.count >= IP_LIMIT) return false;
  e.count++;
  return true;
}

// Rate limit per email (avoid welcome-email abuse)
const emailLimits = new Map<string, { count: number; resetAt: number }>();
const EMAIL_LIMIT = 3;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;
function checkEmailLimit(email: string): boolean {
  const now = Date.now();
  const e = emailLimits.get(email);
  if (!e || now > e.resetAt) {
    emailLimits.set(email, { count: 1, resetAt: now + EMAIL_WINDOW_MS });
    return true;
  }
  if (e.count >= EMAIL_LIMIT) return false;
  e.count++;
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (!checkIpLimit(ip)) {
      return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const entry = body?.entry || {};
    const origin: string = String(body?.origin || "https://fagsallday.com");

    // Validate
    const fullName = String(entry.full_name || "").trim();
    const email = String(entry.email || "").trim().toLowerCase();
    const configId = String(entry.config_id || "").trim();

    if (!fullName || fullName.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid name" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!configId) {
      return new Response(JSON.stringify({ error: "Missing config_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const handicapIndex =
      entry.handicap_index === null || entry.handicap_index === undefined || entry.handicap_index === ""
        ? null
        : Number(entry.handicap_index);
    if (handicapIndex !== null && (isNaN(handicapIndex) || handicapIndex < -10 || handicapIndex > 54)) {
      return new Response(JSON.stringify({ error: "Invalid handicap" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ghinNumber = entry.ghin_number ? String(entry.ghin_number).trim() : null;
    if (ghinNumber && !/^\d{5,9}$/.test(ghinNumber)) {
      return new Response(JSON.stringify({ error: "Invalid GHIN number" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 0) Fetch tournament/config info for email content
    let tournamentName = "the tournament";
    let venmoLink: string | null = null;
    let amount: number | null = null;
    let amountLabel: string = "entry fee";
    {
      const { data: cfg } = await supabase
        .from("tournament_registration_configs")
        .select("name, venmo_link, amount, amount_label")
        .eq("id", configId)
        .maybeSingle();
      if (cfg) {
        tournamentName = cfg.name || tournamentName;
        venmoLink = cfg.venmo_link || null;
        amount = cfg.amount ?? null;
        amountLabel = cfg.amount_label || amountLabel;
      }
    }

    const ensureUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

    // 1) Look up existing user by email (paginated listUsers; for typical volumes single page is fine)
    let existingUserId: string | null = null;
    {
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (!error && data?.users) {
        const match = data.users.find((u: any) => (u.email || "").toLowerCase() === email);
        if (match) existingUserId = match.id;
      }
    }

    let accountCreated = false;
    let newUserId: string | null = null;

    // 2) Create account if needed
    if (!existingUserId) {
      if (!checkEmailLimit(email)) {
        return new Response(JSON.stringify({ error: "Too many submissions for this email. Try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          display_name: fullName,
          handicap_index: handicapIndex ?? 0,
        },
      });

      if (createErr || !created?.user) {
        console.error("createUser error:", createErr);
        // Fall back to no-account flow rather than failing the registration
      } else {
        newUserId = created.user.id;
        accountCreated = true;

        // Backfill GHIN fields on the profile (trigger doesn't set these)
        if (ghinNumber) {
          await supabase
            .from("profiles")
            .update({
              ghin_number: ghinNumber,
              ghin_last_synced: new Date().toISOString(),
            })
            .eq("id", newUserId);
        }
      }
    }

    const finalUserId = existingUserId || newUserId || (entry.user_id ?? null);

    // 3) Insert the registration entry
    const insertRow = {
      id: entry.id || crypto.randomUUID(),
      config_id: configId,
      user_id: finalUserId,
      full_name: fullName,
      email,
      phone: entry.phone ? String(entry.phone).trim() : null,
      handicap_index: handicapIndex,
      ghin_number: ghinNumber,
      payment_confirmed: !!entry.payment_confirmed,
      payment_amount:
        entry.payment_amount === null || entry.payment_amount === undefined || entry.payment_amount === ""
          ? null
          : Number(entry.payment_amount),
    };

    const { error: insertErr } = await supabase
      .from("tournament_registration_entries")
      .insert(insertRow);

    if (insertErr) {
      console.error("entry insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to save registration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Build shared registration confirmation block
    const venmoButtonHtml = venmoLink
      ? `
        <div style="text-align:center; margin:24px 0;">
          <a href="${ensureUrl(venmoLink)}" style="display:inline-block; background:#3D95CE; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:bold; font-size:16px;">
            Pay via Venmo
          </a>
        </div>`
      : "";

    const amountText = amount !== null
      ? ` your ${amountLabel.toLowerCase()} of $${amount}`
      : " your payment";

    const registrationBlockHtml = `
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:20px; margin:24px 0;">
        <h2 style="color:#16a34a; margin:0 0 12px 0; font-size:20px;">🏆 You're registered for ${tournamentName}!</h2>
        <p style="color:#4b5563; font-size:16px; line-height:1.6; margin:0 0 12px 0;">
          Congratulations — your registration for <strong>${tournamentName}</strong> has been received.
        </p>
        ${venmoLink
          ? `<p style="color:#4b5563; font-size:16px; line-height:1.6; margin:0;">
              If you haven't already, please submit${amountText} via Venmo below.
            </p>
            ${venmoButtonHtml}`
          : `<p style="color:#4b5563; font-size:16px; line-height:1.6; margin:0;">
              If you haven't already, please submit${amountText}.
            </p>`
        }
        <p style="color:#4b5563; font-size:14px; line-height:1.6; margin:12px 0 0 0;">
          Once your payment is confirmed, you'll receive an email from the Tournament Masters letting you know you're all set.
        </p>
      </div>
    `;

    // 5) Email send — combined welcome + registration for new users, registration-only for existing
    try {
      if (accountCreated) {
        const redirectTo = `${origin}/#/auth`;
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });

        const actionLink =
          (linkData as any)?.properties?.action_link ||
          (linkData as any)?.action_link ||
          redirectTo;

        if (linkErr) console.error("generateLink error:", linkErr);

        await resend.emails.send({
          from: "F&Gs All Day <noreply@fagsallday.com>",
          to: [email],
          subject: `Welcome to F&Gs All Day — you're registered for ${tournamentName}`,
          html: `
            <!DOCTYPE html>
            <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin:0; padding:0; background-color:#f4f4f4;">
              <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
                <div style="background:#ffffff; border-radius:12px; padding:40px; box-shadow:0 4px 6px rgba(0,0,0,0.08);">
                  <div style="text-align:center; margin-bottom:24px;">
                    <h1 style="color:#16a34a; margin:0; font-size:28px;">⛳ F&Gs All Day</h1>
                  </div>
                  <h2 style="color:#1f2937; margin:0 0 16px 0;">Welcome, ${fullName}!</h2>
                  <p style="color:#4b5563; font-size:16px; line-height:1.6;">
                    Thanks for registering. We've created an account for you so you can track scores, bets, and payouts during the tournament.
                  </p>
                  <p style="color:#4b5563; font-size:16px; line-height:1.6;">
                    Click the button below to set your password and finish setting up your account.
                  </p>
                  <div style="text-align:center; margin:30px 0;">
                    <a href="${actionLink}" style="display:inline-block; background:#16a34a; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:bold; font-size:16px;">
                      Set Your Password
                    </a>
                  </div>
                  <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin:24px 0;">
                    <p style="color:#4b5563; margin:4px 0;"><strong>Email:</strong> ${email}</p>
                    ${handicapIndex !== null ? `<p style="color:#4b5563; margin:4px 0;"><strong>Handicap Index:</strong> ${handicapIndex}</p>` : ""}
                    ${ghinNumber ? `<p style="color:#4b5563; margin:4px 0;"><strong>GHIN #:</strong> ${ghinNumber}</p>` : ""}
                  </div>
                  ${registrationBlockHtml}
                  <p style="color:#9ca3af; font-size:13px; text-align:center; margin-top:24px;">
                    If you didn't register for this tournament, you can ignore this email.
                  </p>
                </div>
                <p style="color:#9ca3af; font-size:12px; text-align:center; margin-top:20px;">
                  © 2025 F&Gs All Day
                </p>
              </div>
            </body></html>
          `,
        });
      } else {
        // Existing account — registration-only email
        await resend.emails.send({
          from: "F&Gs All Day <noreply@fagsallday.com>",
          to: [email],
          subject: `You're registered for ${tournamentName}`,
          html: `
            <!DOCTYPE html>
            <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin:0; padding:0; background-color:#f4f4f4;">
              <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
                <div style="background:#ffffff; border-radius:12px; padding:40px; box-shadow:0 4px 6px rgba(0,0,0,0.08);">
                  <div style="text-align:center; margin-bottom:24px;">
                    <h1 style="color:#16a34a; margin:0; font-size:28px;">⛳ F&Gs All Day</h1>
                  </div>
                  <h2 style="color:#1f2937; margin:0 0 16px 0;">Hi ${fullName},</h2>
                  ${registrationBlockHtml}
                  <p style="color:#9ca3af; font-size:13px; text-align:center; margin-top:24px;">
                    If you didn't register for this tournament, you can ignore this email.
                  </p>
                </div>
                <p style="color:#9ca3af; font-size:12px; text-align:center; margin-top:20px;">
                  © 2025 F&Gs All Day
                </p>
              </div>
            </body></html>
          `,
        });
      }
    } catch (e) {
      console.error("registration email send failed:", e);
    }

    // 5) Fire-and-forget Google Sheets sync (don't block response)
    try {
      supabase.functions.invoke("sync-registration-to-sheets", {
        body: { config_id: configId, entry: insertRow },
      }).catch((err) => console.warn("Sheet sync failed:", err));
    } catch (_e) {
      // ignore
    }

    return new Response(
      JSON.stringify({ ok: true, accountCreated, entry_id: insertRow.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("submit-tournament-registration error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
