#!/usr/bin/env node
// Cover design playground: generates a self-contained HTML page that renders
// the REAL cover template (src/cover.js, inlined) in the browser with live
// knobs for the per-issue variables — issue number, page count (drives spine
// width), article count, date — plus trim/bleed/spine guide overlays.
//
//   node packages/typeset/cover-playground.mjs && open packages/typeset/.out/cover-playground.html
//
// Iterate: edit src/cover.js, re-run this, refresh the browser. The closer
// bundles the same template, so once it looks right we deploy and every
// future issue wears it.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Inline the template + fonts as plain scripts (file:// blocks module imports).
// NB: cover.js's output contains a literal </script> tag — escape it or the
// browser terminates the playground's script block mid-source.
const deScript = (s) => s.replace(/<\/script>/g, "<\\/script>");
const fonts = deScript(readFileSync(resolve(here, "src/fonts.css.js"), "utf8").replace(/^export /m, ""));
const cover = deScript(
  readFileSync(resolve(here, "src/cover.js"), "utf8")
    .replace(/^import [^\n]+\n/m, "")
    .replace(/^export /gm, "")
);

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>DTD Cover Playground</title>
<style>
  body { margin: 0; background: #3a352c; font-family: Helvetica, Arial, sans-serif; }
  .bar {
    position: sticky; top: 0; z-index: 10; background: #2b2419; color: #f1e6cf;
    padding: 10px 16px; display: flex; gap: 22px; align-items: center; flex-wrap: wrap;
    font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
  .bar label { display: flex; align-items: center; gap: 8px; }
  .bar input[type="number"], .bar input[type="text"] { width: 70px; padding: 3px 6px; font-family: monospace; }
  .bar input[type="range"] { width: 160px; }
  .bar .val { font-family: monospace; color: #d9a13b; min-width: 90px; }
  .stage { display: flex; justify-content: center; padding: 24px; }
  iframe { border: none; background: white; box-shadow: 0 12px 40px rgba(0,0,0,0.5); transform-origin: top center; }
</style>
</head>
<body>
<div class="bar">
  <strong>🌲 Cover Playground</strong>
  <label>Pages <input type="range" id="pages" min="24" max="200" value="100">
    <span class="val" id="pagesVal"></span></label>
  <label>Issue № <input type="number" id="number" value="1" min="1"></label>
  <label>Articles <input type="number" id="articles" value="16" min="1"></label>
  <label>Date <input type="text" id="date" value="July 2026"></label>
  <label><input type="checkbox" id="guides" checked> trim/spine guides</label>
</div>
<div class="stage"><iframe id="frame"></iframe></div>

<script>
${fonts}
${cover}

const BLEED_IN = ${0.125};
const $ = (id) => document.getElementById(id);

function guidesOverlay(pageCount) {
  const spine = spineWidthIn(pageCount);
  const W = 0.125 + 5.5 + spine + 5.5 + 0.125;
  const line = (leftIn, color, label) => \`
    <div style="position:absolute; top:0; bottom:0; left:\${leftIn}in; width:0; border-left:1px dashed \${color}; z-index:99;">
      <span style="position:absolute; top:2px; left:2px; font:9px monospace; color:\${color}; background:rgba(0,0,0,0.55); padding:0 3px; white-space:nowrap;">\${label}</span>
    </div>\`;
  const hline = (topIn, color, label) => \`
    <div style="position:absolute; left:0; right:0; top:\${topIn}in; height:0; border-top:1px dashed \${color}; z-index:99;"></div>\`;
  return \`
    \${line(0.125, "#ff5555", "bleed/trim")}
    \${line(0.125 + 5.5, "#55ffff", "spine \${(spine).toFixed(3)}in")}
    \${line(0.125 + 5.5 + spine, "#55ffff", "")}
    \${line(W - 0.125, "#ff5555", "trim/bleed")}
    \${hline(0.125, "#ff5555")}
    \${hline(0.125 + 8.5, "#ff5555")}\`;
}

function render() {
  const pageCount = Number($("pages").value);
  $("pagesVal").textContent = pageCount + "pp · spine " + spineWidthIn(pageCount).toFixed(3) + "in";
  let html = coverHtml({
    number: Number($("number").value),
    dateLabel: $("date").value,
    pageCount,
    articleCount: Number($("articles").value),
    coverLines: [
      { title: "Salary Negotiation: Make More Money, Be More Valued", byline: "Kalzumeus Software" },
      { title: "Every Company's First AI Strategy Should Be a Skill Library", byline: "Hiten Shah (@hnshah)" },
      { title: "Publishing your work increases your luck", byline: "github.blog" },
    ],
  });
  if ($("guides").checked) {
    html = html.replace("</body>", guidesOverlay(pageCount) + "</body>");
  }
  const spine = spineWidthIn(pageCount);
  const wIn = 0.125 + 5.5 + spine + 5.5 + 0.125;
  const frame = $("frame");
  frame.style.width = wIn * 96 + "px";
  frame.style.height = 8.75 * 96 + "px";
  const scale = Math.min(1, (window.innerWidth - 60) / (wIn * 96));
  frame.style.transform = "scale(" + scale + ")";
  frame.parentElement.style.height = 8.75 * 96 * scale + 48 + "px";
  frame.srcdoc = html;
}

for (const id of ["pages", "number", "articles", "date", "guides"]) {
  $(id).addEventListener("input", render);
}
window.addEventListener("resize", render);
render();
</script>
</body>
</html>`;

mkdirSync(resolve(here, ".out"), { recursive: true });
const out = resolve(here, ".out", "cover-playground.html");
writeFileSync(out, page);
console.log(out);
