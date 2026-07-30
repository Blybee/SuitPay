import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import {
  actualizarUsuario,
  crearUsuario,
  listarUsuarios,
} from '../../server/usuarios/gestionar.ts'
import type { UsuarioListado } from '../../server/usuarios/gestionar.ts'

export type { UsuarioListado }

const ROLES = z.enum(['vendedor', 'administrador', 'jefe'])

export interface RespuestaDeUsuarios {
  readonly ok: boolean
  readonly usuarios?: readonly UsuarioListado[]
  readonly usuario?: UsuarioListado
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

function envolver<T>(trabajo: () => Promise<T>): Promise<RespuestaDeUsuarios> {
  return trabajo()
    .then((valor) => {
      if (Array.isArray(valor)) {
        return { ok: true as const, usuarios: valor }
      }
      return { ok: true as const, usuario: valor as UsuarioListado }
    })
    .catch((error: unknown) => {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo en usuarios', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    })
}

export const listarUsuariosFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RespuestaDeUsuarios> =>
    envolver(async () => {
      await exigirIdentidad(getRequestHeaders(), ['administrador'])
      return listarUsuarios()
    }),
)

export const crearUsuarioFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      correo: z.string().email(),
      contrasena: z.string().min(8),
      nombre: z.string().min(1),
      rol: ROLES,
    }),
  )
  .handler(
    async ({ data }): Promise<RespuestaDeUsuarios> =>
      envolver(async () => {
        await exigirIdentidad(getRequestHeaders(), ['administrador'])
        return crearUsuario(data)
      }),
  )

export const actualizarUsuarioFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      uid: z.string().min(1),
      nombre: z.string().min(1).optional(),
      rol: ROLES.optional(),
      activo: z.boolean().optional(),
      contrasena: z.string().min(8).optional(),
    }),
  )
  .handler(
    async ({ data }): Promise<RespuestaDeUsuarios> =>
      envolver(async () => {
        await exigirIdentidad(getRequestHeaders(), ['administrador'])
        return actualizarUsuario(data)
      }),
  )
