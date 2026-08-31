import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import { interpretarCaptura } from '../../server/asistencia/interpretar.ts'
import type { ResultadoDeInterpretacion } from './tipos.ts'

export type { ResultadoDeInterpretacion } from './tipos.ts'

const esquemaCandidato = z.object({
  codigo: z.string().trim().min(1).max(80),
  descripcion: z.string().trim().min(1).max(400),
  unidad: z.string().trim().min(1).max(20),
})

/** Techo del catálogo activo compacto (~737 ítems hoy; margen para crecer). */
export const MAX_CANDIDATOS_ASISTENCIA = 2000

/** Expuesto para pruebas: audio e imagen comparten el mismo techo. */
export const esquemaInterpretarCaptura = z.object({
  tipo: z.enum(['audio', 'imagen']),
  medioUrl: z.string().trim().min(1).max(2000),
  candidatos: z.array(esquemaCandidato).max(MAX_CANDIDATOS_ASISTENCIA).optional(),
})

export interface RespuestaDeInterpretarCaptura {
  readonly ok: boolean
  readonly resultado?: ResultadoDeInterpretacion
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const interpretarCapturaFn = createServerFn({ method: 'POST' })
  .validator(esquemaInterpretarCaptura)
  .handler(async ({ data }): Promise<RespuestaDeInterpretarCaptura> => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'vendedor',
        'administrador',
      ])
      const resultado = await interpretarCaptura({
        tipo: data.tipo,
        medioUrl: data.medioUrl,
        candidatos: data.candidatos,
        vendedorId: identidad.uid,
      })
      return { ok: true, resultado }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo al interpretar captura', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })
