import type { CodigoDeError } from '../emision/emitir.funciones.ts'
import type { Comprobante } from '../emision/emitir.funciones.ts'
import type { TrasladoDeGuia } from '../../domain/guia/tipos.ts'

/** FR-012: solo el rechazo definitivo ofrece regenerar; no indeterminado ni indisponible. */
export function debeMostrarToastRegenerar(codigo: CodigoDeError): boolean {
  return codigo === 'emision_rechazada'
}

export function trasladoDesdeComprobante(
  comprobante: Comprobante,
): TrasladoDeGuia | null {
  const traslado = comprobante.traslado
  if (traslado === undefined || traslado === null) return null
  return traslado
}
