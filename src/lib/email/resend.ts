import { Resend } from "resend";
import { isValidEmailAddress, sanitizePlainText } from "@/lib/actions/safety";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!_resend) {
    _resend = new Resend(apiKey);
  }
  return _resend;
}

const DEFAULT_FROM = process.env.DEFAULT_FROM_EMAIL || "AuraMint <noreply@novamintnetworks.in>";

/** Bound the subject so the provider never receives a header-length payload. */
const SUBJECT_MAX_LENGTH = 200;

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

export type EmailSendResult =
  | { success: true; id?: string; error?: undefined }
  | { success: false; error: string; id?: undefined };

/**
 * Send an email via Resend.
 * Never throws — callers may use it fire-and-forget.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  // Validate the recipient before it can reach a header (CR/LF injection, junk).
  if (!isValidEmailAddress(payload.to)) {
    console.warn("[Email] Refusing to send to an invalid recipient");
    return { success: false, error: "Invalid recipient" };
  }

  const client = getResend();
  if (!client) {
    console.warn("[Email] RESEND_API_KEY not set, skipping:", sanitizePlainText(payload.subject, SUBJECT_MAX_LENGTH));
    return { success: false, error: "Not configured" };
  }

  const subject = sanitizePlainText(payload.subject, SUBJECT_MAX_LENGTH) || "AuraMint";
  if (!payload.html || payload.html.length === 0) {
    return { success: false, error: "Empty email body" };
  }

  try {
    const { data, error } = await client.emails.send({
      from: DEFAULT_FROM,
      to: payload.to,
      subject,
      html: payload.html,
    });

    if (error) {
      console.error("[Email] Resend error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return { success: false, error: "Send failed" };
  }
}
