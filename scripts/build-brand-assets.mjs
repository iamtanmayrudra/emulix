/**
 * Builds the Emulix logo and icon files from one master drawing, so every size stays consistent.
 *
 * The mark is an "E" made of three bars of different widths, standing for the desktop, tablet and phone
 * viewports Emulix tests. The shorter middle bar ends in an amber dot: a live signal, and the light of a lighthouse.
 *
 * Run with: npm run brand
 * Writes: src/app/icon.svg, favicon.ico, apple-icon.png, opengraph-image.png, twitter-image.png,
 *         public/brand/*.svg and *.png
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const out = (...parts) => path.join(root, ...parts);

/** The mark. `radius` rounds the tile, in the drawing's 64-unit space (0 for full-bleed icons), and `glyphScale` shrinks the E for maskable icons. */
function markSvg({ size = 64, radius = 16, glyphScale = 1, id = "m" } = {}) {
  const g = `translate(32 32) scale(${glyphScale}) translate(-32 -32)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="${id}-bg" x1="6" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2f7bf5"/>
      <stop offset="0.55" stop-color="#6b3df0"/>
      <stop offset="1" stop-color="#c026d3"/>
    </linearGradient>
    <radialGradient id="${id}-glow" cx="0.88" cy="0.92" r="0.75">
      <stop offset="0" stop-color="#ff7ab8" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#ff7ab8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-glyph" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#d9e2ff"/>
    </linearGradient>
    <radialGradient id="${id}-spark" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#fff6bd"/>
      <stop offset="1" stop-color="#fbbf24"/>
    </radialGradient>
    <clipPath id="${id}-tile"><rect width="64" height="64" rx="${radius}"/></clipPath>
  </defs>
  <g clip-path="url(#${id}-tile)">
    <rect width="64" height="64" fill="url(#${id}-bg)"/>
    <rect width="64" height="64" fill="url(#${id}-glow)"/>
    <rect width="64" height="34" fill="url(#${id}-sheen)"/>
  </g>
  ${radius > 0 ? `<rect x="0.5" y="0.5" width="63" height="63" rx="${radius - 0.5}" fill="none" stroke="#fff" stroke-opacity="0.22"/>` : ""}
  <g transform="${g}">
    <g fill="#1a0e5e" fill-opacity="0.3" transform="translate(0 1.6)">
      <rect x="15" y="14" width="8" height="36" rx="4"/>
      <rect x="15" y="14" width="30" height="8" rx="4"/>
      <rect x="15" y="28" width="21" height="8" rx="4"/>
      <rect x="15" y="42" width="30" height="8" rx="4"/>
    </g>
    <g fill="url(#${id}-glyph)">
      <rect x="15" y="14" width="8" height="36" rx="4"/>
      <rect x="15" y="14" width="30" height="8" rx="4"/>
      <rect x="15" y="28" width="21" height="8" rx="4"/>
      <rect x="15" y="42" width="30" height="8" rx="4"/>
    </g>
    <circle cx="44.5" cy="32" r="6.6" fill="#fbbf24" fill-opacity="0.24"/>
    <circle cx="44.5" cy="32" r="3.7" fill="url(#${id}-spark)"/>
  </g>
</svg>`;
}

