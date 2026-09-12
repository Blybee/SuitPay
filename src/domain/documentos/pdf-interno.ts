import { formatearImporte } from '../totales/calculo.ts'
import type { Centimos } from '../totales/calculo.ts'
import { EMISOR_INTERNO } from './emisor-interno.ts'

export type ClaseDePdfInterno = 'cotizacion' | 'nota_venta'

export interface LineaDePdfInterno {
  readonly codigo: string
  readonly descripcion: string
  readonly cantidad: number
  readonly precio: Centimos
  readonly importe: Centimos
}

export interface DatosDePdfInterno {
  readonly clase: ClaseDePdfInterno
  readonly emitidoEn: Date
  readonly numero: number | null
  readonly cliente: string | null
  readonly lineas: readonly LineaDePdfInterno[]
  readonly total: Centimos
}

const ANCHO_PAGINA = 595
const ALTO_PAGINA = 842
const MARGEN_X = 40
const MARGEN_DERECHO = 555
const MARGEN_INFERIOR = 50
const CENTRO = ANCHO_PAGINA / 2

const COL_CODIGO = 40
const COL_DESC = 108
const ANCHO_CODIGO = 64
const ANCHO_DESC = 258
const COL_CANT_IZQ = 374
const COL_CANT_DER = 439
const COL_PRECIO_DER = 497
const COL_TOTAL_DER = 555

/** Anchos de celda (pt). PRECIO/TOTAL compactos; el margen derecho 555 no se mueve. */
export const LAYOUT_COLUMNAS_PDF_INTERNO = {
  codigo: COL_DESC - COL_CODIGO,
  descripcion: COL_CANT_IZQ - COL_DESC,
  cantidad: COL_CANT_DER - COL_CANT_IZQ,
  precio: COL_PRECIO_DER - COL_CANT_DER,
  total: COL_TOTAL_DER - COL_PRECIO_DER,
  margenDerecho: COL_TOTAL_DER,
} as const

const CELDAS_ENCABEZADO: readonly { readonly x: number; readonly w: number }[] =
  [
    { x: COL_CODIGO, w: COL_DESC - COL_CODIGO },
    { x: COL_DESC, w: COL_CANT_IZQ - COL_DESC },
    { x: COL_CANT_IZQ, w: COL_CANT_DER - COL_CANT_IZQ },
    { x: COL_CANT_DER, w: COL_PRECIO_DER - COL_CANT_DER },
    { x: COL_PRECIO_DER, w: COL_TOTAL_DER - COL_PRECIO_DER },
  ]

const TAMANO_RAZON = 13
const TAMANO_EMISOR = 9
const TAMANO_TITULO = 14
const TAMANO_CUERPO = 9
const INTERLINEADO = 12
const ALTO_CELDA = 16
const PAD_CELDA = 4
const ASCENSO_FILA = 8
const DESCENSO_FILA = 4

/** `--color-mesa` #f9fafb: zebra de filas impares (índice 1, 3…). */
const GRIS_MESA = '0.976 0.980 0.984'
/** `--color-borde` #e5e7eb. */
const GRIS_BORDE = '0.898 0.906 0.922'

/**
 * Anchos de Helvetica (WinAnsi 32–126) en milésimas de em.
 */
const ANCHOS_HELVETICA: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
]

const ANCHOS_HELVETICA_BOLD: readonly number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
  584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
  278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
  556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
  500, 389, 280, 389, 584,
]

type FuentePdf = '/F1' | '/F2'

