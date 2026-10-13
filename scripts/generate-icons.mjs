/**
 * Builds every raster brand output from the supplied source assets in design/brand/.
 * Nothing here redraws the logo: the supplied files are only resized, padded or composited.
 *
 *   node scripts/generate-icons.mjs
 *
 * Sources (design/brand/):
 *   app-icon-dark-1024.png      white ring on green squircle (transparent corners)
 *   hui-logo-on-white.jpg       member-colour ring logo on white (light theme)
 *   hui-logo-on-dark.jpg        member-colour ring logo on black (dark theme)
 *   notification-white-96.png   white-on-transparent notification badge
 *   status-bar-white-24.png     white-on-transparent status bar glyph
 */
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const source = (name) => path.join(root, "design", "brand", name);
const iconsDir = path.join(root, "public", "icons");
const brandDir = path.join(root, "public", "brand");

// Background of the supplied app icon (sampled from its flat area): rgb(20, 53, 40).
const ICON_BACKGROUND = { r: 20, g: 53, b: 40, alpha: 1 };

fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(brandDir, { recursive: true });

const appIcon = source("app-icon-dark-1024.png");

/** "any" icons: the squircle exactly as supplied, just resized. */
for (const size of [192, 512]) {
  await sharp(appIcon).resize(size, size).png().toFile(path.join(iconsDir, `icon-${size}.png`));
}

/**
 * Maskable icons: the OS applies its own mask, so the artwork must be full-bleed with the logo
 * inside the safe zone. The supplied squircle is placed at 80% on a canvas of its own background
 * colour, which keeps the logo well inside the 80% safe circle and hides the squircle's corners.
 */
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.8);
  const resized = await sharp(appIcon).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: ICON_BACKGROUND },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(path.join(iconsDir, `icon-maskable-${size}.png`));
}

/** iOS applies its own corner radius and fills transparency with black, so flatten onto the green. */
{
  const size = 180;
  const resized = await sharp(appIcon).resize(size, size).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: ICON_BACKGROUND },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(path.join(iconsDir, "apple-touch-icon.png"));
}

/** Favicons: PNGs for <link rel="icon"> plus a multi-size ICO for /favicon.ico. */
const faviconSizes = [16, 32, 48];
const faviconPngs = [];
for (const size of faviconSizes) {
  const buffer = await sharp(appIcon).resize(size, size).png().toBuffer();
  faviconPngs.push({ size, buffer });
  if (size === 32) {
    fs.writeFileSync(path.join(iconsDir, "favicon-32.png"), buffer);
  }
}

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, buffer } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += buffer.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.buffer)]);
}

fs.writeFileSync(path.join(root, "src", "app", "favicon.ico"), buildIco(faviconPngs));

/**
 * Monochrome notification assets are copied untouched (white on transparent): Android masks them
 * with its own colour, so they must not be recoloured or resized here.
 */
fs.copyFileSync(source("notification-white-96.png"), path.join(iconsDir, "notification-badge-96.png"));
fs.copyFileSync(source("status-bar-white-24.png"), path.join(iconsDir, "status-bar-white-24.png"));

/**
 * Ring logos. The supplied files are JPEGs flattened on white / black, which cannot sit on the
 * app's tinted surfaces, and CSS blend modes break inside any animated or isolated ancestor. So the
 * flat background is keyed out instead: pixels far from the background stay fully opaque with their
 * original colour, and only anti-aliased edge pixels ramp to transparent. The light version keeps
 * light edge pixels and the dark version keeps dark ones, which is exactly what suits the surface
 * each is used on. Nothing is recoloured or redrawn; the files are only downscaled for the web.
 */
async function liftBackground(inputName, background, outputName, width) {
  const { data, info } = await sharp(source(inputName))
    .resize({ width })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  // The dark ring is deliberately only a little lighter than black (rgb 20,53,40), so the black
  // version needs a much tighter ramp than the white one or the ring itself turns translucent.
  const FLOOR = background === "black" ? 8 : 18; // JPEG noise: at or below is transparent
  const FULL = background === "black" ? 36 : 90; // at or above is fully opaque
  for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const distance = background === "black" ? Math.max(r, g, b) : 255 - Math.min(r, g, b);
    const alpha = Math.max(0, Math.min(1, (distance - FLOOR) / (FULL - FLOOR)));
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = Math.round(alpha * 255);
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(brandDir, outputName));
}

await liftBackground("hui-logo-on-white.jpg", "white", "hui-logo-light.png", 512);
await liftBackground("hui-logo-on-dark.jpg", "black", "hui-logo-dark.png", 512);
console.log("Generated brand icons in public/icons/, public/brand/ and src/app/favicon.ico");
