import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/actions/payment-actions";
import { isValidOrderId, resolveTrustedOrigin, safeStatusToken } from "@/lib/actions/safety";

/**
 * Payment verify fallback — called when the user returns from Cashfree.
 *
 * Ownership, amount/currency and idempotency are enforced inside `verifyPayment`;
 * this handler only maps the outcome onto a redirect.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Never build a redirect target from an attacker-controllable Host header.
  const origin = resolveTrustedOrigin(process.env.NEXT_PUBLIC_APP_URL, req.url);
  const orderId = req.nextUrl.searchParams.get("order_id");

  const redirectWith = (status: string) =>
    NextResponse.redirect(new URL(`/premium?status=${status}`, origin));

  if (!isValidOrderId(orderId)) {
    return redirectWith("error");
  }

  try {
    const result = await verifyPayment(orderId);

    if (result.error) {
      return redirectWith("error");
    }

    if (result.success && result.status === "PAID") {
      return redirectWith("success");
    }

    // Provider statuses are uppercase tokens; anything unexpected becomes "pending".
    return redirectWith(safeStatusToken(result.status, "pending"));
  } catch (err) {
    console.error("[Payments/verify] Unexpected error:", err);
    return redirectWith("error");
  }
}
