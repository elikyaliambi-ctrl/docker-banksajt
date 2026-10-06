import { defineConfig, devices } from "@playwright/test";

// Testerna körs mot en separat teststack (docker-compose.test.yml i
// repo-roten), på egna portar så de aldrig rör den vanliga lokala eller
// publicerade banksajten. Stacken måste redan vara igång innan testerna
// startar, därför ingen webServer-konfiguration här.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3002",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
