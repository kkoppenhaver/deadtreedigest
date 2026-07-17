// Popup = queue dashboard + save button. Opening it saves NOTHING: it shows
// the current page, the queue's fill state, and a link to the full library.
// Saving is an explicit click.

const $main = document.getElementById("main");

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function show(html) {
  $main.innerHTML = html;
}

async function settings() {
  const defaults = { apiBase: "https://api.deadtreedigest.com", token: "" };
  return { ...defaults, ...(await chrome.storage.sync.get(["apiBase", "token"])) };
}

async function api(path, opts = {}) {
  const { apiBase, token } = await settings();
  const res = await fetch(`${apiBase}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts.headers },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function fail(message) {
  show(`<div class="error">${message}</div>
    <div class="actions"><button id="opts">Open settings</button></div>`);
  document.getElementById("opts")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
}

const queueHtml = (lib) => {
  if (!lib || lib.status !== 200) return "";
  const cap = lib.body?.user?.pageCap ?? 100;
  const queued = lib.body?.queuedPages ?? 0;
  const pct = Math.min(100, Math.round((queued / cap) * 100));
  return `
    <div class="queue">
      Issue queue: ${esc(lib.body?.queuedCount ?? 0)} items · ${esc(queued)}/${esc(cap)}pp
      <div class="bar"><span style="width:${pct}%"></span></div>
    </div>
    ${lib.body?.queueUrl ? `<div style="margin-top:9px;text-align:center;"><a href="${lib.body.queueUrl}" target="_blank" style="font-family:Helvetica,sans-serif;font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:#1f4d38;">View your full queue →</a></div>` : ""}`;
};

async function run() {
  const { token } = await settings();
  if (!token) {
    return fail("Not connected to an account yet. Use the setup link from your welcome email, or open settings.");
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const saveable = tab?.id && /^https?:/.test(tab.url ?? "");

  show(`
    <div class="page-title">${esc(tab?.title ?? "This page")}</div>
    <div class="actions" style="margin-top:10px;">
      <button class="primary" id="save" ${saveable ? "" : "disabled"}>${saveable ? "Save to my next issue" : "This page can't be saved"}</button>
    </div>
    <div id="queue-slot"><div class="state" style="padding:8px 0;">Checking the queue…</div></div>`);

  let lib = null;
  try {
    lib = await api("/library");
    if (lib.status === 401) return fail("This extension isn't connected to an account yet. Use the setup link from your welcome email.");
    document.getElementById("queue-slot").innerHTML = queueHtml(lib);
  } catch {
    document.getElementById("queue-slot").innerHTML = `<div class="state" style="padding:8px 0;">Can't reach the press right now.</div>`;
  }

  if (!saveable) return;
  document.getElementById("save").addEventListener("click", () => saveCurrent(tab));
}

async function saveCurrent(tab) {
  let capture;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ html: document.documentElement.outerHTML, url: location.href }),
    });
    capture = result;
  } catch (err) {
    return fail(`Couldn't read this page: ${esc(err.message)}`);
  }

  show(`<div class="state">Pressing this page…</div>`);
  let save;
  try {
    save = await api("/save", {
      method: "POST",
      body: JSON.stringify({ url: capture.url, html: capture.html }),
    });
  } catch {
    return fail("Can't reach the press. Check your connection and try again.");
  }

  if (save.status === 401) return fail("This extension isn't connected to an account yet. Use the setup link from your welcome email.");
  if (save.status === 422) return fail("Nothing article-shaped found on this page.");
  if (save.status !== 201) return fail(`Save failed (${save.status}): ${esc(save.body.error ?? "unknown")}`);

  const a = save.body;
  const lib = await api("/library").catch(() => null);

  show(`
    <div class="result">
      <div class="title">${esc(a.title)}</div>
      <div class="meta">
        <span class="badge">${esc(a.source)}</span>
        ${a.needsReview ? '<span class="badge review">check parse</span>' : ""}
        ~${esc(a.estimatedPages)} pages · ${esc(a.wordCount)} words
      </div>
      ${queueHtml(lib)}
      <div class="actions">
        <button class="primary" id="done">Saved ✓</button>
        <button id="flag">Didn't parse right</button>
      </div>
    </div>`);

  document.getElementById("done").addEventListener("click", () => window.close());
  document.getElementById("flag").addEventListener("click", async (e) => {
    e.target.disabled = true;
    const res = await api(`/items/${a.id}/flag`, { method: "POST" });
    e.target.textContent = res.status === 200 ? "Flagged for review ✓" : "Flag failed";
  });
}

run();
