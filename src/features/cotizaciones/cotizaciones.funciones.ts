import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import { reservarNumeroCotizacion } from '../../server/cotizaciones/numerar.ts'

/**
 * Puerta del cliente hacia la numeración de cotizaciones.
 * El número lo reserva el servidor; el documento lo escribe el cliente.
 */

export interface RespuestaDeNumero {
  readonly ok: boolean
  readonly numero?: number
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const reservarNumeroCotizacionFn = createServerFn({
  method: 'POST',
}).handler(async (): Promise<RespuestaDeNumero> => {
  try {
    await exigirIdentidad(getRequestHeaders(), ['vendedor', 'administrador'])
    const numero = await reservarNumeroCotizacion()
    return { ok: true, numero }
  } catch (error) {
    if (esErrorDeSuitPay(error)) {
      return { ok: false, error: error.aRespuesta() }
    }
    console.error('[SuitPay] fallo al numerar cotización', error)
    return {
      ok: false,
      error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
    }
  }
})
