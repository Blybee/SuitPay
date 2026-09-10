import { bytesDePdfDeNotaVenta } from '../../domain/documentos/pdf-nota-venta.ts'
import type { Comprobante } from './emitir.funciones.ts'

export function blobDePdfDeNotaVenta(comprobante: Comprobante): Blob {
  const emitidoEn =
    comprobante.emitidoEn instanceof Date
      ? comprobante.emitidoEn
      : new Date(comprobante.emitidoEn)
  const bytes = bytesDePdfDeNotaVenta({
    emitidoEn,
    numero: comprobante.numero,
    cliente: comprobante.cliente?.denominacion ?? null,
    lineas: comprobante.lineas.map((linea) => ({
      codigo: linea.codigo,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      precio: linea.precio,
      importe: linea.importe,
    })),
    total: comprobante.total,
  })
  const copia = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copia).set(bytes)
  return new Blob([copia], { type: 'application/pdf' })
}

export function urlPdfDeNotaVenta(comprobante: Comprobante): string {
  return URL.createObjectURL(blobDePdfDeNotaVenta(comprobante))
}
