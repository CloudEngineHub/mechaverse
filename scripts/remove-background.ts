/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

type CliOpts = {
  inputDir: string;
  outputDir: string;
  threshold: number; // 0-255 distance in RGB
  feather: number; // pixels of softness beyond threshold
  size: number; // final square crop size (px)
};

function parseArgs(): CliOpts {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const args = process.argv.slice(2);
  const opts: any = {};
  for (const a of args) {
    const [k, v] = a.split("=");
    if (k === "--input" || k === "-i") opts.inputDir = v;
    else if (k === "--output" || k === "-o") opts.outputDir = v;
    else if (k.startsWith("--threshold")) opts.threshold = Number(v ?? 28);
    else if (k.startsWith("--feather")) opts.feather = Number(v ?? 12);
    else if (k.startsWith("--size")) opts.size = Number(v ?? 800);
  }
  const projectRoot = path.resolve(__dirname, "..");
  if (!opts.inputDir)
    opts.inputDir = path.join(projectRoot, "data", "screenshots");
  if (!opts.outputDir)
    opts.outputDir = path.join(projectRoot, "data", "screenshots", "clean");
  if (opts.threshold == null) opts.threshold = 28;
  if (opts.feather == null) opts.feather = 12;
  if (opts.size == null) opts.size = 800;
  return opts as CliOpts;
}

function colorDistanceSq(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

async function removeBackgroundFromPng(
  inputPath: string,
  outputPath: string,
  threshold: number,
  feather: number,
  cropSize: number
) {
  const img = sharp(inputPath);
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info; // channels should be 4
  if (channels !== 4) throw new Error(`Expected 4 channels, got ${channels}`);

  // Sample background from 4 corners (avg of a small patch)
  const patch = 6;
  const samples: [number, number, number][] = [];
  const pushPatch = (sx: number, sy: number) => {
    let rr = 0,
      gg = 0,
      bb = 0,
      n = 0;
    for (let y = sy; y < Math.min(height, sy + patch); y++) {
      for (let x = sx; x < Math.min(width, sx + patch); x++) {
        const idx = (y * width + x) * 4;
        const a = data[idx + 3];
        if (a === 0) continue;
        rr += data[idx + 0];
        gg += data[idx + 1];
        bb += data[idx + 2];
        n++;
      }
    }
    if (n > 0)
      samples.push([
        Math.round(rr / n),
        Math.round(gg / n),
        Math.round(bb / n),
      ]);
  };
  pushPatch(0, 0);
  pushPatch(width - patch, 0);
  pushPatch(0, height - patch);
  pushPatch(width - patch, height - patch);

  // Fallback if transparent corners: assume bright beige dev bg
  const fallbackBg: [number, number, number] = [254, 244, 218]; // #fef4da
  const [br, bg, bb] =
    samples.length > 0
      ? (samples
          .reduce(
            (acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]],
            [0, 0, 0]
          )
          .map((v) => Math.round(v / samples.length)) as [
          number,
          number,
          number
        ])
      : fallbackBg;

  const thSq = threshold * threshold;
  const featherEnd = threshold + feather;
  const featherEndSq = featherEnd * featherEnd;

  // Process pixels in-place
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx + 0];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (a === 0) continue; // already transparent
      const d2 = colorDistanceSq(r, g, b, br, bg, bb);
      if (d2 <= thSq) {
        data[idx + 3] = 0; // fully remove
      } else if (d2 <= featherEndSq) {
        // Feather alpha from 0..1 based on distance between threshold..featherEnd
        const d = Math.sqrt(d2);
        const t = (d - threshold) / Math.max(1, feather);
        const alpha = Math.max(0, Math.min(1, t));
        data[idx + 3] = Math.round(alpha * a);
      }
    }
  }

  // Build a sharp instance and center-crop to square of cropSize, preserving original center
  const size = Math.min(cropSize, width, height);
  const left = Math.max(0, Math.floor(width / 2 - size / 2));
  const top = Math.max(0, Math.floor(height / 2 - size / 2));
  await sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: size, height: size })
    .png()
    .toFile(outputPath);
}

async function main() {
  const { inputDir, outputDir, threshold, feather, size } = parseArgs();
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const files = fs
    .readdirSync(inputDir)
    .filter((f) => f.toLowerCase().endsWith(".png"));
  if (files.length === 0) {
    console.log("No PNGs found in", inputDir);
    return;
  }

  console.log(`Removing background from ${files.length} file(s)...`);
  for (const f of files) {
    const inPath = path.join(inputDir, f);
    const outPath = path.join(outputDir, f);
    try {
      await removeBackgroundFromPng(inPath, outPath, threshold, feather, size);
      console.log("✔", f);
    } catch (e) {
      console.warn("✖", f, e);
    }
  }
  console.log("Done. Output:", outputDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
