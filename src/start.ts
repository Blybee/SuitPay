import { createStart } from '@tanstack/react-start'
import { middlewareBearer } from './features/sesion/middleware-bearer.ts'

/**
 * Arranque global de TanStack Start.
 *
 * El middleware Bearer se registra aquí para que **todas** las server functions
 * lleven el token (T174), sin tener que listarlo a mano en cada `*.funciones.ts`.
 */

export const startInstance = createStart(() => {
  return {
    functionMiddleware: [middlewareBearer],
  }
})
