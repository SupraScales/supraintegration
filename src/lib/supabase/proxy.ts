import { previewEvent, previewOperation, previewSupabaseConfig } from "@/lib/preview-diagnostics";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export async function refreshSupabaseSession(request: NextRequest) {
  const config = getSupabaseConfig();
  previewSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
  if (!config) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        previewEvent("proxy.cookies.write", "complete");
      },
    },
  });

  // getUser verifies the token with the Auth server and refreshes it when needed.
  await previewOperation("proxy.auth.getUser", () => supabase.auth.getUser());
  return response;
}
