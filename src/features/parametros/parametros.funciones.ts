import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import {
  guardarParametros,
  leerParametros,
} from '../../server/parametros/gestionar.ts'
import type { Parametros } from '../../domain/esquemas/comunes.ts'

export type { Parametros }

export interface RespuestaDeParametros {
  readonly ok: boolean
  readonly parametros?: Parametros
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

async function segura(
  trabajo: () => Promise<RespuestaDeParametros>,
): Promise<RespuestaDeParametros> {
  try {
    return await trabajo()
  } catch (error) {
    if (esErrorDeSuitPay(error)) {
      return { ok: false, error: error.aRespuesta() }
    }
    console.error('[SuitPay] fallo en parámetros', error)
    return {
      ok: false,
      error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
    }
  }
}

export const leerParametrosFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RespuestaDeParametros> =>
    segura(async () => {
      await exigirIdentidad(getRequestHeaders(), [
        'administrador',
        'vendedor',
        'jefe',
      ])
      return { ok: true, parametros: await leerParametros() }
    }),
)

export const guardarParametrosFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      umbralIdentificacionBoleta: z.number().int().positive(),
      ventanaAnulacion: z.literal('mismo_dia'),
      formatoImpresionPorDefecto: z.enum(['a4', 'rollo']),
    }),
  )
  .handler(async ({ data }): Promise<RespuestaDeParametros> =>
    segura(async () => {
      await exigirIdentidad(getRequestHeaders(), ['administrador'])
      return { ok: true, parametros: await guardarParametros(data) }
    }),
  )
