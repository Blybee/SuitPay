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
      nitro(),
      viteReact(),
    ],
  }
})

export default config
