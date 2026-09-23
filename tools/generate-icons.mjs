import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const assets = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const svg = await readFile(join(assets, "icon.svg"));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>body{margin:0}</style><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${svg.toString("base64")}">`,
    );
    await page
      .locator("img")
      .screenshot({ path: join(assets, `icon-${size}.png`) });
  }
} finally {
  await browser.close();
}
