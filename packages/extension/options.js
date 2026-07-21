const $ = (id) => document.getElementById(id);
const DEFAULT_API = "https://api.deadtreedigest.com";

async function settings() {
  const s = await chrome.storage.sync.get(["apiBase", "token"]);
  return { apiBase: s.apiBase ?? DEFAULT_API, token: s.token ?? "" };
}

async function api(path, opts = {}) {
  const { apiBase, token } = await settings();
  const res = await fetch(`${apiBase}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts.headers },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function flash(el, msg, isError = false) {
  el.textContent = msg;
  el.classList.toggle("err", isError);
  if (!isError) setTimeout(() => (el.textContent = ""), 2000);
}

// ---- connection status ----
async function showConnection() {
  const { token } = await settings();
  if (!token) {
    $("conn").textContent = "Not connected. Open the setup link from your welcome email.";
    return;
  }
  const res = await api("/me").catch(() => null);
  $("conn").textContent =
    res?.status === 200
      ? `Connected. Saving to the library of ${res.body.email}.`
      : "Connected, but the saved token isn't working. Re-open your setup link.";
}
showConnection();

// ---- manual connection (advanced fallback) ----
settings().then((s) => {
  $("token").value = s.token;
  $("apiBase").value = s.apiBase;
});

$("save").addEventListener("click", async () => {
  await chrome.storage.sync.set({
    token: $("token").value.trim(),
    apiBase: $("apiBase").value.trim().replace(/\/+$/, "") || DEFAULT_API,
  });
  flash($("status"), "Saved ✓");
  showConnection();
  loadAddress();
});

// ---- shipping address ----
const FIELDS = ["name", "street1", "street2", "city", "state", "postcode", "phone"];

async function loadAddress() {
  const { token } = await settings();
  if (!token) return;
  const res = await api("/me");
  if (res.status !== 200) return;
  for (const f of FIELDS) $(`a_${f}`).value = res.body.address?.[f] ?? "";
}
loadAddress();

$("saveAddress").addEventListener("click", async () => {
  const address = Object.fromEntries(FIELDS.map((f) => [f, $(`a_${f}`).value]));
  const res = await api("/me", { method: "PATCH", body: JSON.stringify({ address }) });
  if (res.status === 200) {
    for (const f of FIELDS) $(`a_${f}`).value = res.body.address?.[f] ?? "";
    flash($("addrStatus"), "Saved ✓");
  } else {
    flash($("addrStatus"), res.body.error ?? `failed (${res.status})`, true);
  }
});
