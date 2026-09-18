import { NextResponse } from "next/server";
import { assertCronRequest } from "@/lib/supabase/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { reconcilePremiumEntitlements } from "@/lib/actions/payment-fulfillment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = assertCronRequest(request);
  if (unauthorized) return unauthorized;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  const result = await reconcilePremiumEntitlements(admin);
  if (!result.ok) {
    console.error("[Cron: Reconcile Payments] Failed:", result.error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
  return NextResponse.json(result, { status: result.failed > 0 ? 500 : 200 });
}
