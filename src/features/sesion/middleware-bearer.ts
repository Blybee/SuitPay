import { createMiddleware } from '@tanstack/react-start'
import { obtenerAutenticacion } from '../../infra/firebase/cliente.ts'

/**
 * Adjunta el ID token de Firebase a cada server function (T174).
 *
 * `exigirIdentidad` lee `Authorization: Bearer …` y nunca un uid del cuerpo.
 * Sin este puente, el cliente puede tener sesión en el navegador y el servidor
 * responder `sesion_ausente`.
 */

export const middlewareBearer = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const usuario = obtenerAutenticacion().currentUser
    if (usuario === null) {
      return next()
    }
    const token = await usuario.getIdToken()
    return next({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  },
)
