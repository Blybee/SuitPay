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
      // Por omisión el e2e usa el proveedor **real** (demo). Solo si exportas
      // PROVEEDOR_SIMULADO=true se fuerza el doble local.
      ...(process.env.PROVEEDOR_SIMULADO === 'true'
        ? { PROVEEDOR_SIMULADO: 'true' }
        : { PROVEEDOR_SIMULADO: 'false' }),
    },
  },
})
