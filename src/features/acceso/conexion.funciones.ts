import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { credencialesDesdeEncabezados } from '../../server/auth/verificar.ts'
import {
  completarConexion,
  pedirComplecionAWorkOS,
  verificarTokenDeConexion,
} from '../../server/acceso/completar-authkit.ts'
import type { ResultadoDeConexion } from './conexion.ts'

const esquema = z.object({
  externalAuthId: z.string(),
})

export const completarConexionAuthKitFn = createServerFn({ method: 'POST' })
  .validator(esquema)
  .handler(async ({ data }): Promise<ResultadoDeConexion> => {
    const token = credencialesDesdeEncabezados(getRequestHeaders()).tokenDeSesion
    return completarConexion({
      token,
      externalAuthId: data.externalAuthId,
      clave: process.env['WORKOS_API_KEY'],
      verificar: verificarTokenDeConexion,
      transportar: (pedido, clave) => pedirComplecionAWorkOS(pedido, clave),
    })
  })
