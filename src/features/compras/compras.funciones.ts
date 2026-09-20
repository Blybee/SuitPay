import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import { extraerPreciosCompra } from '../../server/compras/extraer.ts'
import { aplicarPreciosCompra } from '../../server/compras/aplicar.ts'
import { AlmacenDeInventarioFirestore } from '../../server/inventario/almacen-firestore.ts'
import type { BocetoDeCompras } from '../../domain/compras/tipos.ts'
import { MAX_MEDIOS_COMPRAS } from '../../domain/compras/tipos.ts'
import type { Existencia } from '../../domain/inventario/tipos.ts'

const esquemaMedio = z.object({
  mimeType: z.enum([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]),
  dataBase64: z.string().min(1).max(12_000_000),
})

export interface RespuestaDeExtraccion {
  readonly ok: boolean
  readonly boceto?: BocetoDeCompras
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const extraerPreciosCompraFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      medios: z.array(esquemaMedio).min(1).max(MAX_MEDIOS_COMPRAS),
    }),
  )
  .handler(async ({ data }): Promise<RespuestaDeExtraccion> => {
    try {
      await exigirIdentidad(getRequestHeaders(), ['administrador'])
      const boceto = await extraerPreciosCompra({ medios: data.medios })
      return { ok: true, boceto }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al extraer precios de compra', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

const esquemaCoincidencia = z.object({
  codigo: z.string().trim().min(1).max(40),
  precioCompraCentimos: z.number().int().nonnegative(),
  precioCompraEn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  etiquetaFactura: z.string().trim().max(300),
})

export interface RespuestaDeAplicacion {
  readonly ok: boolean
  readonly existencias?: readonly Existencia[]
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const aplicarPreciosCompraFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      coincidencias: z.array(esquemaCoincidencia).min(1).max(400),
    }),
  )
  .handler(async ({ data }): Promise<RespuestaDeAplicacion> => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'administrador',
      ])
      const existencias = await aplicarPreciosCompra({
        coincidencias: data.coincidencias,
        autorId: identidad.uid,
        momento: new Date(),
        inventario: new AlmacenDeInventarioFirestore(),
      })
      return { ok: true, existencias }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al aplicar precios de compra', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })
