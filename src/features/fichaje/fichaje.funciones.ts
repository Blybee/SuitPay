import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import {
  aprobarSolicitudes,
  editarMarca,
  eliminarHistorial,
  eliminarMarca,
  fijarHorarioEntrada,
  quitarDelEquipo,
  rechazarSolicitud,
  registrarManual,
  registrarManualVariosDias,
  solicitarEntrada,
} from '../../server/fichaje/gestionar.ts'

const ESTADOS = z.enum(['presente', 'tardanza', 'falta', 'justificado'])

export interface RespuestaDeFichaje {
  readonly ok: boolean
  readonly id?: string
  readonly repetida?: boolean
  readonly cantidad?: number
  readonly folio?: number
  /** Frase del lote: días registrados y días que ya tenían entrada. */
  readonly mensaje?: string
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

function envolver(
  trabajo: () => Promise<RespuestaDeFichaje>,
): Promise<RespuestaDeFichaje> {
  return trabajo().catch((error: unknown) => {
    if (esErrorDeSuitPay(error)) {
      return { ok: false, error: error.aRespuesta() }
    }
    console.error('[SuitPay] fallo en fichaje', error)
    return {
      ok: false,
      error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
    }
  })
}

/** Pública: el trabajador no tiene cuenta. Solo deja un pendiente. */
export const solicitarEntradaFn = createServerFn({ method: 'POST' })
  .validator(z.object({ nombre: z.string().min(1).max(80) }))
  .handler(async ({ data }): Promise<RespuestaDeFichaje> =>
    envolver(async () => {
      const resultado = await solicitarEntrada(data.nombre)
      return { ok: true, id: resultado.id, repetida: resultado.repetida }
    }),
  )

export const aprobarFichajesFn = createServerFn({ method: 'POST' })
  .validator(z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }))
  .handler(async ({ data }): Promise<RespuestaDeFichaje> =>
    envolver(async () => {
      const identidad = await exigirIdentidad(getRequestHeaders(), ['jefe'])
      const cantidad = await aprobarSolicitudes(data.ids, identidad.uid)
      return { ok: true, cantidad }
    }),
  )

export const rechazarFichajeFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }): Promise<RespuestaDeFichaje> =>
    envolver(async () => {
      const identidad = await exigirIdentidad(getRequestHeaders(), ['jefe'])
      await rechazarSolicitud(data.id, identidad.uid)
      return { ok: true }
    }),
  )

const CAMPOS_DE_ALTA = {
  nombre: z.string().min(1).max(80),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  estado: ESTADOS,
  observacion: z.string().max(400),
}

export const registrarManualFn = createServerFn({ method: 'POST' })
  .validator(
    z.discriminatedUnion('modo', [
      z.object({
        modo: z.literal('dia'),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        ...CAMPOS_DE_ALTA,
      }),
      z.object({
        modo: z.literal('semana'),
        fechas: z
          .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
          .min(1)
          .max(6),
        ...CAMPOS_DE_ALTA,
      }),
    ]),
  )
  .handler(async ({ data }): Promise<RespuestaDeFichaje> =>
    envolver(async () => {
      const identidad = await exigirIdentidad(getRequestHeaders(), ['jefe'])
      if (data.modo === 'dia') {
        const folio = await registrarManual(
          {
            nombre: data.nombre,
            fecha: data.fecha,
            hora: data.hora,
            estado: data.estado,
            observacion: data.observacion,
          },
          identidad.uid,
        )
        return { ok: true, folio }
      }
      const lote = await registrarManualVariosDias(
        {
          nombre: data.nombre,
          fechas: data.fechas,
          hora: data.hora,
          estado: data.estado,
          observacion: data.observacion,
        },
        identidad.uid,
      )
      return {
        ok: true,
        folio: lote.folio,
        cantidad: lote.cantidad,
        mensaje: lote.mensaje,
      }
    }),
  )

export const editarMarcaFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string().min(1),
      hora: z.string().regex(/^\d{2}:\d{2}$/),
      estado: ESTADOS,
      observacion: z.string().max(400),
    }),
  )
  .handler(async ({ data }): Promise<RespuestaDeFichaje> =>
    envolver(async () => {
      const identidad = await exigirIdentidad(getRequestHeaders(), ['jefe'])
      await editarMarca(
        data.id,
        {
          hora: data.hora,
          estado: data.estado,
          observacion: data.observacion,
        },
        identidad.uid,
      )
      return { ok: true }
    }),
  )

export const eliminarMarcaFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }): Promise<RespuestaDeFichaje> =>
    envolver(async () => {
      await exigirIdentidad(getRequestHeaders(), ['jefe'])
      await eliminarMarca(data.id)
      return { ok: true }
    }),
  )

export const eliminarHistorialFn = createServerFn({ method: 'POST' })
  .validator(z.object({ clave: z.string().min(1) }))
  .handler(async ({ data }): Promise<RespuestaDeFichaje> =>
    envolver(async () => {
      await exigirIdentidad(getRequestHeaders(), ['jefe'])
      await eliminarHistorial(data.clave)
      return { ok: true }
    }),
  )

export const fijarHorarioEntradaFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      clave: z.string().min(1).max(80),
      dias: z.record(z.string(), z.string()),
    }),
  )
  .handler(async ({ data }): Promise<RespuestaDeFichaje> =>
    envolver(async () => {
      await exigirIdentidad(getRequestHeaders(), ['jefe'])
      await fijarHorarioEntrada(data.clave, data.dias)
      return { ok: true }
    }),
  )

export const quitarDelEquipoFn = createServerFn({ method: 'POST' })
  .validator(z.object({ clave: z.string().min(1) }))
  .handler(async ({ data }): Promise<RespuestaDeFichaje> =>
    envolver(async () => {
      await exigirIdentidad(getRequestHeaders(), ['jefe'])
      await quitarDelEquipo(data.clave)
      return { ok: true }
    }),
  )
