import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("une nouvelle version attend l’accord avant de recharger", async ({
  page,
}) => {
  let revision = "initiale";
  const contentTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".webmanifest": "application/manifest+json",
  };
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const relative =
      pathname === "/IRONLOG/"
        ? "index.html"
        : pathname.replace(/^\/IRONLOG\//, "");
    if (!pathname.startsWith("/IRONLOG/") || relative.includes("..")) {
      response.writeHead(404).end();
      return;
    }
    try {
      const content = await readFile(join(process.cwd(), relative));
      const extension = relative.match(/\.[^.]+$/)?.[0];
      response.setHeader(
        "Content-Type",
        contentTypes[extension] || "application/octet-stream",
      );
      response.setHeader("Cache-Control", "no-store");
      response.end(
        relative === "sw.js"
          ? Buffer.concat([content, Buffer.from(`\n// ${revision}`)])
          : content,
      );
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await page.addInitScript(() => {
      Object.defineProperty(window, "showSaveFilePicker", { value: undefined });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/IRONLOG/`);
    await page.getByRole("button", { name: /Créer mon IRONLOG/ }).click();
    await page.getByRole("button", { name: /Ajouter un exercice/ }).click();
    await page.getByLabel("NOM DE L'EXERCICE").fill("Squat");
    await page.getByRole("button", { name: /Créer l’exercice/ }).click();
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await page.evaluate(async () => {
      await caches.open("autre-application");
    });

    await page.getByRole("button", { name: /Ajouter une série/ }).click();
    revision = "nouvelle";
    await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration()).update(),
    );
    await expect(page.locator("#update-prompt")).toBeHidden();
    await page.getByRole("button", { name: "Fermer" }).click();
    await expect(page.locator("#update-prompt")).toBeVisible();
    await page.getByRole("button", { name: "Plus tard" }).click();
    await expect(page.locator("#update-prompt")).toBeHidden();

    await page.reload();
    await expect(page.locator("#update-prompt")).toBeVisible();
    const reloaded = page.waitForEvent("load");
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await reloaded;
    await page.getByRole("button", { name: /Continuer/ }).click();
    await expect(page.getByRole("button", { name: /Squat/ })).toBeVisible();
    await expect(page.locator("#update-prompt")).toBeHidden();
    expect(
      await page.evaluate(async () =>
        (await caches.keys()).includes("autre-application"),
      ),
    ).toBe(true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
