import { sendEmail } from "./resend";
import { emailLayout } from "./templates";
import { formatAuraPoints } from "@/lib/utils";

// ─── 1. WELCOME EMAIL ────────────────────────────────────────

export async function sendWelcomeEmail(to: string, username: string) {
  const html = emailLayout(`
    <h1>Welcome to AuraMint, @${username}! 👑</h1>
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
      <a href="https://auramint.novamintnetworks.in/dashboard" class="btn">Start Minting Aura →</a>
    </div>

    <p style="text-align: center; font-size: 12px; color: #6b6560;">
      You're starting as a <span class="badge">🗿 NPC</span> — time to level up.
    </p>
  `, `Welcome to AuraMint! Your aura journey starts now 👑`);

  return sendEmail({ to, subject: "Welcome to AuraMint! 👑 Your aura journey starts now", html });
}

// ─── 2. DAILY AURA REPORT ────────────────────────────────────

type DailyReportData = {
  totalEvents: number;
  totalAura: number;
  biggestW: { description: string; points: number; emoji: string } | null;
  biggestL: { description: string; points: number; emoji: string } | null;
  vibeOfTheDay: string;
  streakDays: number;
  tier: string;
};

export async function sendDailyReportEmail(to: string, username: string, data: DailyReportData) {
  const isPositiveDay = data.totalAura >= 0;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  const html = emailLayout(`
    <p style="font-size: 12px; color: #6b6560; margin-bottom: 4px;">${today}</p>
    <h1>${isPositiveDay ? "📈" : "📉"} Daily Aura Report</h1>
    <p>Here's how your aura looked today, @${username}:</p>

    <div class="stat-card" style="text-align: center;">
      <div class="stat-value ${isPositiveDay ? "positive" : "negative"}">
        ${formatAuraPoints(data.totalAura)}
      </div>
      <div class="stat-label">Total Aura ${isPositiveDay ? "Gained" : "Lost"} Today</div>
      <p style="font-size: 12px; color: #6b6560; margin-top: 8px;">
        From ${data.totalEvents} event${data.totalEvents !== 1 ? "s" : ""} · ${data.streakDays > 0 ? `🔥 ${data.streakDays}d streak` : "No streak"}
      </p>
    </div>

    ${data.biggestW ? `
    <div class="stat-card">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="emoji">${data.biggestW.emoji}</span>
        <div>
          <div class="stat-label">Biggest W</div>
          <span class="positive" style="font-weight: 700; font-size: 16px;">${formatAuraPoints(data.biggestW.points)}</span>
        </div>
      </div>
      <p style="font-size: 12px; margin-top: 8px;">"${data.biggestW.description.slice(0, 80)}${data.biggestW.description.length > 80 ? "..." : ""}"</p>
    </div>` : ""}

    ${data.biggestL ? `
    <div class="stat-card">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="emoji">${data.biggestL.emoji}</span>
        <div>
          <div class="stat-label">Biggest L</div>
          <span class="negative" style="font-weight: 700; font-size: 16px;">${formatAuraPoints(data.biggestL.points)}</span>
        </div>
      </div>
      <p style="font-size: 12px; margin-top: 8px;">"${data.biggestL.description.slice(0, 80)}${data.biggestL.description.length > 80 ? "..." : ""}"</p>
    </div>` : ""}

    <div class="divider"></div>

    <p style="text-align: center;">
      Vibe of the day: <span class="badge">✨ ${data.vibeOfTheDay}</span>
      <br/><br/>
      Current tier: <strong>${data.tier}</strong>
    </p>

    <div style="text-align: center; margin-top: 16px;">
      <a href="https://auramint.novamintnetworks.in/dashboard" class="btn">View Full Report →</a>
    </div>
  `, `${isPositiveDay ? "📈" : "📉"} ${formatAuraPoints(data.totalAura)} aura today — ${data.vibeOfTheDay}`);

  return sendEmail({ to, subject: `${isPositiveDay ? "📈" : "📉"} Your daily aura report — ${formatAuraPoints(data.totalAura)} today`, html });
}

// ─── 3. STREAK REMINDER ──────────────────────────────────────

export async function sendStreakReminderEmail(to: string, username: string, streakDays: number) {
  const html = emailLayout(`
    <div style="text-align: center;">
      <span style="font-size: 48px;">🔥</span>
      <h1>Your ${streakDays}-day streak is about to break!</h1>
      <p>Hey @${username}, you haven't logged any aura today. Your streak is on the line!</p>

      <div class="stat-card" style="text-align: center;">
        <div class="stat-value" style="color: #fb923c;">${streakDays}</div>
        <div class="stat-label">Day Streak at Risk</div>
      </div>

      <p>Log just one event to keep your streak alive. It takes 30 seconds.</p>

      <a href="https://auramint.novamintnetworks.in/dashboard" class="btn">Log an Event Now 🔥</a>

      <p style="font-size: 12px; color: #6b6560;">
        Don't let your grind go to waste. Every day counts.
      </p>
    </div>
  `, `🔥 Your ${streakDays}-day streak is about to break! Log an event now`);

  return sendEmail({ to, subject: `🔥 Your ${streakDays}-day streak is about to break!`, html });
}

// ─── 4. WEEKLY LEADERBOARD DIGEST ────────────────────────────

type LeaderboardEntry = {
  rank: number;
  username: string;
  total_aura: number;
  tier: string;
};

export async function sendWeeklyDigestEmail(
  to: string,
  username: string,
  userRank: number | null,
  userAura: number,
  topPlayers: LeaderboardEntry[]
) {
  const top5Rows = topPlayers
    .slice(0, 5)
    .map((p) => `
      <tr>
        <td style="padding: 8px 12px; font-size: 14px; color: ${p.rank <= 3 ? "#e89b29" : "#a09a90"}; font-weight: ${p.rank <= 3 ? "700" : "400"};">
          ${p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `#${p.rank}`}
        </td>
        <td style="padding: 8px 12px; font-size: 14px; color: #e0dcd5;">@${p.username}</td>
        <td style="padding: 8px 12px; font-size: 14px; font-weight: 700; color: ${p.total_aura >= 0 ? "#34d399" : "#f87171"}; text-align: right; font-family: monospace;">
          ${formatAuraPoints(p.total_aura)}
        </td>
      </tr>
    `)
    .join("");

  const html = emailLayout(`
    <h1>🏆 Weekly Leaderboard Digest</h1>
    <p>Here's who dominated the aura game this week:</p>

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

    ${userRank ? `
    <div class="stat-card" style="text-align: center; margin-top: 16px;">
      <div class="stat-label">Your Rank</div>
      <div class="stat-value" style="color: #e89b29;">#${userRank}</div>
      <p style="font-size: 12px; color: #6b6560; margin-top: 4px;">
        with ${formatAuraPoints(userAura)} total aura
      </p>
    </div>` : ""}

    <div style="text-align: center; margin-top: 20px;">
      <a href="https://auramint.novamintnetworks.in/leaderboard" class="btn">View Full Leaderboard →</a>
    </div>
  `, `🏆 This week's aura leaderboard — see who's on top`);

  return sendEmail({ to, subject: "🏆 Weekly Aura Leaderboard — Who's on top?", html });
}
