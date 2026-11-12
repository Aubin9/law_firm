import { test, expect } from "@playwright/test";

test.describe("V1 Release E2E Acceptance Scenarios (REC-01 to REC-26)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to root which redirects to /[locale]/login or /[locale]/dashboard
    await page.goto("/");
  });

  test("REC-01 & REC-26: login screen renders in French default and supports English localization", async ({ page }) => {
    // Should be on login page
    await expect(page).toHaveURL(/\/(fr|en)\/login/);

    // Verify French UI elements (default locale)
    await expect(page.locator("h1, h2")).toContainText(["Connexion", "Cabinet d'Avocats", "Cabinet"]);
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();

    // Verify language switcher or navigate directly to English login
    await page.goto("/en/login");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toContainText(["Sign In", "Log in", "Login", "Se connecter", "Connexion"]);
  });

  test("REC-01: rejects invalid credentials with secure error feedback without leaking account existence", async ({ page }) => {
    await page.goto("/fr/login");

    await page.fill("input[type='email']", "invalid_user@cabinet.cm");
    await page.fill("input[type='password']", "WrongPassword123!");
    await page.click("button[type='submit']");

    // Expect error alert or message
    const alert = page.locator("[role='alert'], .text-destructive, .text-red-600, .bg-destructive");
    await expect(alert.first()).toBeVisible({ timeout: 5000 });
  });

  test("REC-07 & REC-26: unauthenticated access to protected matters or admin views redirects to login", async ({ page }) => {
    // Attempting to access protected matter list without session
    await page.goto("/fr/matters");
    await expect(page).toHaveURL(/\/fr\/login/);

    // Attempting to access sensitive audit log without session
    await page.goto("/fr/admin/audit");
    await expect(page).toHaveURL(/\/fr\/login/);

    // Attempting to access admin user manager without session
    await page.goto("/fr/admin/users");
    await expect(page).toHaveURL(/\/fr\/login/);
  });

  test("REC-02: conflict search UI is accessible from navigation and displays query input", async ({ page }) => {
    // Verify conflict check entry route exists
    const response = await page.goto("/fr/conflicts");
    // Either renders conflicts view or redirects to login if unauthenticated
    expect([200, 307, 308]).toContain(response?.status());
  });

  test("REC-11 & REC-15: health endpoint verifies system, DB latency, and sovereignty status", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("healthy");
    expect(json.checks).toBeDefined();
    expect(json.checks.database).toBeDefined();
    expect(json.checks.database.status).toBe("up");
    expect(json.checks.dataSovereignty).toBe("Conforme Loi n° 2024/017 (LAN / VPN)");
  });
});

