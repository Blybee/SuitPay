import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(({ mode }) => {
  // Carga .env / .env.local en process.env del servidor (claves ASISTENCIA_*,
  // PROVEEDOR_*, etc.). Vite solo expone VITE_* a import.meta.env del cliente.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [clave, valor] of Object.entries(env)) {
    if (process.env[clave] === undefined) {
      process.env[clave] = valor
    }
  }

  return {
    resolve: { tsconfigPaths: true },
    ssr: {
      // Fuerza a Nitro a empaquetar unpdf + unpdf/pdfjs (el import dinámico
      // interno de unpdf no siempre queda en el grafo de producción).
      noExternal: ['unpdf'],
    },
    plugins: [
      devtools(),
      tailwindcss(),
      tanstackStart({
        // Modo SPA por la decisión 1b de research.md: la sesión de Firebase se
        // resuelve en el cliente, así que renderizar en el servidor produciría
        // un caparazón sin usuario. El servidor sigue existiendo para las
        // funciones; simplemente no renderiza páginas.
        spa: { enabled: true },
      }),
      // Nitro produce `.output/server` que App Hosting/Cloud Run arrancan en PORT.
      nitro({
        // Nitro 3 empaqueta TODO node_modules en `.output/server/_libs`. Al
        // hacerlo con `firebase-admin`, la interop CJS→ESM de rolldown deja
        // `import_app.default` indefinido en `firebase-admin/lib/esm/app` y el
        // chunk lanza `Cannot read properties of undefined (reading
        // 'SDK_VERSION')` al cargarse. Como cada función de servidor lo importa
        // (sesión, Firestore, Storage), TODAS respondían 500 en producción y
        // el cliente veía `respuesta` undefined. Dejarlo externo y trazado a
        // `.output/server/node_modules` hace que Node resuelva la interop de
        // forma nativa. Verificado por `scripts/humo-produccion.mjs`.
        traceDeps: ['firebase-admin'],
      }),
      viteReact(),
    ],
  }
})

export default config
