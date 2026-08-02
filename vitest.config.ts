import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

/**
 * Cuatro conjuntos de pruebas separados porque corren en mundos distintos.
 *
 * El proyecto `emulador` queda fuera de la corrida por omisión: necesita la
 * Emulator Suite escuchando, así que `npm test` no debe fallar en una máquina
 * que no la tenga levantada. Se ejecuta con `npm run prueba:emulador`, que la
 * arranca antes.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'dominio',
          environment: 'node',
          include: ['tests/unit/domain/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'servidor',
          environment: 'node',
          include: [
            'tests/unit/server/**/*.test.ts',
            'tests/constitucion/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        plugins: [viteReact()],
        test: {
          name: 'interfaz',
          environment: 'jsdom',
          globals: false,
          setupFiles: ['./tests/configuracion/jsdom.ts'],
          include: [
            'tests/unit/ui/**/*.test.{ts,tsx}',
            'tests/unit/features/**/*.test.{ts,tsx}',
            'tests/componentes/**/*.test.{ts,tsx}',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'emulador',
          environment: 'node',
          include: ['tests/emulador/**/*.test.ts'],
          // reglas.test.ts hace clearFirestore(); si corre en paralelo con
          // emitir-transaccion.test.ts se borran las series a mitad de prueba.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/server/**'],
      reporter: ['text', 'html'],
    },
  },
})
