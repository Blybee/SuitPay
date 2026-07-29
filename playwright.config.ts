import { defineConfig, devices } from '@playwright/test'

/**
 * Dos proyectos porque el sistema se usa en dos escenas distintas y una de
 * ellas no es una versión estrecha de la otra: en el mostrador se opera de pie
 * con el teléfono, y el vendedor que toma pedidos de los vecinos lo hace casi
 * siempre así. Un flujo de venta que solo se prueba en escritorio no está
 * probado.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html']] : [['list']],

  use: {
    baseURL: process.env.URL_PRUEBAS ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'es-PE',
    timezoneId: 'America/Lima',
  },

  projects: [
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'movil',
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // El servidor de desarrollo emite de verdad —transacción, correlativo y
      // comprobante en Firestore— pero contra el proveedor simulado. Sin esto la
      // prueba llamaría a Factpro y fallaría por razones ajenas a lo que prueba.
      //
      // Se declara aquí y no en el guion de npm para no arrastrar `cross-env`:
      // Playwright pasa esto al proceso del servidor en cualquier sistema, y las
      // dos formas de escribir variables de entorno de Windows y de Unix dejan de
      // ser un problema.
      PROVEEDOR_SIMULADO: 'true',
    },
  },
})
