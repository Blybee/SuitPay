import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { TIPOS_CON_SERIE_ADMINISTRABLE, TIPOS_ELEGIBLES } from '../../domain/documentos/tipos.ts'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import {
  crearEstablecimiento,
  crearSerieAdministrativa,
  desactivarSerie,
  eliminarEstablecimiento,
  leerSerieDeVendedor,
  listarEstablecimientos,
  listarSeries,
} from '../../server/series/gestionar.ts'
import type { SerieAdministrativa } from '../../server/series/gestionar.ts'
import type { Establecimiento } from '../../server/proveedor/interfaz.ts'

export type { SerieAdministrativa, Establecimiento }

export interface RespuestaDeSeries {
  readonly ok: boolean
  readonly series?: readonly SerieAdministrativa[]
  readonly serie?: SerieAdministrativa | null
  readonly establecimientos?: readonly Establecimiento[]
  readonly establecimiento?: Establecimiento
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

async function segura(
  trabajo: () => Promise<RespuestaDeSeries>,
): Promise<RespuestaDeSeries> {
  try {
    return await trabajo()
  } catch (error) {
    if (esErrorDeSuitPay(error)) {
      return { ok: false, error: error.aRespuesta() }
    }
    console.error('[SuitPay] fallo en series', error)
    return {
      ok: false,
      error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
    }
  }
}

export const listarEstablecimientosFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<RespuestaDeSeries> =>
  segura(async () => {
    await exigirIdentidad(getRequestHeaders(), ['administrador'])
    return { ok: true, establecimientos: await listarEstablecimientos() }
  }),
)

export const crearEstablecimientoFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      nombre: z.string().optional(),
      codigoAnexo: z.string().min(1),
      direccion: z.string().min(1),
      ubigeoId: z.string().length(6),
      correo: z.string().email().optional(),
    }),
  )
  .handler(async ({ data }): Promise<RespuestaDeSeries> =>
    segura(async () => {
      await exigirIdentidad(getRequestHeaders(), ['administrador'])
      return {
        ok: true,
        establecimiento: await crearEstablecimiento(data),
      }
    }),
  )

export const eliminarEstablecimientoFn = createServerFn({ method: 'POST' })
  .validator(z.object({ establecimientoId: z.string().min(1) }))
  .handler(async ({ data }): Promise<RespuestaDeSeries> =>
    segura(async () => {
      await exigirIdentidad(getRequestHeaders(), ['administrador'])
      await eliminarEstablecimiento(data.establecimientoId)
      return { ok: true, establecimientos: await listarEstablecimientos() }
    }),
  )

export const listarSeriesFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RespuestaDeSeries> =>
    segura(async () => {
      await exigirIdentidad(getRequestHeaders(), ['administrador'])
      return { ok: true, series: await listarSeries() }
    }),
)

export const crearSerieFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      vendedorId: z.string().min(1),
      tipoDocumento: z.enum(TIPOS_CON_SERIE_ADMINISTRABLE),
      serie: z.string().max(4),
      numeroInicial: z.number().int().nonnegative(),
      establecimientoId: z.string(),
    }),
  )
  .handler(async ({ data }): Promise<RespuestaDeSeries> =>
    segura(async () => {
      await exigirIdentidad(getRequestHeaders(), ['administrador'])
      return { ok: true, serie: await crearSerieAdministrativa(data) }
    }),
  )

export const desactivarSerieFn = createServerFn({ method: 'POST' })
  .validator(z.object({ serieId: z.string().min(1) }))
  .handler(async ({ data }): Promise<RespuestaDeSeries> =>
    segura(async () => {
      await exigirIdentidad(getRequestHeaders(), ['administrador'])
      await desactivarSerie(data.serieId)
      return { ok: true, series: await listarSeries() }
    }),
  )

/** Serie del vendedor autenticado para la cabecera del mostrador. */
export const leerMiSerieFn = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      tipoDocumento: z.enum(TIPOS_ELEGIBLES),
    }),
  )
  .handler(async ({ data }): Promise<RespuestaDeSeries> =>
    segura(async () => {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'vendedor',
        'administrador',
      ])
      return {
        ok: true,
        serie: await leerSerieDeVendedor(
          identidad.uid,
          data.tipoDocumento,
        ),
      }
    }),
  )
