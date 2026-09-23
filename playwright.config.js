import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:8765/IRONLOG/",
    serviceWorkers: "allow",
    acceptDownloads: true,
  },
  projects: [
    {
      name: "android-chromium",
      use: { ...devices["Pixel 7"], browserName: "chromium" },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
  webServer: {
    command: "npm run serve",
    url: "http://127.0.0.1:8765/IRONLOG/",
    reuseExistingServer: true,
    timeout: 30000,
  },
  reporter: "list",
});
