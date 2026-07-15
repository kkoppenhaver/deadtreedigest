// Save flow: popup opens -> capture the active tab's rendered DOM (this is
// what survives paywalls and login walls) -> POST /save -> show the parse
// preview with the "didn't parse right" feedback button.

const $main = document.getElementById("main");

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function show(html) {
  $main.innerHTML = html;
}

async function settings() {
  const defaults = { apiBase: "https://dtd-api.keanan-75b.workers.dev", token: "" };
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

async function run() {
  const { token } = await settings();
  if (!token) return fail("No save token set. Add yours in settings to start saving.");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url ?? "")) {
    return fail("This page can't be saved (only http/https pages).");
  }

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
  const save = await api("/save", {
    method: "POST",
    body: JSON.stringify({ url: capture.url, html: capture.html }),
  });

  if (save.status === 401) return fail("Save token was rejected. Check it in settings.");
  if (save.status === 422) return fail("Nothing article-shaped found on this page.");
  if (save.status !== 201) return fail(`Save failed (${save.status}): ${esc(save.body.error ?? "unknown")}`);

  const a = save.body;
  const lib = await api("/library");
  const cap = lib.body?.user?.pageCap ?? 100;
  const queued = lib.body?.queuedPages ?? 0;
  const pct = Math.min(100, Math.round((queued / cap) * 100));

  show(`
    <div class="result">
      <div class="title">${esc(a.title)}</div>
      <div class="meta">
        <span class="badge">${esc(a.source)}</span>
        ${a.needsReview ? '<span class="badge review">check parse</span>' : ""}
        ~${esc(a.estimatedPages)} pages · ${esc(a.wordCount)} words
      </div>
      <div class="queue">
        Issue queue: ${esc(lib.body?.queuedCount ?? "?")} items · ${esc(queued)}/${esc(cap)}pp
        <div class="bar"><span style="width:${pct}%"></span></div>
      </div>
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
