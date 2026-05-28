/**
 * AuraMint branded email template wrapper.
 * All emails use this base layout for consistent branding.
 */
export function emailLayout(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  ${preheader ? `<span style="display:none;font-size:1px;color:#fff;max-height:0;overflow:hidden;">${preheader}</span>` : ""}
  <style>
    body { margin: 0; padding: 0; background-color: #0c0c14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 520px; margin: 0 auto; padding: 32px 20px; }
    .card { background: linear-gradient(135deg, #13131f 0%, #0f0f1a 100%); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; overflow: hidden; }
    .header { padding: 28px 28px 0; text-align: center; }
    .logo { display: inline-flex; align-items: center; gap: 8px; }
    .logo-icon { width: 32px; height: 32px; background: rgba(232, 155, 41, 0.12); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
    .logo-text { font-size: 18px; font-weight: 800; background: linear-gradient(135deg, #e89b29, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.03em; }
    .body { padding: 24px 28px 28px; color: #e0dcd5; }
    .body h1 { color: #f5f0e8; font-size: 22px; font-weight: 700; margin: 0 0 12px; letter-spacing: -0.02em; }
    .body h2 { color: #f5f0e8; font-size: 18px; font-weight: 600; margin: 20px 0 8px; }
    .body p { font-size: 14px; line-height: 1.7; color: #a09a90; margin: 0 0 14px; }
    .body a { color: #e89b29; text-decoration: none; font-weight: 600; }
    .btn { display: inline-block; background: #e89b29; color: #0c0c14 !important; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 12px; text-decoration: none; margin: 8px 0 16px; }
    .btn:hover { opacity: 0.9; }
    .stat-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; margin: 8px 0; }
    .stat-value { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; font-family: 'JetBrains Mono', monospace; }
    .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #6b6560; margin-top: 4px; }
    .positive { color: #34d399; }
    .negative { color: #f87171; }
    .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 20px 0; }
    .badge { display: inline-block; background: rgba(232,155,41,0.1); color: #e89b29; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }
    .footer { padding: 20px 28px; text-align: center; border-top: 1px solid rgba(255,255,255,0.04); }
    .footer p { font-size: 11px; color: #4a4540; margin: 0; line-height: 1.6; }
    .footer a { color: #6b6560; text-decoration: underline; }
    .emoji { font-size: 20px; }
    .list-item { display: flex; align-items: flex-start; gap: 10px; margin: 10px 0; }
    .list-icon { font-size: 16px; flex-shrink: 0; margin-top: 2px; }
    .list-text { font-size: 13px; color: #a09a90; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">
          <div class="logo-icon">👑</div>
          <span class="logo-text">AuraMint</span>
        </div>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <p>
          AuraMint by <a href="https://novamintnetworks.in">NovaMint Networks</a><br />
          <a href="https://auramint.novamintnetworks.in">auramint.novamintnetworks.in</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
