import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import {
  guardarParametros,
  leerParametros,
} from '../../server/parametros/gestionar.ts'
import { esquemaDeParametros } from '../../domain/esquemas/comunes.ts'
import type { Parametros } from '../../domain/esquemas/comunes.ts'
import type { ModelosVisibles } from '../../server/ia/modelos.ts'

export type { Parametros, ModelosVisibles }

export interface RespuestaDeParametros {
  readonly ok: boolean
  readonly parametros?: Parametros
  readonly modelos?: ModelosVisibles
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
      const { modelosVisibles } = await import('../../server/ia/modelos.ts')
      return {
        ok: true,
        parametros: await leerParametros(),
        modelos: modelosVisibles(),
      }
    }),
)

export const guardarParametrosFn = createServerFn({ method: 'POST' })
  .validator(esquemaDeParametros)
  .handler(async ({ data }): Promise<RespuestaDeParametros> =>
    segura(async () => {
      await exigirIdentidad(getRequestHeaders(), ['administrador'])
      return { ok: true, parametros: await guardarParametros(data) }
    }),
  )
