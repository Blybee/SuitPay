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
