import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import type { DiagnosticoDeAsistencia } from '../../server/asistencia/diagnostico.ts'

export type {
  DiagnosticoDeAsistencia,
  SondaDeClave,
} from '../../server/asistencia/diagnostico.ts'

export interface RespuestaDeDiagnostico {
  readonly ok: boolean
  readonly diagnostico?: DiagnosticoDeAsistencia
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

/**
 * Sondea Gemini con cada clave configurada en el servidor (solo administrador).
 * Hace la llamada real desde el mismo proceso que atiende al mostrador, así que
 * lo que devuelve es exactamente lo que le pasa a una foto o un PDF.
 */
export const diagnosticarAsistenciaFn = createServerFn({
  method: 'POST',
}).handler(async (): Promise<RespuestaDeDiagnostico> => {
  try {
    await exigirIdentidad(getRequestHeaders(), ['administrador'])
    const { diagnosticarAsistencia } =
      await import('../../server/asistencia/diagnostico.ts')
    return { ok: true, diagnostico: await diagnosticarAsistencia() }
  } catch (error) {
    if (esErrorDeSuitPay(error)) {
      return { ok: false, error: error.aRespuesta() }
    }
    console.error('[SuitPay] fallo al diagnosticar asistencia', error)
    return {
      ok: false,
      error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
    }
  }
})
