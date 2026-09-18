import { sendEmail, type EmailSendResult } from "./resend";
import {
  renderDailyReportEmail,
  renderStreakReminderEmail,
  renderWeeklyDigestEmail,
  renderWelcomeEmail,
  type DailyReportEmailData,
  type LeaderboardEmailEntry,
} from "./render";

/**
 * Email transport wrappers. Rendering (and all HTML escaping) happens in
 * `./render`; these functions only pick a template and hand it to Resend.
 */

export type { DailyReportEmailData, LeaderboardEmailEntry };

// ─── 1. Welcome ───────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, username: string): Promise<EmailSendResult> {
  const { subject, html } = renderWelcomeEmail(username);
  return sendEmail({ to, subject, html });
}

// ─── 2. Daily aura report ─────────────────────────────────────

export async function sendDailyReportEmail(
  to: string,
  username: string,
  data: DailyReportEmailData
): Promise<EmailSendResult> {
  const { subject, html } = renderDailyReportEmail(username, data);
  return sendEmail({ to, subject, html });
}

// ─── 3. Streak reminder ───────────────────────────────────────

export async function sendStreakReminderEmail(
  to: string,
  username: string,
  streakDays: number
): Promise<EmailSendResult> {
  const { subject, html } = renderStreakReminderEmail(username, streakDays);
  return sendEmail({ to, subject, html });
}

// ─── 4. Weekly leaderboard digest ─────────────────────────────

export async function sendWeeklyDigestEmail(
  to: string,
  username: string,
  userRank: number | null,
  userAura: number,
  topPlayers: LeaderboardEmailEntry[]
): Promise<EmailSendResult> {
  const { subject, html } = renderWeeklyDigestEmail(username, userRank, userAura, topPlayers);
  return sendEmail({ to, subject, html });
}
