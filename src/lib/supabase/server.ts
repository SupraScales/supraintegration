import "server-only";

import { previewEvent, previewOperation, previewSupabaseConfig } from "@/lib/preview-diagnostics";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

export async function createClient() {
  const config = getSupabaseConfig();
  previewSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
  if (!config) {
    return null;
  }

  const cookieStore = await previewOperation("server.cookies.read", cookies);

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
          previewEvent("server.cookies.write", "complete");
        } catch {
          previewEvent("server.cookies.write", "refused");
          // Server Components cannot write cookies. proxy.ts refreshes sessions.
        }
      },
    },
  });
}
