import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createSystemClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) {
    throw new Error("SkyShare discovery requires the Supabase URL and server-only secret key.");
  }

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "supraintegration-skyshare-discovery" } },
  });
}
