import { test, expect, type Page } from "@playwright/test";

// Varje testkörning använder unika användarnamn, så testerna fungerar även
// om man kör dem flera gånger i rad mot samma testdatabas.
function uniqueUsername() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const PASSWORD = "ett-tillrackligt-langt-losenord";
const BACKEND_URL = "http://localhost:3011";

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

test("historik och saldo finns kvar efter omladdning och ny inloggning, ogiltigt belopp ändrar inget", async ({
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

  // Access-token finns bara i React state, inte i localStorage. En
  // omladdning nollställer alltså React och loggar ut användaren, det är
  // avsiktligt beteende i den här uppgiften.
  await page.reload();
  await expect(page).toHaveURL(/\/login/);

  // Historiken ska finnas kvar i databasen trots utloggningen, och det
  // ogiltiga försöket ska inte synas som en egen rad.
  await page.getByLabel("Användarnamn").fill(username);
  await page.getByLabel("Lösenord").fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();

  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByText("100 kr")).toBeVisible();

  await page.getByRole("link", { name: "Se transaktioner" }).click();
  await expect(page.getByText("+100 kr")).toBeVisible();
  await expect(page.getByText("+0 kr")).toHaveCount(0);
});

test("två användares transaktionshistorik hålls åtskild", async ({ page }) => {
  const userA = uniqueUsername();
  const userB = uniqueUsername();

  await registerAndLogin(page, userA, PASSWORD);
  await deposit(page, "300");
  await page.getByRole("link", { name: "Se transaktioner" }).click();
  await expect(page.getByText("+300 kr")).toBeVisible();

  // Omladdning loggar ut (se testet ovan), så det ersätter den tidigare
  // manuella localStorage-rensningen mellan de två användarna.
  await page.reload();

  await registerAndLogin(page, userB, PASSWORD);
  await deposit(page, "75");
  await page.getByRole("link", { name: "Se transaktioner" }).click();
  await expect(page.getByText("+75 kr")).toBeVisible();
  await expect(page.getByText("+300 kr")).toHaveCount(0);
});

test("skyddat API-anrop fungerar med giltig token och nekas utan eller med manipulerad token", async ({
  request,
}) => {
  const username = uniqueUsername();

  await request.post(`${BACKEND_URL}/users`, {
    data: { username, password: PASSWORD },
  });

  const loginResponse = await request.post(`${BACKEND_URL}/sessions`, {
    data: { username, password: PASSWORD },
  });
  const { token } = await loginResponse.json();

  // Giltig token ska ge tillgång till kontot.
  const okResponse = await request.post(`${BACKEND_URL}/me/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(okResponse.status()).toBe(200);

  // Saknad token ska nekas.
  const noTokenResponse = await request.post(`${BACKEND_URL}/me/accounts`);
  expect(noTokenResponse.status()).toBe(401);

  // En token med ett ändrat tecken i signaturen ska nekas.
  const tamperedToken = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  const tamperedResponse = await request.post(`${BACKEND_URL}/me/accounts`, {
    headers: { Authorization: `Bearer ${tamperedToken}` },
  });
  expect(tamperedResponse.status()).toBe(401);
});
