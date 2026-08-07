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
    // false: el e2e de captura exige VITE_USAR_EMULADORES y vars demo; un
    // `npm run dev` previo con .env.local de nube rompería la siembra de sesión.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Por omisión el e2e usa el proveedor **real** (demo). Solo si exportas
      // PROVEEDOR_SIMULADO=true se fuerza el doble local.
      ...(process.env.PROVEEDOR_SIMULADO === 'true'
        ? { PROVEEDOR_SIMULADO: 'true' }
        : { PROVEEDOR_SIMULADO: 'false' }),
      ASISTENCIA_SIMULADA: process.env.ASISTENCIA_SIMULADA ?? 'true',
      FIRESTORE_EMULATOR_HOST:
        process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080',
      FIREBASE_AUTH_EMULATOR_HOST:
        process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
      FIREBASE_STORAGE_EMULATOR_HOST:
        process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199',
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT ?? 'demo-suitpay',
      // Fuerza cliente contra emuladores en e2e (no pisa .env.local si ya está
      // en process.env del padre; aquí el webServer arranca hijo limpio).
      VITE_USAR_EMULADORES: 'true',
      VITE_FIREBASE_PROJECT_ID: 'demo-suitpay',
      VITE_FIREBASE_API_KEY:
        process.env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-suitpay.firebaseapp.com',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-suitpay.appspot.com',
      VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID ?? 'demo-app-id',
    },
  },
})
