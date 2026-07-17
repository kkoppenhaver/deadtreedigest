// Onboarding auto-config: when the user opens their magic setup page, read
// the credentials it carries and store them — no copy-pasting tokens.
const creds = document.getElementById("dtd-credentials");
const status = document.getElementById("connect-status");
if (creds) {
  chrome.storage.sync
    .set({ token: creds.dataset.token, apiBase: creds.dataset.api })
    .then(() => {
      if (status) {
        status.textContent = "✓ Extension connected. You're ready to save.";
        status.className = "ok";
      }
    });
}
