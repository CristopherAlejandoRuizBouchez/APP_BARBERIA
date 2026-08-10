import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de extremo a extremo.
 *
 * Sin credenciales de una base de prueba, CI comprueba las rutas estáticas,
 * autenticación, accesibilidad básica, salud y cabeceras. Los recorridos con
 * datos se ejecutan contra staging antes de promover a producción.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  },

  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    // El sitio público se usa sobre todo desde el celular: se prueba siempre.
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: 'corepack pnpm@10.28.0 build && corepack pnpm@10.28.0 start --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3000',
    env: { ...process.env, npm_config_engine_strict: 'false' },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
