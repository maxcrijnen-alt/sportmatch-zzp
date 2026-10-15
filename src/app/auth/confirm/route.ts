import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeAuthRedirect } from "@/lib/auth/safe-next-path";

/**
 * Landingsroute voor Supabase e-maillinks (wachtwoordherstel, bevestiging).
 * Wisselt de token in voor een sessie en stuurt uitsluitend door naar een
 * interne SportMatch-route.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeAuthRedirect(searchParams.get("next"), request.url);

  if (tokenHash && type) {
    const supabase = await createClient();

    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });

      if (!error) {
        // Use the validated URL itself: reparsing a normalized //path could
        // turn an internal destination into an external redirect.
        return NextResponse.redirect(next);
      }
    }
  }

  return NextResponse.redirect(
    new URL("/login?fout=link-verlopen", request.url),
  );
}
