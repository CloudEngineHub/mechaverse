/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import http from "http";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function waitFor(url: string, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            if (Date.now() - start > timeoutMs)
              return reject(new Error("timeout"));
            setTimeout(check, 500);
          }
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs)
            return reject(new Error("timeout"));
          setTimeout(check, 500);
        });
    };
    check();
  });
}

async function run() {
  const port = process.env.PORT || "3000";
  const base = `http://localhost:${port}`;
  const projectRoot = path.resolve(__dirname, "..");
  const dataDir = path.join(projectRoot, "data", "screenshots");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Start dev server if not running
  let devProc: ReturnType<typeof spawn> | null = null;
  try {
    await waitFor(`${base}/api/health`, 4000);
  } catch {
    devProc = spawn("npm", ["run", "dev"], {
      cwd: projectRoot,
      stdio: "inherit",
    });
    await waitFor(`${base}/api/health`, 30000);
  }

  const robotsConfigPath = path.join(projectRoot, "data", "robots.json");
  const robots = JSON.parse(fs.readFileSync(robotsConfigPath, "utf-8"));

  const puppeteer = (await import("puppeteer")) as any;
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1024, height: 1024 },
  });
  const page = await browser.newPage();

  async function capture(route: string, outName: string) {
    const url = base + route;
    await page.goto(url, { waitUntil: "networkidle0" });
    // Listen for CAPTURE_PNG message
    const pngData: string = await page.evaluate(
      `new Promise((resolve) => {
        function handler(event){
          if (event && event.data && event.data.type === 'CAPTURE_PNG' && event.data.png) {
            window.removeEventListener('message', handler);
            resolve(event.data.png);
          }
        }
        window.addEventListener('message', handler);
        setTimeout(() => resolve(''), 8000);
      })`
    );

    let outBuffer: Buffer | null = null;
    if (pngData && pngData.startsWith("data:image/png;base64,")) {
      const b64 = pngData.replace(/^data:image\/png;base64,/, "");
      outBuffer = Buffer.from(b64, "base64");
    } else {
      // Fallback: page screenshot with transparent background, cropping to a centered square around the canvas
      const rect = await page.evaluate(() => {
        const el = document.querySelector("canvas") as HTMLCanvasElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      });
      let clip = rect || { x: 0, y: 0, width: 1024, height: 1024 };
      const size = Math.min(clip.width, clip.height);
      const offsetX = clip.x + Math.floor((clip.width - size) / 2);
      const offsetY = clip.y + Math.floor((clip.height - size) / 2);
      clip = { x: offsetX, y: offsetY, width: size, height: size } as any;
      outBuffer = (await page.screenshot({
        type: "png",
        omitBackground: true,
        clip,
      })) as Buffer;
    }

    const outPath = path.join(dataDir, outName);
    fs.writeFileSync(outPath, outBuffer);
    console.log("Saved:", outPath);
  }

  try {
    for (const item of robots.urdf) {
      await capture(item.route, item.output);
    }
    for (const item of robots.mjcf) {
      await capture(item.route, item.output);
    }
  } finally {
    await browser.close();
    if (devProc) devProc.kill();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
