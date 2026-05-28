import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
  }
  return _resend;
}

const DEFAULT_FROM = process.env.DEFAULT_FROM_EMAIL || "AuraMint <noreply@novamintnetworks.in>";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Send an email via Resend.
 * Fire-and-forget safe — always catches errors.
 */
export async function sendEmail(payload: EmailPayload) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set, skipping:", payload.subject);
    return { success: false, error: "Not configured" };
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: DEFAULT_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return { success: false, error: "Send failed" };
  }
}
