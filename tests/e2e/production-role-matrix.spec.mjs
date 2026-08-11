import { test, expect } from "@playwright/test";

const BASE_URL = (process.env.E2E_BASE_URL || "https://restaurant-sage-eta.vercel.app").replace(/\/$/, "");

const MANAGEMENT_ROLES = ["owner", "admin", "manager"];
const ORDER_ROLES = [...MANAGEMENT_ROLES, "cashier", "server"];
const INVENTORY_ROLES = [...MANAGEMENT_ROLES, "inventory_manager"];
const REPORTING_ROLES = [...MANAGEMENT_ROLES, "analyst"];
const RESERVATION_ROLES = [...MANAGEMENT_ROLES, "host"];
const LOYALTY_ROLES = [...MANAGEMENT_ROLES, "cashier"];
const KDS_ROLES = [...MANAGEMENT_ROLES, "server", "cook", "bartender"];

const ALL_NAV_LABELS = [
  "Dashboard",
  "Menu Management",
  "Orders",
  "Tables & Floor",
  "Reservations",
  "Waitlist",
  "Staff",
  "Inventory",
  "Purchasing",
  "Reports",
  "KDS Screens",
  "Settings",
];

const roles = [
  {
    role: "owner",
    name: "Olivia Owner",
    pin: "9090",
    nav: ALL_NAV_LABELS,
  },
  {
    role: "admin",
    name: "Admin",
    pin: "1234",
    nav: ALL_NAV_LABELS,
  },
  {
    role: "manager",
    name: "Omar Manager",
    pin: "2222",
    nav: ALL_NAV_LABELS,
  },
  {
    role: "cashier",
    name: "Carla Cashier",
    pin: "7777",
    nav: ["Orders", "Tables & Floor"],
  },
  {
    role: "server",
    name: "Sarah",
    pin: "1111",
    nav: ["Orders", "Tables & Floor"],
  },
  {
    role: "cook",
    name: "Yusuf",
    pin: "4444",
    nav: [],
  },
  {
    role: "bartender",
    name: "Mariam",
    pin: "5555",
    nav: [],
  },
  {
    role: "host",
    name: "Hassan",
    pin: "6666",
    nav: ["Tables & Floor", "Reservations", "Waitlist"],
  },
  {
    role: "inventory_manager",
    name: "Inez Inventory",
    pin: "8888",
    nav: ["Inventory", "Purchasing"],
  },
  {
    role: "analyst",
    name: "Amal Analyst",
    pin: "9898",
    nav: ["Dashboard", "Reports"],
  },
  {
    role: "staff",
    name: "Sam Staff",
    pin: "1212",
    nav: [],
  },
];

const protectedPages = [
  { path: "/admin/analytics", roles: REPORTING_ROLES },
  { path: "/admin/featured", roles: MANAGEMENT_ROLES },
  { path: "/admin/feedback", roles: MANAGEMENT_ROLES },
  { path: "/admin/floor-editor", roles: MANAGEMENT_ROLES },
  { path: "/admin/inventory", roles: INVENTORY_ROLES },
  { path: "/admin/loyalty", roles: LOYALTY_ROLES },
  { path: "/admin/payment-reversals", roles: MANAGEMENT_ROLES },
  { path: "/admin/qr", roles: MANAGEMENT_ROLES },
  { path: "/admin/reservation-settings", roles: MANAGEMENT_ROLES },
  { path: "/admin/reservations-calendar", roles: RESERVATION_ROLES },
  { path: "/admin/timesheet", roles: MANAGEMENT_ROLES },
  { path: "/pos", roles: ORDER_ROLES },
  {
    path: "/kds/grill",
    roles: KDS_ROLES,
    deniedError: "kds_access_denied",
    includesSource: false,
  },
];

async function login(page, expectedRole) {
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
  const pinInput = page.locator("#staff-pin");
  await expect(pinInput).toBeVisible({ timeout: 30_000 });

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") &&
      response.request().method() === "POST"
  );

  await pinInput.fill(expectedRole.pin);
  await pinInput.press("Enter");

  const loginResponse = await loginResponsePromise;
  const body = await loginResponse.json().catch(() => null);
  expect(loginResponse.status(), JSON.stringify(body)).toBe(200);
  expect(body?.user?.role).toBe(expectedRole.role);
  expect(body?.user?.name).toBe(expectedRole.name);

  await expect(page.getByText(expectedRole.name, { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
}

test.use({
  viewport: { width: 1440, height: 1000 },
  screenshot: "only-on-failure",
  trace: "retain-on-failure",
  video: "retain-on-failure",
});

test("public storefront hydrates seeded database data", async ({ page, context }) => {
  const serverErrors = [];
  page.on("response", (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Saffron & Spice/i);
  await expect(page.getByText("Saffron & Spice", { exact: true }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Order Now", exact: true })).toBeVisible();

  const settingsResponse = await context.request.get(`${BASE_URL}/api/settings`);
  expect(settingsResponse.status()).toBe(200);
  const settingsBody = await settingsResponse.json();
  expect(settingsBody?.settings?.nameEn).toBe("Saffron & Spice");
  expect(settingsBody?.settings?.currency).toBe("USD");

  const menuResponse = await context.request.get(`${BASE_URL}/api/menu`);
  expect(menuResponse.status()).toBe(200);
  const menuBody = await menuResponse.json();
  const categories = menuBody?.categories || menuBody?.menu || [];
  expect(Array.isArray(categories)).toBe(true);
  expect(categories.length).toBeGreaterThan(0);

  expect(serverErrors).toEqual([]);
});

test("guest can place and securely track a takeout order", async ({ page }) => {
  const serverErrors = [];
  const pageErrors = [];

  page.on("response", (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const storefrontSidebar = page.locator("aside").first();
  await storefrontSidebar.getByRole("button", { name: "Menu", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Our Menu", exact: true })).toBeVisible({
    timeout: 30_000,
  });

  const addToCart = page.getByRole("button", { name: "Add to Cart", exact: true }).first();
  await expect(addToCart).toBeVisible({ timeout: 30_000 });
  await addToCart.click();

  await storefrontSidebar.getByRole("button", { name: /^Cart\b/ }).click();
  const cartSheet = page.getByRole("dialog");
  await expect(cartSheet).toBeVisible();
  await expect(cartSheet.getByText("Your Cart", { exact: true })).toBeVisible();
  await cartSheet.getByRole("button", { name: "Takeout", exact: true }).click();
  await cartSheet.getByPlaceholder("Your Name").fill("E2E Guest");
  await cartSheet.getByPlaceholder("Phone Number").fill("+9647700000000");

  const orderResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/orders") &&
      response.request().method() === "POST"
  );
  await cartSheet.getByRole("button", { name: /^Place Order\b/ }).click();

  const orderResponse = await orderResponsePromise;
  const orderBody = await orderResponse.json().catch(() => null);
  expect(orderResponse.ok(), JSON.stringify(orderBody)).toBe(true);
  expect(orderBody?.order?.orderNumber).toBeTruthy();
  expect(orderBody?.accessToken).toBeTruthy();

  await page.waitForURL(/\/track\/[^?]+\?token=/, { timeout: 30_000 });
  await expect(page.getByText("Order Number", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText(orderBody.order.orderNumber, { exact: true })
  ).toBeVisible({ timeout: 30_000 });

  expect(serverErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("inactive employee cannot authenticate", async ({ page }) => {
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
  const pinInput = page.locator("#staff-pin");
  await expect(pinInput).toBeVisible({ timeout: 30_000 });

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") &&
      response.request().method() === "POST"
  );
  await pinInput.fill("1313");
  await pinInput.press("Enter");
  const response = await loginResponsePromise;
  expect(response.status()).toBe(401);
  await expect(pinInput).toBeVisible();
});

for (const role of roles) {
  test(`${role.role}: login, navigation, APIs, and direct-route authorization`, async ({
    page,
  }) => {
    const serverErrors = [];
    const pageErrors = [];

    page.on("response", (response) => {
      if (response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await login(page, role);

    const desktopSidebar = page.locator("aside").first();
    await expect(desktopSidebar).toBeVisible();

    for (const label of ALL_NAV_LABELS) {
      const locator = desktopSidebar.getByRole("button", { name: label, exact: true });
      if (role.nav.includes(label)) {
        await expect.soft(locator, `${role.role} should see ${label}`).toHaveCount(1);
      } else {
        await expect.soft(locator, `${role.role} should not see ${label}`).toHaveCount(0);
      }
    }

    if (role.nav.length === 0) {
      await expect(
        page.getByRole("heading", {
          name: "No admin tools are assigned to this role",
          exact: true,
        })
      ).toBeVisible();
    }

    const ordersStatus = await page.evaluate(async () =>
      fetch("/api/orders?limit=1", { cache: "no-store" }).then((response) => response.status)
    );
    await expect
      .soft(ordersStatus, `${role.role} order API authorization`)
      .toBe(ORDER_ROLES.includes(role.role) ? 200 : 403);

    const inventoryStatus = await page.evaluate(async () =>
      fetch("/api/inventory", { cache: "no-store" }).then((response) => response.status)
    );
    await expect
      .soft(inventoryStatus, `${role.role} inventory API authorization`)
      .toBe(INVENTORY_ROLES.includes(role.role) ? 200 : 403);

    for (const protectedPage of protectedPages) {
      await page.goto(`${BASE_URL}${protectedPage.path}`, {
        waitUntil: "domcontentloaded",
      });
      const currentUrl = new URL(page.url());
      const allowed = protectedPage.roles.includes(role.role);

      if (allowed) {
        await expect
          .soft(
            currentUrl.pathname,
            `${role.role} should access ${protectedPage.path}`
          )
          .toBe(protectedPage.path);
      } else {
        await expect
          .soft(
            currentUrl.pathname,
            `${role.role} should be redirected away from ${protectedPage.path}`
          )
          .toBe("/admin");
        await expect
          .soft(
            currentUrl.searchParams.get("error"),
            `${role.role} redirect error for ${protectedPage.path}`
          )
          .toBe(protectedPage.deniedError || "access_denied");

        if (protectedPage.includesSource !== false) {
          await expect
            .soft(
              currentUrl.searchParams.get("from"),
              `${role.role} redirect source for ${protectedPage.path}`
            )
            .toBe(protectedPage.path);
        }
      }
    }

    if (ORDER_ROLES.includes(role.role)) {
      await page.goto(`${BASE_URL}/pos`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/pos$/);
      await expect(page).toHaveTitle(/POS Terminal/i);
    }

    if (KDS_ROLES.includes(role.role)) {
      await page.goto(`${BASE_URL}/kds/grill`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/kds\/grill$/);
      await expect(page).toHaveTitle(/KDS.*grill/i);
    }

    await expect.soft(serverErrors, `${role.role} server errors`).toEqual([]);
    await expect.soft(pageErrors, `${role.role} page errors`).toEqual([]);
  });
}
