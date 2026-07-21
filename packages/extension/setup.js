// Onboarding auto-config: when the user opens their magic setup page, read
// the credentials it carries and store them — no copy-pasting tokens.
// If this browser already saves to a DIFFERENT account, ask before
// overwriting instead of silently switching libraries.
const creds = document.getElementById("dtd-credentials");
const status = document.getElementById("connect-status");

function connected() {
  if (!status) return;
  status.textContent = "✓ Extension connected. You're ready to save.";
  status.className = "ok";
}

async function main() {
  if (!creds) return;
  const next = { token: creds.dataset.token, apiBase: creds.dataset.api };
  const prev = await chrome.storage.sync.get(["token", "apiBase"]);

  if (!prev.token || prev.token === next.token) {
    await chrome.storage.sync.set(next);
    connected();
    return;
  }

  // Different account already connected. Name it if we can so the choice is
  // legible; an unreachable/stale token just reads as "another account".
  let current = "another account";
  try {
    const res = await fetch(`${next.apiBase}/me`, {
      headers: { Authorization: `Bearer ${prev.token}` },
    });
    if (res.ok) current = (await res.json()).email;
  } catch {}

  if (!status) return;
  status.className = "";
  const warn = document.createElement("span");
  warn.textContent = `This browser currently saves to ${current}. `;
  const btn = document.createElement("button");
  btn.textContent = `Switch to ${creds.dataset.email || "this account"}`;
  btn.style.cssText =
    "font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;" +
    "padding:6px 12px;border:1.5px solid #2b2419;background:#1f4d38;color:#f1e6cf;cursor:pointer;margin-left:2px;";
  btn.addEventListener("click", async () => {
    await chrome.storage.sync.set(next);
    connected();
  });
  status.replaceChildren(warn, btn);
}

main();
