import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const svgPath = path.join(root, "public", "icon.svg");
const outDir = path.join(root, "public", "icons");

fs.mkdirSync(outDir, { recursive: true });
const svg = fs.readFileSync(svgPath);

for (const size of [192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, `icon-${size}.png`));
}

console.log("Generated PWA icons in public/icons/");
