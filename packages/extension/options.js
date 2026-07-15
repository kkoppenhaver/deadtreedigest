const $token = document.getElementById("token");
const $apiBase = document.getElementById("apiBase");
const $status = document.getElementById("status");

chrome.storage.sync.get(["apiBase", "token"]).then((s) => {
  $token.value = s.token ?? "";
  $apiBase.value = s.apiBase ?? "https://dtd-api.keanan-75b.workers.dev";
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.sync.set({
    token: $token.value.trim(),
    apiBase: $apiBase.value.trim().replace(/\/+$/, "") || "https://dtd-api.keanan-75b.workers.dev",
  });
  $status.textContent = "Saved ✓";
  setTimeout(() => ($status.textContent = ""), 1500);
});