/** Horizontal lockup: the mark and the wordmark, for light or dark backgrounds. */
function lockupSvg({ dark }) {
  const text = dark ? "#e6e9ef" : "#0f172a";
  const inner = markSvg({ size: 64, radius: 16, id: dark ? "ld" : "ll" }).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 64" role="img" aria-labelledby="title">
  <title id="title">Emulix</title>
  <defs>
    <linearGradient id="${dark ? "ld" : "ll"}-ix" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#38bdf8"/>
      <stop offset="1" stop-color="#d946ef"/>
    </linearGradient>
  </defs>
  <g>${inner}</g>
  <text x="80" y="45" font-family="Geist, Inter, 'Segoe UI', Arial, sans-serif" font-size="40" font-weight="700" letter-spacing="-1.2" fill="${text}">Emul<tspan fill="url(#${dark ? "ld" : "ll"}-ix)">ix</tspan></text>
</svg>`;
}

/** 1200 by 630 social card. */
function socialCardHtml() {
  const mark = markSvg({ size: 250, radius: 16, id: "og" });
  return `<!doctype html><html><body style="margin:0">
<div style="position:relative;width:1200px;height:630px;overflow:hidden;background:linear-gradient(135deg,#040816 0%,#0b1741 55%,#2a1250 100%);font-family:'Segoe UI',Inter,Arial,sans-serif;color:#fff">
  <div style="position:absolute;left:-120px;top:-160px;width:520px;height:520px;border-radius:50%;background:#6b3df0;opacity:.35;filter:blur(110px)"></div>
  <div style="position:absolute;right:-100px;bottom:-200px;width:620px;height:620px;border-radius:50%;background:#d946ef;opacity:.28;filter:blur(120px)"></div>
  <div style="position:absolute;inset:0;opacity:.12;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:48px 48px;-webkit-mask-image:radial-gradient(ellipse at 70% 40%,#000,transparent 70%)"></div>
  <div style="position:absolute;left:96px;top:150px;filter:drop-shadow(0 30px 50px rgba(20,10,80,.6))">${mark}</div>
  <div style="position:absolute;left:400px;top:150px;width:760px">
    <div style="font-size:132px;font-weight:700;letter-spacing:-5px;line-height:1">Emul<span style="background:linear-gradient(135deg,#38bdf8,#e879f9);-webkit-background-clip:text;background-clip:text;color:transparent">ix</span></div>
    <div style="margin-top:22px;font-size:42px;font-weight:500;color:#c7d2fe;line-height:1.25">Test and optimize on real devices</div>
    <div style="margin-top:38px;display:flex;gap:14px">
      ${["Live browsers", "Lighthouse audits", "Mac Safari 15 to 26"]
        .map((label) => `<span style="padding:10px 20px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);font-size:24px;font-weight:600;white-space:nowrap;color:#e0e7ff">${label}</span>`)
        .join("")}
    </div>
  </div>
</div></body></html>`;
}

/** Packs PNG images into an .ico file. Modern browsers read PNG data inside ICO. */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

await mkdir(out("public", "brand"), { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function renderPng(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  return page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

// Vector files
const roundedMark = markSvg({ size: 64, radius: 16, id: "i" });
await writeFile(out("src", "app", "icon.svg"), roundedMark.replace(' width="64" height="64"', ""));
await writeFile(out("public", "brand", "emulix-icon.svg"), roundedMark.replace(' width="64" height="64"', ""));
await writeFile(out("public", "brand", "emulix-lockup-light.svg"), lockupSvg({ dark: false }));
await writeFile(out("public", "brand", "emulix-lockup-dark.svg"), lockupSvg({ dark: true }));

// Raster icons
const ico = [];
for (const size of [16, 32, 48]) ico.push({ size, data: await renderPng(markSvg({ size, radius: 16, id: `f${size}` }), size) });
await writeFile(out("src", "app", "favicon.ico"), buildIco(ico));
await writeFile(out("src", "app", "apple-icon.png"), await renderPng(markSvg({ size: 180, radius: 0, id: "a" }), 180));
await writeFile(out("public", "brand", "emulix-icon-192.png"), await renderPng(markSvg({ size: 192, radius: 16, id: "p1" }), 192));
await writeFile(out("public", "brand", "emulix-icon-512.png"), await renderPng(markSvg({ size: 512, radius: 16, id: "p2" }), 512));
await writeFile(out("public", "brand", "emulix-icon-maskable-512.png"), await renderPng(markSvg({ size: 512, radius: 0, glyphScale: 0.78, id: "p3" }), 512));

// Social card
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(socialCardHtml());
const card = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1200, height: 630 } });
await writeFile(out("src", "app", "opengraph-image.png"), card);
await writeFile(out("src", "app", "twitter-image.png"), card);
await writeFile(out("src", "app", "opengraph-image.alt.txt"), "Emulix: test and optimize your site on real devices");
await writeFile(out("src", "app", "twitter-image.alt.txt"), "Emulix: test and optimize your site on real devices");

await browser.close();
console.log("Brand assets written.");
