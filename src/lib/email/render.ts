/**
 * Pure email renderers.
 *
 * Every value that originates from a user (username, event description, AI output) or
 * from another user (leaderboard usernames) is HTML-escaped here. Templates are pure
 * functions so the escaping can be regression-tested without sending mail.
 */

import { formatAuraPoints } from "@/lib/utils";
import { escapeHtml, sanitizePlainText, truncateCodePoints } from "@/lib/actions/safety";
import { emailLayout } from "./templates";

const TODAY_LINK = "https://auramint.novamintnetworks.in";

export type RenderedEmail = {
  subject: string;
  html: string;
};

export type DailyReportEmailData = {
  totalEvents: number;
  totalAura: number;
  biggestW: { description: string; points: number; emoji: string } | null;
  biggestL: { description: string; points: number; emoji: string } | null;
  vibeOfTheDay: string;
  streakDays: number;
  tier: string;
};

export type LeaderboardEmailEntry = {
  rank: number;
  username: string;
  total_aura: number;
  tier: string;
};

/** Escapes + bounds a username shown in an email. */
function safeUsername(username: unknown): string {
  return escapeHtml(sanitizePlainText(username, 20) || "AuraMinter");
}

/** Escapes + bounds an AI-generated label (verdict/vibe/tier). */
function safeLabel(value: unknown, maxLength: number): string {
  return escapeHtml(sanitizePlainText(value, maxLength));
}

/** Escapes + bounds free-text user content (event descriptions). */
function safeUserText(value: unknown, maxLength: number): string {
  const text = sanitizePlainText(value, maxLength);
  return escapeHtml(text);
}

function safeEmoji(value: unknown, fallback: string): string {
  const emoji = truncateCodePoints(sanitizePlainText(value, 16), 4);
  return escapeHtml(emoji || fallback);
}

// ─── 1. Welcome ───────────────────────────────────────────────

export function renderWelcomeEmail(username: string): RenderedEmail {
  const name = safeUsername(username);

  const html = emailLayout(
    `
    <h1>Welcome to AuraMint, @${name}! 👑</h1>
    <p>Your aura journey begins now. Here's how to get started:</p>

    <div class="list-item">
      <span class="list-icon">⚡</span>
      <span class="list-text"><strong>Log your moments</strong> — Describe what happened and our AI will rate your aura impact</span>
    </div>
    <div class="list-item">
      <span class="list-icon">🔥</span>
      <span class="list-text"><strong>Build your streak</strong> — Log daily to keep your streak alive and climb tiers</span>
    </div>
    <div class="list-item">
      <span class="list-icon">🏆</span>
      <span class="list-text"><strong>Compete on the leaderboard</strong> — Flex your aura and earn badges</span>
    </div>
    <div class="list-item">
      <span class="list-icon">📸</span>
      <span class="list-text"><strong>Share your W's and L's</strong> — Generate branded cards to share on social media</span>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="${TODAY_LINK}/dashboard" class="btn">Start Minting Aura →</a>
    </div>

    <p style="text-align: center; font-size: 12px; color: #6b6560;">
      You're starting as a <span class="badge">🗿 NPC</span> — time to level up.
    </p>
  `,
    "Welcome to AuraMint! Your aura journey starts now 👑"
  );

  return { subject: "Welcome to AuraMint! 👑 Your aura journey starts now", html };
}

// ─── 2. Daily aura report ─────────────────────────────────────

export function renderDailyReportEmail(username: string, data: DailyReportEmailData): RenderedEmail {
  const name = safeUsername(username);
  const isPositiveDay = data.totalAura >= 0;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  const totalEvents = Math.max(0, Math.trunc(Number(data.totalEvents) || 0));
  const streakDays = Math.max(0, Math.trunc(Number(data.streakDays) || 0));
  const totalAura = Number(data.totalAura) || 0;
  const vibe = safeLabel(data.vibeOfTheDay, 40) || "Chill";
  const tier = safeLabel(data.tier, 40) || "NPC";

  const biggestW = data.biggestW
    ? `
    <div class="stat-card">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="emoji">${safeEmoji(data.biggestW.emoji, "⚡")}</span>
        <div>
          <div class="stat-label">Biggest W</div>
          <span class="positive" style="font-weight: 700; font-size: 16px;">${escapeHtml(
            formatAuraPoints(Number(data.biggestW.points) || 0)
          )}</span>
        </div>
      </div>
      <p style="font-size: 12px; margin-top: 8px;">"${safeUserText(data.biggestW.description, 80)}"</p>
    </div>`
    : "";

  const biggestL = data.biggestL
    ? `
    <div class="stat-card">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="emoji">${safeEmoji(data.biggestL.emoji, "💀")}</span>
        <div>
          <div class="stat-label">Biggest L</div>
          <span class="negative" style="font-weight: 700; font-size: 16px;">${escapeHtml(
            formatAuraPoints(Number(data.biggestL.points) || 0)
          )}</span>
        </div>
      </div>
      <p style="font-size: 12px; margin-top: 8px;">"${safeUserText(data.biggestL.description, 80)}"</p>
    </div>`
    : "";

  const html = emailLayout(
    `
    <p style="font-size: 12px; color: #6b6560; margin-bottom: 4px;">${escapeHtml(today)}</p>
    <h1>${isPositiveDay ? "📈" : "📉"} Daily Aura Report</h1>
    <p>Here's how your aura looked today, @${name}:</p>

    <div class="stat-card" style="text-align: center;">
      <div class="stat-value ${isPositiveDay ? "positive" : "negative"}">
        ${escapeHtml(formatAuraPoints(totalAura))}
      </div>
      <div class="stat-label">Total Aura ${isPositiveDay ? "Gained" : "Lost"} Today</div>
      <p style="font-size: 12px; color: #6b6560; margin-top: 8px;">
        From ${totalEvents} event${totalEvents !== 1 ? "s" : ""} · ${streakDays > 0 ? `🔥 ${streakDays}d streak` : "No streak"}
      </p>
    </div>

    ${biggestW}
    ${biggestL}

    <div class="divider"></div>

    <p style="text-align: center;">
      Vibe of the day: <span class="badge">✨ ${vibe}</span>
      <br/><br/>
      Current tier: <strong>${tier}</strong>
    </p>

    <div style="text-align: center; margin-top: 16px;">
      <a href="${TODAY_LINK}/dashboard" class="btn">View Full Report →</a>
    </div>
  `,
    `${isPositiveDay ? "📈" : "📉"} ${formatAuraPoints(totalAura)} aura today — ${vibe}`
  );

  return {
    subject: `${isPositiveDay ? "📈" : "📉"} Your daily aura report — ${formatAuraPoints(totalAura)} today`,
    html,
  };
}

