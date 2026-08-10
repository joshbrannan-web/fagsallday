// Shared GHIN lookup helper for edge functions.
// Returns the handicap index for a GHIN number, or null if unavailable.

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getGhinToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const ghinEmail = Deno.env.get("GHIN_EMAIL");
  const ghinPassword = Deno.env.get("GHIN_PASSWORD");
  if (!ghinEmail || !ghinPassword) {
    console.error("GHIN credentials not configured");
    return null;
  }

  const loginRes = await fetch("https://api2.ghin.com/api/v1/golfer_login.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: { email_or_ghin: ghinEmail, password: ghinPassword, remember_me: true },
      token: "123",
    }),
  });

  if (!loginRes.ok) {
    console.error("GHIN login failed:", loginRes.status);
    return null;
  }

  const loginData = await loginRes.json();
  const token = loginData?.golfer_user?.golfer_user_token;
  if (!token) return null;

  cachedToken = { token, expiresAt: Date.now() + 20 * 60 * 1000 };
  return token;
}

export async function lookupGhinHandicap(ghinNumber: string): Promise<number | null> {
  const ghin = String(ghinNumber || "").trim();
  if (!/^\d{5,9}$/.test(ghin)) return null;

  try {
    const token = await getGhinToken();
    if (!token) return null;

    const searchRes = await fetch(
      `https://api2.ghin.com/api/v1/golfers/search.json?golfer_id=${ghin}&status=Active&per_page=10&page=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!searchRes.ok) {
      console.error("GHIN search failed:", searchRes.status);
      return null;
    }

    const searchData = await searchRes.json();
    const golfers: any[] = searchData?.golfers || [];

    const extractIds = (g: any): string[] =>
      [g?.golfer_id, g?.ghin_no, g?.ghin_number, g?.GHINNumber, g?.ghin, g?.id]
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v).trim());

    const golfer = golfers.find((g: any) => extractIds(g).includes(ghin));
    if (!golfer) return null;

    const handicapIndex = parseFloat(golfer.handicap_index);
    return isNaN(handicapIndex) ? null : handicapIndex;
  } catch (err) {
    console.error("lookupGhinHandicap error:", err);
    return null;
  }
}
