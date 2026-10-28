type ConsentHidden = Record<string, string>;

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderErrorPage(message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gardeo MCP — Error</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#0f172a; color:#e2e8f0; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .card { background:#1e293b; border:1px solid #334155; border-radius:12px; padding:28px; max-width:480px; width:92%; }
    h1 { margin:0 0 8px; font-size:1.25rem; }
    p { margin:0; color:#94a3b8; line-height:1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Cannot authorize</h1>
    <p>${esc(message)}</p>
  </div>
</body>
</html>`;
}

export function renderConsentPage(opts: {
  clientHost: string;
  redirectUri: string;
  scope: string;
  loggedIn: boolean;
  userLabel: string | null;
  error?: string | null;
  formAction: string;
  hidden: ConsentHidden;
}): string {
  const scopes = opts.scope.split(/[\s+]+/).filter(Boolean);
  const hiddenInputs = Object.entries(opts.hidden)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}" />`)
    .join("\n");

  const loginFields = opts.loggedIn
    ? `<p class="muted">Signed in as <strong>${esc(opts.userLabel || "user")}</strong></p>`
    : `
      <label>Email or username
        <input name="username" type="text" required autocomplete="username" />
      </label>
      <label>Password
        <input name="password" type="password" required autocomplete="current-password" />
      </label>
    `;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gardeo MCP — Authorize</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#0f172a; color:#e2e8f0; margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .card { background:#1e293b; border:1px solid #334155; border-radius:12px; padding:28px; max-width:520px; width:92%; }
    h1 { margin:0 0 6px; font-size:1.35rem; }
    .muted { color:#94a3b8; font-size:0.92rem; line-height:1.45; }
    .err { background:#7f1d1d; color:#fecaca; padding:10px 12px; border-radius:8px; margin:12px 0; font-size:0.9rem; }
    label { display:block; margin:12px 0 0; font-size:0.85rem; color:#cbd5e1; }
    input[type=text], input[type=password] {
      width:100%; margin-top:6px; box-sizing:border-box; padding:10px 12px; border-radius:8px;
      border:1px solid #475569; background:#0f172a; color:#f8fafc;
    }
    ul { margin:10px 0 0; padding-left:18px; color:#cbd5e1; }
    .actions { display:flex; gap:10px; margin-top:18px; }
    button { flex:1; padding:11px 14px; border-radius:8px; border:0; cursor:pointer; font-weight:600; }
    .approve { background:#f97316; color:#111; }
    .deny { background:#334155; color:#e2e8f0; }
    code { font-size:0.8rem; color:#fdba74; word-break:break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize MCP access</h1>
    <p class="muted">
      <strong>${esc(opts.clientHost)}</strong> wants to access Gardeo tools for your tenant.
      Redirect: <code>${esc(opts.redirectUri)}</code>
    </p>
    ${opts.error ? `<div class="err">${esc(opts.error)}</div>` : ""}
    <p class="muted" style="margin-top:12px">Requested scopes</p>
    <ul>${scopes.map((s) => `<li><code>${esc(s)}</code></li>`).join("") || "<li><code>ops.read</code></li>"}</ul>

    <form method="post" action="${esc(opts.formAction)}">
      ${hiddenInputs}
      ${loginFields}
      <div class="actions">
        <button class="deny" type="submit" name="action" value="deny">Deny</button>
        <button class="approve" type="submit" name="action" value="approve">Allow</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}
