import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const allowedOrigins = ["https://fagsallday.com", "https://www.fagsallday.com", "https://fagsallday.lovable.app"];

// Rate limiting: 10 password resets per minute per admin
const rateLimits = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 10;
  const limit = rateLimits.get(userId);
  if (!limit || now > limit.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (limit.count >= maxRequests) return false;
  limit.count++;
  return true;
}

interface ResetPasswordRequest {
  userId: string;
  userEmail: string;
  origin: string;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".lovable.app") || origin.endsWith(".lovableproject.com");
  const corsOrigin = isAllowed ? origin : allowedOrigins[0];
  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, userEmail, origin: requestOrigin }: ResetPasswordRequest = await req.json();
    if (!userId || !userEmail || !requestOrigin) {
      return new Response(
        JSON.stringify({ error: "userId, userEmail, and origin are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: userEmail,
      options: {
        redirectTo: `${requestOrigin}/#/auth?mode=reset`,
      },
    });

    const hashedToken = (linkData?.properties as any)?.hashed_token;
    if (linkError || !hashedToken) {
      throw linkError || new Error("Failed to generate reset link");
    }

    // Use token_hash + verifyOtp instead of action_link to defeat email link prefetchers.
    const resetLink = `${requestOrigin}/#/auth?mode=reset&token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;

    const emailResponse = await resend.emails.send({
      from: "Fags All Day Golf <noreply@fagsallday.com>",
      to: [userEmail],
      subject: "Password Reset Request",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #22c55e; font-size: 28px; font-weight: 700; margin: 0;">⛳ Fags All Day Golf</h1>
                </div>
                
                <h2 style="color: #18181b; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">Password Reset</h2>
                
                <p style="color: #52525b; font-size: 16px; margin: 0 0 24px 0;">
                  An administrator has initiated a password reset for your account. Click the button below to set a new password:
                </p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${resetLink}" style="display: inline-block; background-color: #22c55e; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                    Reset Password
                  </a>
                </div>
                
                <p style="color: #71717a; font-size: 14px; margin: 24px 0 0 0;">
                  If you didn't expect this email, you can safely ignore it. The link will expire in 24 hours.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
                
                <p style="color: #a1a1aa; font-size: 12px; margin: 0; text-align: center;">
                  This email was sent by an administrator on your behalf.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`Admin ${user.email} triggered password reset for ${userEmail}`);

    return new Response(
      JSON.stringify({ success: true, message: "Password reset email sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in admin-reset-password:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
