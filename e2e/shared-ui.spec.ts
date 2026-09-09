/** Verifies the published UI package through actual application interactions. */
import { expect, test } from "@playwright/test";

test("should switch and persist the theme through the shared menu", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Detalle del mes" })).toBeVisible();

  const themeButton = page.getByRole("button", { name: "Alternar tema", exact: true });
  await expect(themeButton).toBeEnabled();
  await themeButton.click();
  const menu = page.getByRole("menu", { name: "Alternar tema" });
  await expect(menu).toBeVisible();
  await page.getByRole("menuitemradio", { name: "Oscuro", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(runtimeErrors).toEqual([]);
});

test("should preserve sidebar preferences and navigate using the shared sidebar", async ({ page, context, isMobile }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Detalle del mes" })).toBeVisible();
  const trigger = page.getByRole("button", { name: "Abrir menu lateral" });

  if (isMobile) {
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  } else {
    await trigger.click();
    await expect(page.locator('[data-slot="sidebar"][data-state]')).toHaveAttribute("data-state", "collapsed");
    const preference = (await context.cookies()).find(cookie => cookie.name === "control-mensual.sidebar.open");
    expect(preference?.value).toBe("false");
    await page.reload();
    await expect(page.locator('[data-slot="sidebar"][data-state]')).toHaveAttribute("data-state", "collapsed");
    await trigger.click();
  }

  const initialTimeOrigin = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole("link", { name: "Prestamistas", exact: true }).click();
  await expect(page).toHaveURL(/\/prestamistas/);
  await expect(page.getByRole("heading", { name: "Prestamistas", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(initialTimeOrigin);
  expect(runtimeErrors).toEqual([]);
});
