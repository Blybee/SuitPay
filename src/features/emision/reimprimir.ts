import {
  leerComprobante,
  obtenerUrlPdfComprobante,
} from './emitir.funciones.ts'
import { compartirDocumento, nombreDelComprobante } from './compartir.ts'
import { imprimirDocumento } from './impresion.ts'
import type { ResultadoDeCompartir } from './compartir.ts'
import type { ResultadoDeImpresion } from './impresion.ts'

/**
 * Reimprimir un comprobante ya emitido (FR-055 / FR-059).
 *
 * Usa la URL PDF persistida en el documento. Si falta, obtiene el enlace por
 * consulta al proveedor (nunca reemite; nunca sube el binario a Storage).
 */

export type ResultadoDeReimpresion =
  | { readonly ok: true; readonly nombre: string }
  | {
      readonly ok: false
      readonly motivo:
        | 'no_encontrado'
        | 'sin_archivo_todavia'
        | 'no_se_pudo_abrir'
      readonly nombre: string | null
    }

export async function reimprimir(
  comprobanteId: string,
): Promise<ResultadoDeReimpresion> {
  const comprobante = await leerComprobante({ data: { comprobanteId } }).catch(
    () => undefined,
  )

  if (comprobante === undefined) {
    return { ok: false, motivo: 'no_encontrado', nombre: null }
  }

  const nombre = nombreDelComprobante(comprobante.serie, comprobante.numero)

  const url = await obtenerUrlPdfComprobante({
    data: { comprobanteId },
  }).catch(() => undefined)

  const pdf =
    url?.ok === true && url.urlPdf !== undefined && url.urlPdf !== null
      ? url.urlPdf
      : null

  if (pdf === null || pdf === '') {
    return { ok: false, motivo: 'sin_archivo_todavia', nombre }
  }

  const resultado: ResultadoDeImpresion = imprimirDocumento(pdf)
  if (!resultado.ok) {
    return { ok: false, motivo: 'no_se_pudo_abrir', nombre }
  }

  return { ok: true, nombre }
}

export async function compartirComprobante(
  comprobanteId: string,
): Promise<ResultadoDeCompartir> {
  const comprobante = await leerComprobante({ data: { comprobanteId } }).catch(
    () => undefined,
  )

  if (comprobante === undefined) {
    return { ok: false, motivo: 'sin_archivo' }
  }

  return compartirDocumento(
    comprobante.proveedor?.pdf ?? null,
    nombreDelComprobante(comprobante.serie, comprobante.numero),
  )
}
