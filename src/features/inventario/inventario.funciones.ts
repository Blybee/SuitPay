import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import type { Existencia } from '../../domain/inventario/tipos.ts'
import { AlmacenDeInventarioFirestore } from '../../server/inventario/almacen-firestore.ts'

export interface RespuestaDeExistencia {
  readonly ok: boolean
  readonly existencia?: Existencia | null
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const leerInventarioFn = createServerFn({ method: 'POST' })
  .validator(z.object({ codigo: z.string().trim().min(1).max(40) }))
  .handler(async ({ data }): Promise<RespuestaDeExistencia> => {
    try {
      await exigirIdentidad(getRequestHeaders(), [
        'vendedor',
        'administrador',
        'jefe',
      ])
      const existencia = await new AlmacenDeInventarioFirestore().leer(
        data.codigo,
      )
      return { ok: true, existencia }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al leer inventario', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

export const escribirInventarioFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      codigo: z.string().trim().min(1).max(40),
      cantidad: z.number().finite(),
      umbral: z.number().finite().optional(),
    }),
  )
  .handler(async ({ data }): Promise<RespuestaDeExistencia> => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'administrador',
      ])
      const existencia = await new AlmacenDeInventarioFirestore().fijar({
        codigo: data.codigo,
        cantidad: data.cantidad,
        umbral: data.umbral,
        autorId: identidad.uid,
        momento: new Date(),
      })
      return { ok: true, existencia }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al escribir inventario', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

export interface RespuestaDeAlertas {
  readonly ok: boolean
  readonly alertas?: readonly Existencia[]
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const listarAlertasInventarioFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RespuestaDeAlertas> => {
    try {
      await exigirIdentidad(getRequestHeaders(), ['administrador', 'jefe'])
      const alertas = await new AlmacenDeInventarioFirestore().listarAlertas()
      return { ok: true, alertas }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al listar alertas de inventario', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  },
)
