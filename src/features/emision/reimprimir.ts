import { leerComprobante } from './emitir.funciones.ts'
import { compartirDocumento, nombreDelComprobante } from './compartir.ts'
import { imprimirDocumento } from './impresion.ts'
import type { ResultadoDeCompartir } from './compartir.ts'
import type { ResultadoDeImpresion } from './impresion.ts'

/**
 * Reimprimir un comprobante ya emitido (FR-055).
 *
 * ## Por qué esto es una lectura y nada más
 *
 * Es la garantía entera del módulo: reimprimir **no escribe nada**. No cambia el
 * estado, no anota un intento, no toca el correlativo. Se lee el comprobante, se
 * abre su archivo, y si la impresora falla lo único que ocurre es que no sale el
 * papel.
 *
 * Escrito de otro modo —por ejemplo, "si no hay PDF, vuelve a pedirlo al
 * proveedor"— la reimpresión se habría convertido en un segundo camino de emisión.
 * Cuando no hay archivo se dice que no hay archivo.
 *
 * ## El caso del documento sin archivo
 *
 * Ocurre de verdad: una venta en espera tiene comprobante pero todavía no tiene
 * PDF, porque el proveedor no lo ha generado. Se distingue de un error, y lo que
 * se ofrece es el documento interno de contingencia, que no es lo mismo y tiene que
 * decirlo en la cara.
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
  const pdf = comprobante.proveedor?.pdf ?? null

  if (pdf === null) {
    // No se pide nada al proveedor. Que falte el archivo no autoriza a emitir.
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
