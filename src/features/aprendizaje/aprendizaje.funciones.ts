import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import {
  leerLotePorDia,
  leerLotesNoVencidos,
  leerMarcasDeAprendizaje,
  leerMemoriaDeAprendizaje,
  registrarRevision,
} from '../../server/aprendizaje/almacen.ts'
import {
  confirmarEntrenamiento,
  proponerEntrenamiento,
} from '../../server/aprendizaje/entrenar-par.ts'
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
      const [productos, marcas] = await Promise.all([
        leerMemoriaDeAprendizaje(),
        leerMarcasDeAprendizaje(),
      ])
      return { ok: true as const, productos, marcas }
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

const esquemaMedio = z.object({
  mimeType: z.enum([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]),
  dataBase64: z.string().min(1).max(12_000_000),
})

const esquemaLado = z
  .object({
    medio: esquemaMedio.optional(),
    texto: z.string().max(20_000).optional(),
  })
  .refine(
    (lado) => (lado.texto?.trim() ?? '') !== '' || lado.medio !== undefined,
    { message: 'sin_medio' },
  )

export const proponerEntrenamientoFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      pedido: esquemaLado,
      oro: esquemaLado,
    }),
  )
  .handler(async ({ data }) => {
    try {
      await exigirIdentidad(getRequestHeaders(), ['administrador', 'jefe'])
      const propuesta = await proponerEntrenamiento(data)
      return { ok: true as const, ...propuesta }
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

const esquemaAlineacion = z.object({
  textoPedido: z.string().trim().min(1).max(400),
  codigo: z.string().max(40),
  marca: z.string().max(120),
  estado: z.enum(['emparejado', 'omitido', 'no_en_catalogo']),
  aliases: z.array(z.string().max(120)).max(20),
  etiquetas: z.array(z.string().max(40)).max(10),
})

export const confirmarEntrenamientoFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      alineaciones: z.array(esquemaAlineacion).max(200),
      modelo: z.string().max(80),
      marcasPermitidas: z
        .array(
          z.object({
            familia: z.string().max(40),
            marca: z.string().max(120),
          }),
        )
        .max(80)
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'administrador',
        'jefe',
      ])
      const resultado = await confirmarEntrenamiento({
        uid: identidad.uid,
        alineaciones: data.alineaciones,
        modelo: data.modelo,
        marcasPermitidas: data.marcasPermitidas,
      })
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