// ─── 3. Streak reminder ───────────────────────────────────────

export function renderStreakReminderEmail(username: string, streakDays: number): RenderedEmail {
  const name = safeUsername(username);
  const streak = Math.max(2, Math.trunc(Number(streakDays) || 2));

  const html = emailLayout(
    `
    <div style="text-align: center;">
      <span style="font-size: 48px;">🔥</span>
      <h1>Your ${streak}-day streak is about to break!</h1>
      <p>Hey @${name}, you haven't logged any aura today. Your streak is on the line!</p>

      <div class="stat-card" style="text-align: center;">
        <div class="stat-value" style="color: #fb923c;">${streak}</div>
        <div class="stat-label">Day Streak at Risk</div>
      </div>

      <p>Log just one event to keep your streak alive. It takes 30 seconds.</p>

      <a href="${TODAY_LINK}/dashboard" class="btn">Log an Event Now 🔥</a>

      <p style="font-size: 12px; color: #6b6560;">
        Don't let your grind go to waste. Every day counts.
      </p>
    </div>
  `,
    `🔥 Your ${streak}-day streak is about to break! Log an event now`
  );

  return { subject: `🔥 Your ${streak}-day streak is about to break!`, html };
}

// ─── 4. Weekly leaderboard digest ─────────────────────────────

export function renderWeeklyDigestEmail(
  username: string,
  userRank: number | null,
  userAura: number,
  topPlayers: LeaderboardEmailEntry[]
): RenderedEmail {
  const name = safeUsername(username);
  const aura = Number(userAura) || 0;

  const top5Rows = (Array.isArray(topPlayers) ? topPlayers : [])
    .slice(0, 5)
    .map((player) => {
      const rank = Math.max(1, Math.trunc(Number(player.rank) || 1));
      const playerAura = Number(player.total_aura) || 0;
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
      const rankColor = rank <= 3 ? "#e89b29" : "#a09a90";

      return `
      <tr>
        <td style="padding: 8px 12px; font-size: 14px; color: ${rankColor}; font-weight: ${rank <= 3 ? "700" : "400"};">
          ${medal}
        </td>
        <td style="padding: 8px 12px; font-size: 14px; color: #e0dcd5;">@${escapeHtml(
          sanitizePlainText(player.username, 20) || "Anonymous"
        )}</td>
        <td style="padding: 8px 12px; font-size: 14px; font-weight: 700; color: ${
          playerAura >= 0 ? "#34d399" : "#f87171"
        }; text-align: right; font-family: monospace;">
          ${escapeHtml(formatAuraPoints(playerAura))}
        </td>
      </tr>
    `;
    })
    .join("");

  const rankBlock =
    userRank !== null && Number.isFinite(userRank)
      ? `
    <div class="stat-card" style="text-align: center; margin-top: 16px;">
      <div class="stat-label">Your Rank</div>
      <div class="stat-value" style="color: #e89b29;">#${Math.max(1, Math.trunc(Number(userRank)))}</div>
      <p style="font-size: 12px; color: #6b6560; margin-top: 4px;">
        with ${escapeHtml(formatAuraPoints(aura))} total aura
      </p>
    </div>`
      : "";

  const html = emailLayout(
    `
    <h1>🏆 Weekly Leaderboard Digest</h1>
    <p>Here's who dominated the aura game this week, @${name}:</p>

    <div class="stat-card" style="padding: 0; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
            <th style="padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #6b6560;">Rank</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #6b6560;">Player</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #6b6560;">Aura</th>
          </tr>
        </thead>
        <tbody>
          ${top5Rows}
        </tbody>
      </table>
    </div>

    ${rankBlock}

    <div style="text-align: center; margin-top: 20px;">
      <a href="${TODAY_LINK}/leaderboard" class="btn">View Full Leaderboard →</a>
    </div>
  `,
    "🏆 This week's aura leaderboard — see who's on top"
  );

  return { subject: "🏆 Weekly Aura Leaderboard — Who's on top?", html };
}
