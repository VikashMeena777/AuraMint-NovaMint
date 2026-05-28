import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/actions/payment-actions";

/**
 * Payment verify fallback — called when user returns from Cashfree.
 * Checks payment status via Cashfree API and redirects accordingly.
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("order_id");

  if (!orderId) {
    return NextResponse.redirect(new URL("/premium?status=error", req.url));
  }

  const result = await verifyPayment(orderId);

  if (result.success && result.status === "PAID") {
    return NextResponse.redirect(new URL("/premium?status=success", req.url));
  }

  return NextResponse.redirect(new URL(`/premium?status=${result.status || "pending"}`, req.url));
}
