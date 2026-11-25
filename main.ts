// Entry point for the make.fun "news-image-20261124" competition.
//
// The picture itself — one page that sums up the world news of Tuesday,
// 24 November 2026 as 39 dated, sourced stories — is drawn in
// frontpage.html, rendered to entry.png by render.mjs at build time, and
// committed beside this file. This program's whole job is to hand those
// exact bytes to the grader: it checks the committed image against the
// competition gate (recognised PNG/JPEG signature, at most 1 MiB, at most
// 1024x1024 pixels), then copies it into the output directory as
// entry.png. It uses only the Node standard library, touches no network,
// and writes byte-identical output on every run.

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BYTE_CAP = 1_048_576; // 1 MiB, the gate's limit
const SIDE_CAP = 1024; // neither side may exceed 1024 pixels

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEAD = [0xff, 0xd8, 0xff];

function startsWith(bytes: Buffer, head: number[]): boolean {
  return head.every((b, i) => bytes[i] === b);
}

// Read the pixel size out of the image header itself, so an oversized
// canvas can never slip through on the strength of its file size alone.
function pixelSize(bytes: Buffer): { width: number; height: number } {
  if (startsWith(bytes, PNG_HEAD)) {
    // PNG: width and height are big-endian uint32s at bytes 16 and 20.
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  // JPEG: walk the segments until a start-of-frame marker turns up.
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) break;
    const marker = bytes[at + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    }
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  throw new Error("could not read a pixel size from the image header");
}

const imagePath = fileURLToPath(new URL("./entry.png", import.meta.url));
const image = readFileSync(imagePath);

if (!startsWith(image, PNG_HEAD) && !startsWith(image, JPEG_HEAD)) {
  throw new Error("entry.png carries neither a PNG nor a JPEG signature");
}
if (image.length > BYTE_CAP) {
  throw new Error(`entry.png is ${image.length} bytes, over the 1 MiB cap`);
}
const { width, height } = pixelSize(image);
if (width > SIDE_CAP || height > SIDE_CAP) {
  throw new Error(`entry.png is ${width}x${height}, over the 1024x1024 cap`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
const target = join(outDir, "entry.png");
copyFileSync(imagePath, target);

// Read the copy back and compare it in full: a short or garbled write
// must fail loudly here rather than reach the judge as a broken image.
const written = readFileSync(target);
if (!written.equals(image)) {
  throw new Error("verification failed: the written entry.png differs from the committed image");
}
