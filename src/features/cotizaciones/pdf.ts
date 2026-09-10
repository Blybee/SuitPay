import { bytesDePdfInterno } from '../../domain/documentos/pdf-interno.ts'
import { calcularImporte } from '../../domain/totales/calculo.ts'
import { imprimirDocumento } from '../emision/impresion.ts'
import type { ResultadoDeImpresion } from '../emision/impresion.ts'
import type { Cotizacion } from './tipos.ts'

export function blobDePdfDeCotizacion(cotizacion: Cotizacion): Blob {
  const creadoEn =
    cotizacion.creadoEn instanceof Date
      ? cotizacion.creadoEn
      : new Date(cotizacion.creadoEn)
  const bytes = bytesDePdfInterno({
    clase: 'cotizacion',
    emitidoEn: creadoEn,
    numero: cotizacion.numero,
    cliente: cotizacion.cliente?.denominacion ?? null,
    lineas: cotizacion.lineas.map((linea) => ({
      codigo: linea.codigo,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      precio: linea.precio,
      importe: calcularImporte(linea),
    })),
    total: cotizacion.total,
  })
  const copia = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copia).set(bytes)
  return new Blob([copia], { type: 'application/pdf' })
}

export function abrirPdfDeCotizacion(
  cotizacion: Cotizacion,
): ResultadoDeImpresion {
  const url = URL.createObjectURL(blobDePdfDeCotizacion(cotizacion))
  const resultado = imprimirDocumento(url)
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 60_000)
  return resultado
}
