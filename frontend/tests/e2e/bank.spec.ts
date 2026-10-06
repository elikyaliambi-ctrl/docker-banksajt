import { test, expect, type Page } from "@playwright/test";

// Varje testkörning använder unika användarnamn, så testerna fungerar även
// om man kör dem flera gånger i rad mot samma testdatabas.
function uniqueUsername() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const PASSWORD = "ett-tillrackligt-langt-losenord";

async function registerAndLogin(page: Page, username: string, password: string) {
  await page.goto("/register");
  await page.getByLabel("Användarnamn").fill(username);
  await page.getByLabel("Lösenord").fill(password);
  await page.getByRole("button", { name: "Skapa konto" }).click();

  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Användarnamn").fill(username);
  await page.getByLabel("Lösenord").fill(password);
  await page.getByRole("button", { name: "Logga in" }).click();

  await expect(page).toHaveURL(/\/account/);
}

async function deposit(page: Page, amount: string) {
  await page.getByLabel("Belopp").fill(amount);
  await page.getByRole("button", { name: "Sätt in" }).click();
}

test("obehörig besökare nekas åtkomst till konto och transaktioner", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login/);
});

test("ny användare kan registrera sig, logga in, sätta in pengar och se historiken", async ({
  page,
}) => {
  const username = uniqueUsername();
  await registerAndLogin(page, username, PASSWORD);

  await expect(page.getByText("0 kr")).toBeVisible();

  await deposit(page, "250");
  await expect(page.getByText("250 kr")).toBeVisible();

  await page.getByRole("link", { name: "Se transaktioner" }).click();
  await expect(page).toHaveURL(/\/transactions/);
  await expect(page.getByText("+250 kr")).toBeVisible();
});

test("historik finns kvar efter omladdning och ny inloggning, ogiltigt belopp ändrar inget", async ({
  page,
}) => {
  const username = uniqueUsername();
  await registerAndLogin(page, username, PASSWORD);

  await deposit(page, "100");
  await expect(page.getByText("100 kr")).toBeVisible();

  // Ogiltigt belopp (0) ska varken ändra saldot eller skapa en transaktion.
  await page.getByLabel("Belopp").fill("0");
  await page.getByRole("button", { name: "Sätt in" }).click();
  await expect(page.getByText("100 kr")).toBeVisible();

  // Ladda om sidan, saldot ska finnas kvar.
  await page.reload();
  await expect(page.getByText("100 kr")).toBeVisible();

  // Historiken ska också finnas kvar, och det ogiltiga försöket ska inte
  // synas som en egen rad.
  await page.getByRole("link", { name: "Se transaktioner" }).click();
  await expect(page.getByText("+100 kr")).toBeVisible();
  await expect(page.getByText("+0 kr")).toHaveCount(0);

  // Ny inloggning (simulerar utloggning och inloggning igen).
  await page.evaluate(() => window.localStorage.removeItem("token"));
  await page.goto("/login");
  await page.getByLabel("Användarnamn").fill(username);
  await page.getByLabel("Lösenord").fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();

  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByText("100 kr")).toBeVisible();
});

test("två användares transaktionshistorik hålls åtskild", async ({ page }) => {
  const userA = uniqueUsername();
  const userB = uniqueUsername();

  await registerAndLogin(page, userA, PASSWORD);
  await deposit(page, "300");
  await page.getByRole("link", { name: "Se transaktioner" }).click();
  await expect(page.getByText("+300 kr")).toBeVisible();

  await page.evaluate(() => window.localStorage.removeItem("token"));

  await registerAndLogin(page, userB, PASSWORD);
  await deposit(page, "75");
  await page.getByRole("link", { name: "Se transaktioner" }).click();
  await expect(page.getByText("+75 kr")).toBeVisible();
  await expect(page.getByText("+300 kr")).toHaveCount(0);
});
