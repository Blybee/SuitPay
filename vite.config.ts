import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
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
    viteReact(),
  ],
})

export default config
