/**
 * Reads the device photos and renders you have placed in public/device-frames and works out where each screen is,
 * so the app can show a live browser inside them.
 *
 * Put one image per device in public/device-frames/<ios|android|desktop>/<device-id>.<png|webp|jpg>.
 * The file name must be a device id from src/lib/mock-data.ts, for example pixel-8.png or iphone-16-pro.webp.
 *
 * Finding the screen:
 *  - A PNG or WebP with a transparent screen opening is measured automatically.
 *  - Any other image needs <device-id>.screen.json beside it with the screen's pixel box:
 *      { "x": 120, "y": 90, "width": 640, "height": 1380 }
 *    Add "underlay": true if the opening is transparent and you still want to set it by hand.
 *
 * Run with: npm run frames
 * Writes:   src/lib/device-lab/frame-screens.json
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const FRAME_DIRS = ["ios", "android", "desktop"];
const IMAGE_TYPES = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

/** Device ids the app knows about, read from the profiles list. */
async function knownDeviceIds() {
  const source = await readFile(path.join(root, "src", "lib", "mock-data.ts"), "utf8");
  const block = source.slice(source.indexOf("export const DEVICE_PROFILES"));
  const list = block.slice(0, block.indexOf("];"));
  return new Set([...list.matchAll(/\bid:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]));
}

/** Runs in the browser: finds the transparent opening in the middle of the image, if there is one. */
async function detectOpening(dataUrl) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  const scale = Math.min(1, 900 / Math.max(naturalWidth, naturalHeight));
  const width = Math.round(naturalWidth * scale);
  const height = Math.round(naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(img, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const transparent = (x, y) => data[(y * width + x) * 4 + 3] < 24;

  const result = { naturalWidth, naturalHeight, box: null, note: "" };
  const startX = Math.floor(width / 2);
  const startY = Math.floor(height / 2);
  if (!transparent(startX, startY)) {
    result.note = "the middle of the image is not transparent";
    return result;
  }

  // Flood fill outward from the middle across transparent pixels.
  const seen = new Uint8Array(width * height);
  const stack = [startX, startY];
  let minX = startX, maxX = startX, minY = startY, maxY = startY, count = 0;
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const index = y * width + x;
    if (seen[index] || !transparent(x, y)) continue;
    seen[index] = 1;
    count += 1;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  if (boxWidth > width * 0.97 && boxHeight > height * 0.97) {
    result.note = "the transparent area reaches the image edges, so it is the background and not a screen";
    return result;
  }
  if (count / (boxWidth * boxHeight) < 0.8) {
    result.note = "the transparent area is not a clean screen shape";
    return result;
  }
  result.box = { x: minX / scale, y: minY / scale, width: boxWidth / scale, height: boxHeight / scale };
  return result;
}

const round = (value, places = 5) => Math.round(value * 10 ** places) / 10 ** places;

const ids = await knownDeviceIds();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("about:blank");

const frames = {};
const problems = [];

for (const dir of FRAME_DIRS) {
  const folder = path.join(root, "public", "device-frames", dir);
  let files = [];
  try {
    files = await readdir(folder);
  } catch {
    continue;
  }
  for (const file of files.sort()) {
    const extension = path.extname(file).toLowerCase();
    if (!IMAGE_TYPES[extension]) continue;
    const id = path.basename(file, extension);
    if (!ids.has(id)) {
      problems.push(`${dir}/${file}: "${id}" is not a device id. Rename the file to match one in src/lib/mock-data.ts.`);
      continue;
    }

    const bytes = await readFile(path.join(folder, file));
    const dataUrl = `data:${IMAGE_TYPES[extension]};base64,${bytes.toString("base64")}`;
    const detected = await page.evaluate(detectOpening, dataUrl);

    let box = detected.box;
    let underlay = box !== null;
    let how = "transparent opening";
    try {
      const sidecar = JSON.parse(await readFile(path.join(folder, `${id}.screen.json`), "utf8"));
      const valid = ["x", "y", "width", "height"].every((key) => Number.isFinite(sidecar[key]) && sidecar[key] >= 0);
      if (!valid || sidecar.x + sidecar.width > detected.naturalWidth || sidecar.y + sidecar.height > detected.naturalHeight) {
        problems.push(`${dir}/${id}.screen.json: needs numeric x, y, width and height inside the ${detected.naturalWidth} by ${detected.naturalHeight} image.`);
        continue;
      }
      box = sidecar;
      underlay = sidecar.underlay === true;
      how = "screen.json";
    } catch (error) {
      if (error.code !== "ENOENT") {
        problems.push(`${dir}/${id}.screen.json: could not be read (${error.message}).`);
        continue;
      }
    }

    if (!box) {
      problems.push(`${dir}/${file}: ${detected.note}. Add ${id}.screen.json with the screen's pixel box.`);
      continue;
    }

    frames[id] = {
      image: `/device-frames/${dir}/${file}`,
      screen: {
        x: round(box.x / detected.naturalWidth),
        y: round(box.y / detected.naturalHeight),
        width: round(box.width / detected.naturalWidth),
        height: round(box.height / detected.naturalHeight),
        aspect: round(detected.naturalHeight / detected.naturalWidth, 6),
        ...(underlay ? { underlay: true } : {}),
      },
    };
    console.log(`ok    ${id.padEnd(22)} ${how}${underlay ? ", drawn behind the frame" : ", drawn over the frame"}`);
  }
}

await browser.close();

const sorted = Object.fromEntries(Object.entries(frames).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(path.join(root, "src", "lib", "device-lab", "frame-screens.json"), `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`\n${Object.keys(sorted).length} frame(s) written to src/lib/device-lab/frame-screens.json.`);
if (problems.length) {
  console.log("\nNeeds attention:");
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exitCode = 1;
}
