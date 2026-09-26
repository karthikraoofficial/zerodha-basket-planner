// Captures the "How this site works" screenshots (lib/tour/screens.json) as phone-sized WebP files
// in public/tour/, for light and dark. Dependency-free: drives headless Chrome over the DevTools
// protocol. See docs/adr/0006.
//
// Usage: start the app with the mock Kite client (KITE_MOCK=1 npm run dev), then
//   npm run screenshots                 # BASE defaults to http://localhost:3000
//   BASE=http://localhost:3123 CHROME=/path/to/chrome npm run screenshots
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "tour");
const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
const THEMES = ["light", "dark"];
const BUCKET_PAISE = "10000000"; // ₹1,00,000: enough names to show the "others" segment.
const { steps } = JSON.parse(readFileSync(join(ROOT, "lib", "tour", "screens.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(message) {
  console.error(`capture-screens: ${message}`);
  process.exit(1);
}

function chromePath() {
  const candidates = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) ?? fail("no Chrome found; set CHROME to its path");
}

// Screenshots must only ever show sample data: with the mock Kite client, login redirects straight
// to our own callback with a mock request token instead of to Zerodha.
async function assertMockKite() {
  let res;
  try {
    res = await fetch(`${BASE}/api/kite/login`, { redirect: "manual" });
  } catch {
    fail(`nothing is listening at ${BASE}; start the app with KITE_MOCK=1`);
  }
  const location = res.headers.get("location") ?? "";
  if (!location.includes("request_token=mock")) fail(`${BASE} is not using the mock Kite client (KITE_MOCK=1); refusing to capture`);
}

async function connect(port) {
  let page;
  for (let i = 0; i < 75 && !page; i++) {
    try {
      page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
    } catch {
      /* Chrome still starting */
    }
    if (!page) await sleep(200);
  }
  if (!page) fail("could not reach headless Chrome");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else for (const l of [...listeners]) l(msg);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const once = (event, timeoutMs = 20_000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        listeners.delete(listener);
        reject(new Error(`timed out waiting for ${event}`));
      }, timeoutMs);
      const listener = (msg) => {
        if (msg.method !== event) return;
        clearTimeout(timer);
        listeners.delete(listener);
        resolve(msg.params);
      };
      listeners.add(listener);
    });
  return { ws, send, once };
}

async function main() {
  await assertMockKite();
  mkdirSync(OUT, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), "capture-screens-"));
  const port = 9300 + Math.floor(Math.random() * 600);
  const chrome = spawn(
    chromePath(),
    ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--no-first-run", "about:blank"],
    { stdio: "ignore" },
  );
  const { ws, send, once } = await connect(port);

  const evaluate = async (expression) =>
    (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
  const settle = async () => {
    // Fonts and images in, Next's dev-tools badge out, then a beat for layout.
    await evaluate(
      "Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]).then(() => document.querySelector('nextjs-portal')?.remove())",
    );
    await sleep(400);
  };
  const load = async (path) => {
    const loaded = once("Page.loadEventFired");
    await send("Page.navigate", { url: `${BASE}${path}` });
    await loaded;
    await settle();
    return evaluate("location.pathname");
  };
  const click = async (expression, navigates) => {
    const loaded = navigates ? once("Page.loadEventFired") : null;
    await evaluate(expression);
    if (loaded) await loaded.catch(() => {});
    await sleep(2500);
  };

  try {
    await send("Page.enable");
    await send("Network.enable");
    await send("Emulation.setDeviceMetricsOverride", VIEWPORT);
    let written = 0;

    for (const theme of THEMES) {
      await send("Network.clearBrowserCookies");
      await send("Emulation.setEmulatedMedia", {
        features: [
          { name: "prefers-color-scheme", value: theme },
          { name: "prefers-reduced-motion", value: "reduce" },
        ],
      });

      // Log in, choose a bucket and horizon, and save the resulting plan so history has something in it.
      const ensureSession = async () => {
        await load("/api/kite/login");
        if ((await load("/setup")) !== "/setup") fail("mock login did not reach /setup");
        await click(
          `document.querySelector('input[name=bucket][value="${BUCKET_PAISE}"]').checked = true;
           document.querySelector('input[name=horizon]:not(:disabled)').checked = true;
           document.querySelector('form.setup button[type=submit]').click();`,
          true,
        );
        await click("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save plan')?.click()", false);
      };

      let session = false;
      let current = null;
      for (const step of steps) {
        const { path, scrollTo } = step.capture;
        if (step.capture.session && !session) {
          await ensureSession();
          session = true;
          current = null;
        }
        let target = path;
        if (path === "/history/:latest") {
          await load("/history");
          target = await evaluate("new URL(document.querySelector('.history a').href).pathname");
        }
        if (target !== current) {
          const landed = await load(target);
          if (landed !== target) fail(`${step.id}: expected ${target}, landed on ${landed}`);
          current = target;
        }
        // Scroll the section to just under the sticky navigation strip.
        await evaluate(
          scrollTo
            ? `window.scrollTo({ top: document.querySelector(${JSON.stringify(scrollTo)}).getBoundingClientRect().top + scrollY - 72, behavior: "instant" })`
            : `window.scrollTo({ top: 0, behavior: "instant" })`,
        );
        await sleep(300);
        const { data } = await send("Page.captureScreenshot", { format: "webp", quality: 82 });
        const file = join(OUT, `${step.id}-${theme}.webp`);
        writeFileSync(file, Buffer.from(data, "base64"));
        written++;
        console.log(`  ${step.id}-${theme}.webp`);
      }
    }
    console.log(`capture-screens: wrote ${written} screenshots to public/tour/`);
  } finally {
    ws.close();
    chrome.kill();
    await sleep(300);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* Chrome may still hold the profile briefly on Windows */
    }
  }
}

main().catch((err) => fail(err.message));