function asciiParaPdf(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

function anchosDe(fuente: FuentePdf): readonly number[] {
  return fuente === '/F2' ? ANCHOS_HELVETICA_BOLD : ANCHOS_HELVETICA
}

function anchoDe(texto: string, tamano: number, fuente: FuentePdf): number {
  const plano = asciiParaPdf(texto)
  const tabla = anchosDe(fuente)
  let unidades = 0
  for (const ch of plano) {
    const codigo = ch.codePointAt(0) ?? 63
    if (codigo >= 32 && codigo <= 126) {
      unidades += tabla[codigo - 32] ?? 600
    } else {
      unidades += 600
    }
  }
  return (unidades * tamano) / 1000
}

function objeto(id: number, cuerpo: string): string {
  return `${id} 0 obj\n${cuerpo}\nendobj\n`
}

function textoEn(
  x: number,
  y: number,
  texto: string,
  tamano: number,
  fuente: FuentePdf = '/F1',
): string {
  return `BT\n${fuente} ${tamano} Tf\n1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm\n(${escaparLiteral(texto)}) Tj\nET\n`
}

function textoDerecha(
  xDerecha: number,
  y: number,
  texto: string,
  tamano: number,
  fuente: FuentePdf = '/F1',
): string {
  const x = xDerecha - anchoDe(texto, tamano, fuente)
  return textoEn(Math.max(MARGEN_X, x), y, texto, tamano, fuente)
}

function ajustar(
  texto: string,
  anchoMax: number,
  tamano: number,
  fuente: FuentePdf = '/F1',
): string {
  const plano = asciiParaPdf(texto)
  if (anchoDe(plano, tamano, fuente) <= anchoMax) return plano
  const puntos = '...'
  let cortado = plano
  while (
    cortado.length > 0 &&
    anchoDe(`${cortado}${puntos}`, tamano, fuente) > anchoMax
  ) {
    cortado = cortado.slice(0, -1)
  }
  return `${cortado}${puntos}`
}

function partirLinea(
  texto: string,
  anchoMax: number,
  tamano: number,
): string[] {
  const plano = asciiParaPdf(texto).trim()
  if (plano === '') return ['']
  const palabras = plano.split(/\s+/)
  const lineas: string[] = []
  let actual = ''
  for (const palabra of palabras) {
    const prueba = actual === '' ? palabra : `${actual} ${palabra}`
    if (anchoDe(prueba, tamano, '/F1') <= anchoMax) {
      actual = prueba
      continue
    }
    if (actual !== '') lineas.push(actual)
    if (anchoDe(palabra, tamano, '/F1') <= anchoMax) {
      actual = palabra
    } else {
      lineas.push(ajustar(palabra, anchoMax, tamano))
      actual = ''
    }
  }
  if (actual !== '') lineas.push(actual)
  return lineas.length > 0 ? lineas : ['']
}

function formatearCantidad(cantidad: number): string {
  return Number.isInteger(cantidad) ? String(cantidad) : String(cantidad)
}

export function correlativoInterno(numero: number | null): string {
  return String(numero ?? 0).padStart(10, '0')
}

function franjaDeFila(
  yBase: number,
  renglones: number,
): { readonly y: number; readonly h: number } {
  const yArriba = yBase + ASCENSO_FILA
  const yAbajo = yBase - (renglones - 1) * INTERLINEADO - DESCENSO_FILA
  return { y: yAbajo, h: yArriba - yAbajo }
}

function rectangulo(
  x: number,
  y: number,
  w: number,
  h: number,
  modo: 'stroke' | 'fill',
): string {
  const path = `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re\n`
  if (modo === 'fill') {
    return `q\n${GRIS_MESA} rg\n${path}f\nQ\n`
  }
  return `q\n${GRIS_BORDE} RG\n0.6 w\n${path}S\nQ\n`
}

function dibujarTitulo(
  y: number,
  clase: ClaseDePdfInterno,
  numero: number | null,
): string {
  const palabras = clase === 'cotizacion' ? 'COTIZACIÓN' : 'NOTA DE VENTA'
  const resto = ` N° ${correlativoInterno(numero)}`
  const wPalabras = anchoDe(palabras, TAMANO_TITULO, '/F2')
  const wResto = anchoDe(resto, TAMANO_TITULO, '/F1')
  const x = CENTRO - (wPalabras + wResto) / 2
  return (
    textoEn(x, y, palabras, TAMANO_TITULO, '/F2') +
    textoEn(x + wPalabras, y, resto, TAMANO_TITULO, '/F1')
  )
}

function dibujarCabeceraColumnas(y: number): string {
  const yRect = y - PAD_CELDA
  let out = ''
  for (const celda of CELDAS_ENCABEZADO) {
    out += rectangulo(celda.x, yRect, celda.w, ALTO_CELDA, 'stroke')
  }
  out += textoEn(COL_CODIGO + 3, y, 'CODIGO', TAMANO_CUERPO, '/F2')
  out += textoEn(COL_DESC + 3, y, 'DESCRIPCIÓN', TAMANO_CUERPO, '/F2')
  out += textoDerecha(COL_CANT_DER - 3, y, 'CANTIDAD', TAMANO_CUERPO, '/F2')
  out += textoDerecha(COL_PRECIO_DER - 3, y, 'PRECIO', TAMANO_CUERPO, '/F2')
  out += textoDerecha(COL_TOTAL_DER - 3, y, 'TOTAL', TAMANO_CUERPO, '/F2')
  return out
}

function dibujarEncabezadoComercial(
  fecha: string,
  clase: ClaseDePdfInterno,
  numero: number | null,
  cliente: string,
): { readonly contenido: string; readonly y: number } {
  let y = 802
  let contenido = textoEn(
    MARGEN_X,
    y,
    EMISOR_INTERNO.razonSocial,
    TAMANO_RAZON,
    '/F2',
  )
  contenido += textoDerecha(
    MARGEN_DERECHO,
    y,
    `FECHA: ${fecha}`,
    TAMANO_EMISOR,
  )
  y -= 16
  contenido += textoEn(MARGEN_X, y, EMISOR_INTERNO.direccion, TAMANO_EMISOR)
  y -= INTERLINEADO
  contenido += textoEn(MARGEN_X, y, EMISOR_INTERNO.ruc, TAMANO_EMISOR)
  y -= 28
  contenido += dibujarTitulo(y, clase, numero)
  y -= 24
  contenido += textoEn(MARGEN_X, y, `CLIENTE: ${cliente}`, TAMANO_CUERPO)
  y -= 22
  contenido += dibujarCabeceraColumnas(y)
  y -= ALTO_CELDA
  return { contenido, y }
}

function dibujarTotal(y: number, total: Centimos): string {
  const etiqueta = `TOTAL: ${formatearImporte(total)}`
  const pad = 6
  const wTexto = anchoDe(etiqueta, TAMANO_CUERPO, '/F1')
  const wCelda = wTexto + pad * 2
  const xCelda = COL_TOTAL_DER - wCelda
  const yRect = y - PAD_CELDA
  return (
    rectangulo(xCelda, yRect, wCelda, ALTO_CELDA, 'stroke') +
    textoEn(xCelda + pad, y, etiqueta, TAMANO_CUERPO)
  )
}

/**
 * PDF A4 de documento interno (Helvetica / WinAnsi).
 * Cotización y nota de venta comparten plantilla; no hay leyenda tributaria.
 */
export function bytesDePdfInterno(datos: DatosDePdfInterno): Uint8Array {
  const fecha = datos.emitidoEn.toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
  })
  const cliente =
    datos.cliente !== null && datos.cliente.trim() !== ''
      ? datos.cliente.trim()
      : 'Cliente eventual'

  const paginas: string[] = []
  let pagina = ''
  let y = 0
  let primera = true

  function empezarPagina(): void {
    if (primera) {
      const encabezado = dibujarEncabezadoComercial(
        fecha,
        datos.clase,
        datos.numero,
        cliente,
      )
      pagina = encabezado.contenido
      y = encabezado.y
      primera = false
      return
    }
    y = 802
    pagina = dibujarCabeceraColumnas(y)
    y -= ALTO_CELDA
  }

  function cerrarPagina(): void {
    paginas.push(pagina)
    pagina = ''
  }

  empezarPagina()

  const filas =
    datos.lineas.length === 0
      ? [
          {
            codigo: '',
            descripcion: '(sin productos)',
            cantidad: '',
            precio: '',
            importe: '',
            renglones: ['(sin productos)'],
          },
        ]
      : datos.lineas.map((linea) => {
          const renglones = partirLinea(
            linea.descripcion,
            ANCHO_DESC,
            TAMANO_CUERPO,
          )
          return {
            codigo: ajustar(linea.codigo, ANCHO_CODIGO, TAMANO_CUERPO),
            descripcion: linea.descripcion,
            cantidad: formatearCantidad(linea.cantidad),
            precio: formatearImporte(linea.precio),
            importe: formatearImporte(linea.importe),
            renglones,
          }
        })

  filas.forEach((fila, indice) => {
    const alto = fila.renglones.length * INTERLINEADO
    if (y - alto < MARGEN_INFERIOR + INTERLINEADO * 2) {
      cerrarPagina()
      empezarPagina()
    }
    if (indice % 2 === 1) {
      const franja = franjaDeFila(y, fila.renglones.length)
      pagina += rectangulo(
        MARGEN_X,
        franja.y,
        MARGEN_DERECHO - MARGEN_X,
        franja.h,
        'fill',
      )
    }
    pagina += textoEn(COL_CODIGO, y, fila.codigo, TAMANO_CUERPO)
    pagina += textoDerecha(COL_CANT_DER, y, fila.cantidad, TAMANO_CUERPO)
    pagina += textoDerecha(COL_PRECIO_DER, y, fila.precio, TAMANO_CUERPO)
    pagina += textoDerecha(COL_TOTAL_DER, y, fila.importe, TAMANO_CUERPO)
    for (const renglon of fila.renglones) {
      pagina += textoEn(COL_DESC, y, renglon, TAMANO_CUERPO)
      y -= INTERLINEADO
    }
  })

  if (y < MARGEN_INFERIOR + INTERLINEADO) {
    cerrarPagina()
    empezarPagina()
  }
  y -= 6
  pagina += dibujarTotal(y, datos.total)
  cerrarPagina()

  const objetos: string[] = [objeto(1, '<< /Type /Catalog /Pages 2 0 R >>')]
  const kids = paginas.map((_, indice) => `${5 + indice * 2} 0 R`).join(' ')
  objetos.push(
    objeto(2, `<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>`),
  )
  objetos.push(
    objeto(
      3,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    ),
  )
  objetos.push(
    objeto(
      4,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ),
  )
  for (let i = 0; i < paginas.length; i += 1) {
    const pageId = 5 + i * 2
    const contentId = 6 + i * 2
    const contenido = paginas[i] ?? ''
    objetos.push(
      objeto(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO_PAGINA} ${ALTO_PAGINA}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
      ),
    )
    objetos.push(
      objeto(
        contentId,
        `<< /Length ${contenido.length} >>\nstream\n${contenido}endstream`,
      ),
    )
  }

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
