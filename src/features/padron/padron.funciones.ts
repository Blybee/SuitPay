import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import {
  persistirLoteDeClientes,
  persistirLoteDeTransportistas,
} from '../../server/padron/persistir.ts'
import type { ConteoDeLote } from '../../domain/padron/tipos.ts'
import { aplicarEdicionDePadron } from '../../server/padron/guardar.ts'
import { COLECCIONES, DOCUMENTOS, bd } from '../../server/firebase/admin.ts'

const esquemaCliente = z
  .object({
    tipoDocumento: z.enum(['DNI', 'RUC']),
    numeroDocumento: z.string().regex(/^\d{8}$|^\d{11}$/),
    denominacion: z.string().trim().min(1).max(300),
    direccion: z.string().trim().min(1).max(300).optional(),
    telefono: z.string().trim().min(1).max(30).optional(),
  })
  .refine(
    (fila) =>
      (fila.tipoDocumento === 'DNI' && fila.numeroDocumento.length === 8) ||
      (fila.tipoDocumento === 'RUC' && fila.numeroDocumento.length === 11),
    { message: 'El tipo de documento no coincide con la longitud.' },
  )

const esquemaTransportista = z.object({
  numeroDocumento: z.string().regex(/^\d{11}$/),
  denominacion: z.string().trim().min(1).max(300),
  direccion: z.string().trim().min(1).max(300).optional(),
})

const esquema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('clientes'),
    filas: z.array(esquemaCliente).min(1).max(400),
  }),
  z.object({
    tipo: z.literal('transportistas'),
    filas: z.array(esquemaTransportista).min(1).max(400),
  }),
])

export interface RespuestaDeLoteDePadron {
  readonly ok: boolean
  readonly nuevos?: number
  readonly yaExistian?: number
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const guardarLoteDePadronFn = createServerFn({ method: 'POST' })
  .validator(esquema)
  .handler(async ({ data }): Promise<RespuestaDeLoteDePadron> => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'administrador',
      ])
      const conteo: ConteoDeLote =
        data.tipo === 'clientes'
          ? await persistirLoteDeClientes(data.filas, identidad.uid)
          : await persistirLoteDeTransportistas(data.filas, identidad.uid)
      return { ok: true, ...conteo }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al guardar lote de padrón', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

const fichaDeCliente = z.object({
  direccion: z.string().trim().max(300),
  telefono: z.string().trim().max(30),
  correo: z.string().trim().max(200),
  ubigeo: z.string().trim().max(10),
  condicion: z.string().trim().max(60),
})

const fichaDeTransportista = z.object({
  direccion: z.string().trim().max(300),
  numeroRegistroMtc: z.string().trim().max(40),
})

const altaDeCliente = z
  .object({
    tipoDocumento: z.enum(['DNI', 'RUC']),
    numeroDocumento: z.string().regex(/^\d{8}$|^\d{11}$/),
    denominacion: z.string().trim().min(1).max(300),
    direccion: z.string().trim().max(300).optional(),
    telefono: z.string().trim().max(30).optional(),
    correo: z.string().trim().max(200).optional(),
    ubigeo: z.string().trim().max(10).optional(),
    condicion: z.string().trim().max(60).optional(),
  })
  .refine(
    (fila) =>
      (fila.tipoDocumento === 'DNI' && fila.numeroDocumento.length === 8) ||
      (fila.tipoDocumento === 'RUC' && fila.numeroDocumento.length === 11),
    { message: 'El tipo de documento no coincide con la longitud.' },
  )

const cambioDeCliente = z.object({
  numeroDocumento: z.string().regex(/^\d{8}$|^\d{11}$/),
  denominacion: z.string().trim().min(1).max(300),
  ficha: fichaDeCliente.optional(),
})

const altaDeTransportista = z.object({
  numeroDocumento: z.string().regex(/^\d{11}$/),
  denominacion: z.string().trim().min(1).max(300),
  direccion: z.string().trim().max(300).optional(),
  numeroRegistroMtc: z.string().trim().max(40).optional(),
})

const cambioDeTransportista = z.object({
  numeroDocumento: z.string().regex(/^\d{11}$/),
  denominacion: z.string().trim().min(1).max(300),
  ficha: fichaDeTransportista.optional(),
})

const esquemaDeEdicion = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('clientes'),
    altas: z.array(altaDeCliente).max(500),
    cambios: z.array(cambioDeCliente).max(500),
  }),
  z.object({
    tipo: z.literal('transportistas'),
    altas: z.array(altaDeTransportista).max(500),
    cambios: z.array(cambioDeTransportista).max(500),
  }),
])

export interface RespuestaDeEdicionDePadron {
  readonly ok: boolean
  readonly escritos?: number
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const leerIndiceDeClientesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await exigirIdentidad(getRequestHeaders(), ['administrador'])
    const [coleccion, id] = DOCUMENTOS.indiceDeClientes.split('/')
    const snap = await bd()
      .collection(coleccion ?? COLECCIONES.indices)
      .doc(id ?? 'clientes')
      .get()
    const cruda = snap.data()?.['clientes']
    const clientes: Array<{ numeroDocumento: string; denominacion: string }> =
      []
    if (Array.isArray(cruda)) {
      for (const entrada of cruda) {
        if (typeof entrada !== 'object' || entrada === null) continue
        const numero = (entrada as { numeroDocumento?: unknown }).numeroDocumento
        const denominacion = (entrada as { denominacion?: unknown }).denominacion
        if (typeof numero !== 'string' || typeof denominacion !== 'string') {
          continue
        }
        clientes.push({ numeroDocumento: numero, denominacion })
      }
    }
    return { ok: true as const, clientes }
  },
)

export const aplicarEdicionDePadronFn = createServerFn({ method: 'POST' })
  .validator(esquemaDeEdicion)
  .handler(async ({ data }): Promise<RespuestaDeEdicionDePadron> => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'administrador',
      ])
      const escritos = await aplicarEdicionDePadron(data, identidad.uid)
      return { ok: true, escritos }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al guardar la edición del padrón', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })
