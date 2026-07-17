import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const OUT = "/Users/keanan/code/deadtreedigest/dist/store-screenshots";
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

// 1. Homepage hero
await page.goto("https://deadtreedigest.com", { waitUntil: "networkidle0", timeout: 45000 });
await new Promise(r => setTimeout(r, 1800));
await page.screenshot({ path: OUT + "/1-homepage.png" });
console.log("1-homepage.png");

// 2. Setup page with connected state simulated
await page.goto("https://api.deadtreedigest.com/setup?key=7caac58ba6111938e2f41867ab031127", { waitUntil: "networkidle0", timeout: 45000 });
await page.evaluate(() => {
  const st = document.getElementById("connect-status");
  if (st) { st.textContent = "✓ Extension connected. You're ready to save."; st.className = "ok"; }
});
await page.screenshot({ path: OUT + "/2-setup.png" });
console.log("2-setup.png");

// 3. Popup saved-state, composed on brand background
const popupShot = `<!DOCTYPE html><html><head><style>
  body { margin:0; width:1280px; height:800px; background:#1f4d38; display:flex; align-items:center; justify-content:center; gap:70px; font-family: Georgia, serif; }
  .headline { color:#f1e6cf; max-width:420px; }
  .headline h1 { font-family: Helvetica, Arial, sans-serif; text-transform:uppercase; font-size:44px; line-height:1.1; letter-spacing:0.02em; margin:0 0 16px; }
  .headline p { font-size:20px; font-style:italic; color:#cbbf9f; margin:0; }
  .popup { width:320px; background:#f1e6cf; color:#2b2419; font-size:13px; border:3px solid #2b2419; box-shadow: 12px 14px 0 rgba(0,0,0,0.3); }
  .popup header { background:#14352a; color:#f1e6cf; padding:10px 14px; font-family:Helvetica,sans-serif; font-weight:bold; font-size:12px; letter-spacing:0.14em; text-transform:uppercase; display:flex; justify-content:space-between; }
  .popup header .tree { color:#d9a13b; }
  .popup main { padding:14px; }
  .title { font-weight:bold; font-size:14.5px; line-height:1.25; }
  .meta { font-family:Helvetica,sans-serif; font-size:10.5px; color:#4a4032; text-transform:uppercase; letter-spacing:0.08em; margin-top:6px; }
  .badge { display:inline-block; background:#1f4d38; color:#f1e6cf; padding:1px 6px; border-radius:2px; font-size:9.5px; margin-right:4px; }
  .queue { margin-top:12px; border-top:1.5px solid #2b2419; padding-top:9px; font-family:'Courier New',monospace; font-size:11.5px; }
  .bar { height:8px; border:1px solid #2b2419; margin-top:5px; background:#f1e6cf; }
  .bar span { display:block; height:100%; width:62%; background:#1f4d38; }
  .actions { margin-top:12px; display:flex; gap:8px; }
  button { font-family:Helvetica,sans-serif; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; padding:7px 10px; border:1.5px solid #2b2419; background:#f1e6cf; }
  button.primary { background:#1f4d38; color:#f1e6cf; }
  .popup footer { padding:8px 14px; font-size:10px; font-style:italic; color:#6b5f4d; border-top:1px solid #cdb98f; text-align:center; }
</style></head><body>
  <div class="headline"><h1>Save it,<br>close the tab</h1><p>One click, and it's headed for print.</p></div>
  <div class="popup">
    <header><span>Dead Tree Digest</span><span class="tree">▲</span></header>
    <main>
      <div class="title">How to Do Great Work</div>
      <div class="meta"><span class="badge">paulgraham.com</span> ~29 pages · 11,619 words</div>
      <div class="queue">Issue queue: 9 items · 62/100pp<div class="bar"><span></span></div></div>
      <div class="actions"><button class="primary">Saved ✓</button><button>Didn't parse right</button></div>
    </main>
    <footer>Read responsibly. Print deliberately.</footer>
  </div>
</body></html>`;
await page.setContent(popupShot);
await page.screenshot({ path: OUT + "/3-popup.png" });
console.log("3-popup.png");

// 4. The park bench section
await page.goto("https://deadtreedigest.com", { waitUntil: "networkidle0", timeout: 45000 });
await page.evaluate(() => document.querySelector("#headspace").scrollIntoView());
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: OUT + "/4-headspace.png" });
console.log("4-headspace.png");

await browser.close();
