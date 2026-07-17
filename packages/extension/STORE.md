# Chrome Web Store submission — Dead Tree Digest

## Listing

**Name**: Dead Tree Digest

**Short description** (under 132 chars):
Save articles as you browse. When you've saved enough to fill an issue, they arrive as a printed magazine in your mailbox.

**Detailed description**:
"Read later" usually means read never. Dead Tree Digest fixes that.

See something you want to read? Click once and it's saved to your next issue. When you've saved about 100 pages worth, your articles are typeset into a real, perfect-bound magazine and mailed to you. No schedule, no notifications — it just shows up, and all that's left is finding a park bench.

The extension is the save button: it captures the article you're currently reading (including things behind logins you already have) and adds it to your library. That's its whole job.

Requires a Dead Tree Digest account — sign up at deadtreedigest.com.

**Category**: Productivity · **Language**: English

## Permission justifications (store review form)

- **activeTab / scripting**: Used only when the user clicks the extension button, to capture the article content of the page they're currently viewing so it can be saved to their library. No background access, no automatic capture.
- **storage**: Stores the user's own API token and endpoint so saves go to their account.
- **host_permissions (api.deadtreedigest.com)**: The extension's own backend — where saved articles are sent and account info is read.
- **content script (api.deadtreedigest.com/setup*)**: Runs only on our own onboarding page to configure the extension automatically after signup.

## Assets needed (manual)

- [ ] Screenshots, 1280×800 or 640×400 (popup after a save; the setup page connecting; an issue PDF or printed copy)
- [ ] Small promo tile 440×280 (optional but recommended — WPA poster crop works)
- [ ] Privacy policy URL: https://deadtreedigest.com/privacy.html ✓ (live)

## Submission steps (manual, ~$5 + review days)

1. https://chrome.google.com/webstore/devconsole — pay the one-time $5 developer fee
2. New item → upload `dist/dtd-extension-v0.1.0.zip` (regenerate with `packages/extension/scripts/pack.sh`)
3. Paste listing copy + permission justifications above; add screenshots
4. Privacy tab: link the policy URL, declare data use (account info + user-initiated content, not sold/shared)
5. Submit for review (typically 1–3 days, sometimes longer for host permissions)
6. After approval: update /setup page step 1 to link the store listing instead of GitHub
