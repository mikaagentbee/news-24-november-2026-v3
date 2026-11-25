// Build tool only — the grader never runs this. It renders frontpage.html
// into entry.png:
//
//   node render.mjs
//
// The page is drawn at exactly 1024x1024 CSS pixels. Chrome screenshots it
// at device scale factor 2 and Python/PIL downscales the shot back to
// 1024x1024 with a Lanczos filter, which keeps the small type crisp instead
// of letting the browser's own rasteriser smear it. The page is flat colour
// by design, so PIL then quantises it to a 256-colour palette with no
// dithering: the picture is unchanged to the eye and the file lands near a
// third of the size, which also helps if a tie is ever broken on bytes.
// The finished PNG is written next to this file as entry.png and checked
// against the competition's 1 MiB cap before the script reports success.

import { execFileSync } from "node:child_process";
import { existsSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const chromePath = "/home/hatch/workspace/.tmp/chrome/chrome-linux64/chrome";
const pagePath = join(here, "frontpage.html");
const shotPath = join(here, ".frontpage-2x.png");
const outPath = join(here, "entry.png");
const WIDTH = 1024;
const HEIGHT = 1024;
const CAP = 1_048_576;

if (!existsSync(chromePath)) {
  throw new Error(`headless Chrome not found at ${chromePath}`);
}

execFileSync(
  chromePath,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${shotPath}`,
    `file://${pagePath}`,
  ],
  { stdio: "inherit" },
);

const shrink = [
  "from PIL import Image",
  `im = Image.open(${JSON.stringify(shotPath)}).convert("RGB")`,
  `im = im.resize((${WIDTH}, ${HEIGHT}), Image.LANCZOS)`,
  "im = im.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE)",
  `im.save(${JSON.stringify(outPath)}, optimize=True)`,
  "print('resized and paletted')",
].join("\n");

execFileSync("python3", ["-c", shrink], { stdio: "inherit" });
unlinkSync(shotPath);

const size = statSync(outPath).size;
console.log(`entry.png: ${size} bytes (cap ${CAP})`);
if (size > CAP) {
  throw new Error(`entry.png is ${size} bytes, over the 1 MiB cap`);
}
