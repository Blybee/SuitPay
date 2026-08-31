import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import { extraerListaPdf } from '../../server/asistencia/extraer-pdf.ts'
import type { ResultadoDeListaPdf } from '../../server/asistencia/extraer-pdf.ts'

export type { ResultadoDeListaPdf }

export const esquemaExtraerListaPdf = z.object({
  medioUrl: z.string().trim().min(1).max(2000),
})

export interface RespuestaDeExtraerListaPdf {
  readonly ok: boolean
  readonly resultado?: ResultadoDeListaPdf
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const extraerListaPdfFn = createServerFn({ method: 'POST' })
  .validator(esquemaExtraerListaPdf)
  .handler(async ({ data }): Promise<RespuestaDeExtraerListaPdf> => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'vendedor',
        'administrador',
      ])
      const resultado = await extraerListaPdf({
        medioUrl: data.medioUrl,
        vendedorId: identidad.uid,
      })
      return { ok: true, resultado }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al extraer lista PDF', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

const esquemaRequerimiento = z.object({
  medioUrl: z.string().trim().max(2000).optional(),
  tipoMedio: z.enum(['pdf', 'imagen']).optional(),
  texto: z.string().max(20_000).optional(),
  clienteId: z.string().trim().max(20).optional(),
})

export const interpretarRequerimientoFn = createServerFn({ method: 'POST' })
  .validator(esquemaRequerimiento)
  .handler(async ({ data }): Promise<RespuestaDeExtraerListaPdf> => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'vendedor',
        'administrador',
      ])
      const { interpretarRequerimiento } = await import(
        '../../server/asistencia/requerimiento.ts'
      )
      const resultado = await interpretarRequerimiento({
        medioUrl: data.medioUrl,
        tipoMedio: data.tipoMedio,
        texto: data.texto,
        clienteId: data.clienteId,
        vendedorId: identidad.uid,
      })
      return { ok: true, resultado }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al interpretar requerimiento', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })
