import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("le formulaire reste accessible quand le clavier réduit l’écran", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined });
  });
  await page.goto("./");
  await page.getByRole("button", { name: /Créer mon IRONLOG/ }).click();
  await page.getByRole("button", { name: /Ajouter un exercice/ }).click();
  const name = page.getByLabel("NOM DE L'EXERCICE");
  await expect(name).not.toBeFocused();
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  await expect(page.locator(".exercise-editor")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 350 });
  await name.focus();

  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, "height", {
      configurable: true,
      value: 280,
    });
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  const bounds = await name.boundingBox();
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(280);
  await page
    .getByRole("button", { name: /Créer l’exercice/ })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: /Créer l’exercice/ }),
  ).toBeInViewport();
});

test("création, séries, reprise, fichier, restauration et hors ligne", async ({
  page,
  context,
  browserName,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined });
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined });
  });
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: /Créer mon IRONLOG/ }),
  ).toBeVisible();
  const initialDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Créer mon IRONLOG/ }).click();
  await initialDownload;
  await page.getByRole("button", { name: /Ajouter un exercice/ }).click();
  await page.getByLabel("NOM DE L'EXERCICE").fill("Développé couché");
  await page.locator("#exercise-photo").setInputFiles("assets/icon-192.png");
  await page.getByRole("button", { name: /Créer l’exercice/ }).click();
  await expect(
    page.getByRole("heading", { name: /Développé couché/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Ajouter une série/ }).click();
  await page.locator('input[name="weight"]').fill("225");
  await page.locator('input[name="reps"]').fill("8");
  await page.getByRole("button", { name: /Ajouter la série/ }).click();
  await expect(page.locator(".set-list")).toContainText("225 lb");
  await page.reload();
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: /Développé couché/ }).click();
  await expect(page.locator(".set-list")).toContainText("225 lb");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: /Terminer l.entraînement/ })
    .first()
    .click();
  const backup = await downloadPromise;
  expect(backup.suggestedFilename()).toBe("IRONLOG.ironlog");
  const path = await backup.path();
  const saved = JSON.parse(await readFile(path, "utf8"));
  expect(saved.exercises[0].photo).toMatch(/^data:image\/jpeg;base64,/);
  expect(saved.sets).toHaveLength(1);
  await expect(page.locator(".history-group")).toContainText("225 lb");
  await page.getByRole("button", { name: "Réglages" }).first().click();
  await page.getByRole("button", { name: /KILOS/ }).click();
  await page.getByRole("button", { name: "Exercices" }).click();
  await page.getByRole("button", { name: /Développé couché/ }).click();
  await expect(page.getByText("102,1 kg").first()).toBeVisible();
  await page.getByRole("button", { name: "Réglages" }).first().click();
  const badChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Ouvrir un fichier IRONLOG/ }).click();
  await (
    await badChooser
  ).setFiles({
    name: "bad.ironlog",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.locator("#toast")).toContainText("illisible");
  await expect(page.getByRole("heading", { name: /Réglages/ })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  const goodChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Ouvrir un fichier IRONLOG/ }).click();
  await (await goodChooser).setFiles(path);
  await expect(
    page.getByRole("button", { name: /Développé couché/ }),
  ).toBeVisible();
  if (browserName === "chromium") {
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("button", { name: /Continuer/ })).toBeVisible();
    await page.getByRole("button", { name: /Continuer/ }).click();
    await expect(
      page.getByRole("button", { name: /Développé couché/ }),
    ).toBeVisible();
  }
});
