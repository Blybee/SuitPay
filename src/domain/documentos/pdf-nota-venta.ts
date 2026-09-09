import { formatearImporte } from '../totales/calculo.ts'
import type { Centimos } from '../totales/calculo.ts'

export interface LineaDePdfNotaVenta {
  readonly descripcion: string
  readonly cantidad: number
  readonly importe: Centimos
}

export interface DatosDePdfNotaVenta {
  readonly emitidoEn: Date
  readonly cliente: string | null
  readonly lineas: readonly LineaDePdfNotaVenta[]
  readonly total: Centimos
}

/**
 * PDF A4 de nota de venta (Helvetica / WinAnsi).
 * Documento interno: SuitPay lo compone porque no pasa por el proveedor.
 * El título va grande; no se imprime ninguna leyenda de valor tributario.
 */

function asciiParaPdf(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function escaparLiteral(texto: string): string {
  const plano = asciiParaPdf(texto)
  let out = ''
  for (const ch of plano) {
    const codigo = ch.codePointAt(0) ?? 63
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += `\\${ch}`
    } else if (codigo >= 32 && codigo <= 126) {
      out += ch
    } else if (codigo <= 255) {
      out += `\\${codigo.toString(8).padStart(3, '0')}`
    } else {
      out += '?'
    }
  }
  return out
}

function objeto(id: number, cuerpo: string): string {
  return `${id} 0 obj\n${cuerpo}\nendobj\n`
}

function lineaDeTexto(texto: string): string {
  return `(${escaparLiteral(texto)}) '\n`
}

export function bytesDePdfDeNotaVenta(
  datos: DatosDePdfNotaVenta,
): Uint8Array {
  const fecha = datos.emitidoEn.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
  })
  const cliente =
    datos.cliente !== null && datos.cliente.trim() !== ''
      ? datos.cliente.trim()
      : 'Cliente eventual'

  const filas = datos.lineas.map((linea) => {
    const cantidad = Number.isInteger(linea.cantidad)
      ? String(linea.cantidad)
      : String(linea.cantidad)
    return `${cantidad}  ${linea.descripcion}  ${formatearImporte(linea.importe)}`
  })

  let contenido = 'BT\n'
  contenido += '/F1 24 Tf\n50 780 Td\n'
  contenido += lineaDeTexto('NOTA DE VENTA')
  contenido += '/F1 11 Tf\n0 -28 Td\n14 TL\n'
  contenido += lineaDeTexto(fecha)
  contenido += lineaDeTexto(`Cliente: ${cliente}`)
  contenido += lineaDeTexto('')
  contenido += lineaDeTexto('Cant.  Producto  Importe')
  if (filas.length === 0) {
    contenido += lineaDeTexto('(sin productos)')
  } else {
    for (const fila of filas) contenido += lineaDeTexto(fila)
  }
  contenido += lineaDeTexto('')
  contenido += lineaDeTexto(`Total  ${formatearImporte(datos.total)}`)
  contenido += 'ET\n'

  const stream = `<< /Length ${contenido.length} >>\nstream\n${contenido}endstream`

  const objetos = [
    objeto(1, '<< /Type /Catalog /Pages 2 0 R >>'),
    objeto(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    objeto(
      3,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    ),
    objeto(4, stream),
    objeto(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
  ]

  let cuerpo = '%PDF-1.4\n'
  const offsets = [0]
  for (const cada of objetos) {
    offsets.push(cuerpo.length)
    cuerpo += cada
  }
  const startxref = cuerpo.length
  let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  cuerpo += xref
  cuerpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`

  return new TextEncoder().encode(cuerpo)
}
