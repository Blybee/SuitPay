import { diaEnLima } from '../../domain/anulacion/ventana.ts'
import { listarComprobantes } from '../emision/emitir.funciones.ts'

const PAGINA = 8
const VENTANA_DIAS = 90

export interface ComprobanteResumido {
  readonly id: string
  readonly tipoDocumento: string
  readonly serie: string
  readonly numero: number | null
  readonly total: number
  readonly estado: string
}

/**
 * Últimos comprobantes de un cliente (página corta, cursor en el serverFn).
 */
export async function consultarComprobantesDeCliente(
  numeroDocumento: string,
  cursorId?: string,
): Promise<{
  readonly items: readonly ComprobanteResumido[]
  readonly hayMas: boolean
  readonly error?: string
}> {
  const hoy = diaEnLima(new Date())
  const inicio = diaEnLima(
    new Date(Date.now() - VENTANA_DIAS * 24 * 60 * 60 * 1000),
  )
  const respuesta = await listarComprobantes({
    data: {
      modo: 'rango',
      fechaInicio: inicio,
      fechaFin: hoy,
      clienteNumeroDocumento: numeroDocumento.trim(),
      limite: PAGINA,
      cursorId,
    },
  })
  if (!respuesta.ok || respuesta.items === undefined) {
    return {
      items: [],
      hayMas: false,
      error: respuesta.error?.mensaje ?? 'No se pudieron leer los comprobantes.',
    }
  }
  return {
    items: respuesta.items.map((item) => ({
      id: item.id,
      tipoDocumento: item.tipoDocumento,
      serie: item.serie,
      numero: item.numero,
      total: item.total,
      estado: item.estado,
    })),
    hayMas: respuesta.hayMas === true,
  }
}
