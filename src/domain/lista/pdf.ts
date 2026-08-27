import { etiquetaDeUrgencia } from './urgencia.ts'
import type { LineaDeRequerimiento } from './tipos.ts'

/**
 * PDF mínimo (Helvetica / WinAnsi) para la lista de requerimiento.
 * Sin proveedor de emisión: es un documento interno, no un comprobante.
 */

function escaparLiteral(texto: string): string {
  let out = ''
  for (const ch of texto) {
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

export function bytesDePdfDeRequerimiento(
  lineas: readonly LineaDeRequerimiento[],
  generadoEn: Date,
): Uint8Array {
  const titulo = 'Lista de requerimiento'
  const fecha = generadoEn.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
  })

  const filas = lineas.map(
    (linea, indice) =>
      `${indice + 1}  ${linea.descripcion}  ${linea.cantidad}  ${etiquetaDeUrgencia(linea.urgencia)}`,
  )

  const lineasDeTexto = [titulo, fecha, '', 'N  Producto  Cant.  Urgencia', ...filas]
  if (filas.length === 0) {
    lineasDeTexto.push('(sin productos)')
  }

  let contenido = 'BT\n/F1 12 Tf\n50 800 Td\n14 TL\n'
  for (const linea of lineasDeTexto) {
    contenido += `(${escaparLiteral(linea)}) '\n`
  }
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
