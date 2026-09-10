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
const ANCHO_DESC = 214
const COL_CANT_DER = 385
const COL_PRECIO_DER = 470
const COL_TOTAL_DER = 555

const TAMANO_EMISOR = 9
const TAMANO_TITULO = 14
const TAMANO_CUERPO = 9
const INTERLINEADO = 12

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

function anchoHelvetica(texto: string, tamano: number): number {
  const plano = asciiParaPdf(texto)
  let unidades = 0
  for (const ch of plano) {
    const codigo = ch.codePointAt(0) ?? 63
    if (codigo >= 32 && codigo <= 126) {
      unidades += ANCHOS_HELVETICA[codigo - 32] ?? 600
    } else {
      unidades += 600
    }
  }
  return (unidades * tamano) / 1000
}

function objeto(id: number, cuerpo: string): string {
  return `${id} 0 obj\n${cuerpo}\nendobj\n`
}

function textoEn(x: number, y: number, texto: string, tamano: number): string {
  return `BT\n/F1 ${tamano} Tf\n1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm\n(${escaparLiteral(texto)}) Tj\nET\n`
}

function textoDerecha(
  xDerecha: number,
  y: number,
  texto: string,
  tamano: number,
): string {
  const x = xDerecha - anchoHelvetica(texto, tamano)
  return textoEn(Math.max(MARGEN_X, x), y, texto, tamano)
}

function textoCentro(
  xCentro: number,
  y: number,
  texto: string,
  tamano: number,
): string {
  const x = xCentro - anchoHelvetica(texto, tamano) / 2
  return textoEn(x, y, texto, tamano)
}

function ajustar(texto: string, anchoMax: number, tamano: number): string {
  const plano = asciiParaPdf(texto)
  if (anchoHelvetica(plano, tamano) <= anchoMax) return plano
  const puntos = '...'
  let cortado = plano
  while (
    cortado.length > 0 &&
    anchoHelvetica(`${cortado}${puntos}`, tamano) > anchoMax
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
    if (anchoHelvetica(prueba, tamano) <= anchoMax) {
      actual = prueba
      continue
    }
    if (actual !== '') lineas.push(actual)
    if (anchoHelvetica(palabra, tamano) <= anchoMax) {
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

function tituloDeClase(clase: ClaseDePdfInterno, numero: number | null): string {
  const correlativo = correlativoInterno(numero)
  return clase === 'cotizacion'
    ? `COTIZACIÓN N° ${correlativo}`
    : `NOTA DE VENTA N° ${correlativo}`
}

function dibujarCabeceraColumnas(y: number): string {
  let out = textoEn(COL_CODIGO, y, 'CODIGO', TAMANO_CUERPO)
  out += textoEn(COL_DESC, y, 'DESCRIPCIÓN', TAMANO_CUERPO)
  out += textoDerecha(COL_CANT_DER, y, 'CANTIDAD', TAMANO_CUERPO)
  out += textoDerecha(COL_PRECIO_DER, y, 'PRECIO', TAMANO_CUERPO)
  out += textoDerecha(COL_TOTAL_DER, y, 'TOTAL', TAMANO_CUERPO)
  return out
}

function dibujarEncabezadoComercial(
  fecha: string,
  titulo: string,
  cliente: string,
): { readonly contenido: string; readonly y: number } {
  let y = 802
  let contenido = textoEn(
    MARGEN_X,
    y,
    EMISOR_INTERNO.razonSocial,
    TAMANO_EMISOR,
  )
  contenido += textoDerecha(
    MARGEN_DERECHO,
    y,
    `FECHA: ${fecha}`,
    TAMANO_EMISOR,
  )
  y -= INTERLINEADO
  contenido += textoEn(MARGEN_X, y, EMISOR_INTERNO.direccion, TAMANO_EMISOR)
  y -= INTERLINEADO
  contenido += textoEn(MARGEN_X, y, EMISOR_INTERNO.ruc, TAMANO_EMISOR)
  y -= 28
  contenido += textoCentro(CENTRO, y, titulo, TAMANO_TITULO)
  y -= 24
  contenido += textoEn(MARGEN_X, y, `CLIENTE: ${cliente}`, TAMANO_CUERPO)
  y -= 20
  contenido += dibujarCabeceraColumnas(y)
  y -= INTERLINEADO
  return { contenido, y }
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
  const titulo = tituloDeClase(datos.clase, datos.numero)

  const paginas: string[] = []
  let pagina = ''
  let y = 0
  let primera = true

  function empezarPagina(): void {
    if (primera) {
      const encabezado = dibujarEncabezadoComercial(fecha, titulo, cliente)
      pagina = encabezado.contenido
      y = encabezado.y
      primera = false
      return
    }
    y = 802
    pagina = dibujarCabeceraColumnas(y)
    y -= INTERLINEADO
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

  for (const fila of filas) {
    const alto = fila.renglones.length * INTERLINEADO
    if (y - alto < MARGEN_INFERIOR + INTERLINEADO * 2) {
      cerrarPagina()
      empezarPagina()
    }
    pagina += textoEn(COL_CODIGO, y, fila.codigo, TAMANO_CUERPO)
    pagina += textoDerecha(COL_CANT_DER, y, fila.cantidad, TAMANO_CUERPO)
    pagina += textoDerecha(COL_PRECIO_DER, y, fila.precio, TAMANO_CUERPO)
    pagina += textoDerecha(COL_TOTAL_DER, y, fila.importe, TAMANO_CUERPO)
    for (const renglon of fila.renglones) {
      pagina += textoEn(COL_DESC, y, renglon, TAMANO_CUERPO)
      y -= INTERLINEADO
    }
  }

  if (y < MARGEN_INFERIOR + INTERLINEADO) {
    cerrarPagina()
    empezarPagina()
  }
  y -= 4
  pagina += textoDerecha(
    COL_TOTAL_DER,
    y,
    `TOTAL: ${formatearImporte(datos.total)}`,
    TAMANO_CUERPO,
  )
  cerrarPagina()

  const objetos: string[] = [
    objeto(1, '<< /Type /Catalog /Pages 2 0 R >>'),
  ]
  const kids = paginas.map((_, indice) => `${4 + indice * 2} 0 R`).join(' ')
  objetos.push(
    objeto(2, `<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>`),
  )
  objetos.push(
    objeto(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
  )
  for (let i = 0; i < paginas.length; i += 1) {
    const pageId = 4 + i * 2
    const contentId = 5 + i * 2
    const contenido = paginas[i] ?? ''
    objetos.push(
      objeto(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO_PAGINA} ${ALTO_PAGINA}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
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
