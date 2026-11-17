// Renders the app icon (src/app/icon.svg) to the files that are committed:
//   public/icon.ico        Windows desktop shortcut (16-256 px)
//   src/app/favicon.ico    browser tab
//   src/app/apple-icon.png home-screen icon on iPhone/iPad (180 px)
//   public/icon-512.png    large icon
// Needs Playwright's Chromium (dev only): node scripts/make-icons.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const svg = fs.readFileSync(path.join(root, "src", "app", "icon.svg"), "utf8");

async function render(size) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  return png;
}

/** ICO with PNG-compressed images (supported since Windows Vista). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, png }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...images.map((x) => x.png)]);
}

const browser = await chromium.launch();
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = [];
for (const size of sizes) images.push({ size, png: await render(size) });
fs.writeFileSync(path.join(root, "public", "icon.ico"), ico(images));
fs.writeFileSync(path.join(root, "src", "app", "favicon.ico"), ico(images.filter((x) => x.size <= 48)));
fs.writeFileSync(path.join(root, "src", "app", "apple-icon.png"), await render(180));
fs.writeFileSync(path.join(root, "public", "icon-512.png"), await render(512));
await browser.close();
console.log("icons written");
