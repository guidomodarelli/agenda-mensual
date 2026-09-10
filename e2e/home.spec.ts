/** Verifies page navigation and persisted theme behavior across redirects. */
import { expect, test } from "@playwright/test";

test("renders monthly expenses on root route", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/gastos/);
  await expect(
    page.getByRole("heading", { name: "Control mensual", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Detalle del mes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conectar cuenta de Google" }),
  ).toBeVisible();
});

test("keeps light theme after reload when persisted theme is light", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("theme", "light");
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/gastos/);
  await expect(page.getByRole("heading", { name: "Detalle del mes" })).toBeVisible();

  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.reload();

  await expect(page.locator("html")).toHaveClass(/light/);
});

test("uses system theme when no persisted theme exists", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    window.localStorage.removeItem("theme");
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/gastos/);
  await expect(page.getByRole("heading", { name: "Detalle del mes" })).toBeVisible();

  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("toggles to dark correctly after reloading in persisted light mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    window.localStorage.setItem("theme", "light");
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/gastos/);
  await expect(page.getByRole("heading", { name: "Detalle del mes" })).toBeVisible();
  await page.reload();

  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Alternar tema" }).click();
  await page.getByRole("menuitemradio", { name: "Oscuro", exact: true }).click();

  await expect.poll(async () => {
    return await page.evaluate(() => {
      return {
        darkClass: document.documentElement.classList.contains("dark"),
        persistedTheme: window.localStorage.getItem("theme"),
      };
    });
  }).toEqual({
    darkClass: true,
    persistedTheme: "dark",
  });
});
