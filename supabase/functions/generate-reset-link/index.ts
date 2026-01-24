import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting for password reset abuse prevention
const resetRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkResetRateLimit(email: string): boolean {
  const identifier = email.toLowerCase().trim();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 3; // 3 requests per 15 minutes per email
  
  const limit = resetRateLimits.get(identifier);
  
  if (!limit || now > limit.resetAt) {
    resetRateLimits.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

interface GenerateResetLinkRequest {
  email: string;
  origin: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, origin }: GenerateResetLinkRequest = await req.json();

    if (!email || !origin) {
      return new Response(
        JSON.stringify({ error: "Email and origin are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Rate limiting to prevent email bombing
    if (!checkResetRateLimit(email)) {
      console.log("Rate limit exceeded for password reset:", email);
      // Return success to prevent user enumeration (don't reveal if email exists)
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists with this email, a reset link has been sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Generating password reset link for:", email);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Always use production URL for password reset redirects
    const PRODUCTION_URL = "https://fagsallday.com";
    
    // Generate the reset link using Admin API (this does NOT send Supabase's default email)
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${PRODUCTION_URL}/#/auth?mode=reset`,
      },
    });

    if (error) {
      console.error("Error generating reset link:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resetLink = data.properties?.action_link;

    if (!resetLink) {
      console.error("No action link returned from Supabase");
      return new Response(
        JSON.stringify({ error: "Failed to generate reset link" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Reset link generated successfully, sending branded email...");

    // Send the custom branded email with the actual reset link
    const emailResponse = await resend.emails.send({
      from: "F&Gs All Day <noreply@fagsallday.com>",
      to: [email],
      subject: "Reset Your Password - F&Gs All Day",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f4; margin: 0; padding: 20px;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1c1917; font-size: 24px; margin: 0;">
                F&Gs <span style="color: #16a34a;">All Day</span>
              </h1>
            </div>
            
            <div style="color: #44403c;">
              <h2 style="font-size: 20px; margin-bottom: 20px; color: #1c1917;">Reset Your Password</h2>
              
              <p>We received a request to reset the password for your account.</p>
              
              <p>Click the button below to set a new password:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Reset Password
                </a>
              </div>
              
              <p style="color: #78716c; font-size: 14px;">
                This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center;">
                Need help? Visit <a href="https://fagsallday.com" style="color: #16a34a;">fagsallday.com</a>
              </p>
            </div>
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
              © 2025 F&Gs All Day. Track scores, bets, and payouts automatically.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Password reset email sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in generate-reset-link function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
