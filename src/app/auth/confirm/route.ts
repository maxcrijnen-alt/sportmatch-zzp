import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null, requestUrl: string): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/dashboard";
  }

  const requestOrigin = new URL(requestUrl).origin;
  const target = new URL(value, requestOrigin);

  if (target.origin !== requestOrigin) {
    return "/dashboard";
  }

  return `${target.pathname}${target.search}${target.hash}`;
}

/**
 * Landingsroute voor Supabase e-maillinks (wachtwoordherstel, bevestiging).
 * Wisselt de token in voor een sessie en stuurt uitsluitend door naar een
 * interne SportMatch-route.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), request.url);

  if (tokenHash && type) {
    const supabase = await createClient();

    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });

      if (!error) {
        return NextResponse.redirect(new URL(next, request.url));
      }
    }
  }

  return NextResponse.redirect(
    new URL("/login?fout=link-verlopen", request.url),
  );
}
