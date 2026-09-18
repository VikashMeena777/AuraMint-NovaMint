import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

let warnedAboutMissingEnv = false;

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if ((!url || !key) && !warnedAboutMissingEnv) {
    warnedAboutMissingEnv = true;
    // Loud on purpose: with a placeholder URL every query fails with a confusing error.
    console.error(
      "[Supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set — server queries will fail."
    );
  }

  return createServerClient(
    url || "https://placeholder.supabase.co",
    key || "placeholder-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
