import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import {
  leerLotePorDia,
  leerLotesNoVencidos,
  leerMemoriaDeAprendizaje,
  registrarRevision,
} from '../../server/aprendizaje/almacen.ts'
import { procesarLoteAprendizaje } from '../../server/aprendizaje/procesar-lote.ts'
import { diaEnLima } from '../../domain/anulacion/ventana.ts'

const esquemaPar = z.object({
  textoOriginal: z.string().trim().min(1).max(400),
  codigoAprobado: z.string().trim().min(1).max(40),
  descripcionAprobada: z.string().trim().min(1).max(300),
})

const esquemaRegistrar = z.object({
  medio: z.string().trim().min(1).max(40),
  pares: z.array(esquemaPar).min(1).max(200),
  clienteId: z.string().trim().max(20).optional(),
})

export const registrarRevisionFn = createServerFn({ method: 'POST' })
  .validator(esquemaRegistrar)
  .handler(async ({ data }) => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'vendedor',
        'administrador',
      ])
      const id = await registrarRevision({
        diaLima: diaEnLima(new Date()),
        medio: data.medio,
        pares: data.pares,
        vendedorId: identidad.uid,
        clienteId: data.clienteId,
      })
      return { ok: true as const, id }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false as const, error: error.aRespuesta() }
      }
      return {
        ok: false as const,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

export const procesarLoteAprendizajeFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    try {
      await exigirIdentidad(getRequestHeaders(), [
        'vendedor',
        'administrador',
        'jefe',
      ])
      const resultado = await procesarLoteAprendizaje()
      return { ok: true as const, ...resultado }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false as const, error: error.aRespuesta() }
      }
      return {
        ok: false as const,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

export const leerMemoriaAprendizajeFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    try {
      await exigirIdentidad(getRequestHeaders(), ['administrador', 'jefe'])
      const productos = await leerMemoriaDeAprendizaje()
      return { ok: true as const, productos }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false as const, error: error.aRespuesta() }
      }
      return {
        ok: false as const,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

export const listarLotesAprendizajeFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    try {
      await exigirIdentidad(getRequestHeaders(), ['administrador', 'jefe'])
      const lotes = await leerLotesNoVencidos(new Date())
      return { ok: true as const, lotes }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false as const, error: error.aRespuesta() }
      }
      return {
        ok: false as const,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

const esquemaLote = z.object({
  diaLima: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const leerLoteAprendizajeFn = createServerFn({ method: 'POST' })
  .validator(esquemaLote)
  .handler(async ({ data }) => {
    try {
      await exigirIdentidad(getRequestHeaders(), ['administrador', 'jefe'])
      const lote = await leerLotePorDia(data.diaLima, new Date())
      return { ok: true as const, lote }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false as const, error: error.aRespuesta() }
      }
      return {
        ok: false as const,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })
