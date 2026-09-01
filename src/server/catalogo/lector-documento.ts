import { definePDFJSModule, getDocumentProxy } from 'unpdf'
import { fallar } from '../errores.ts'
import type { ProductoDeCatalogo } from './tipos.ts'

/**
 * Interpretación determinista de la lista de precios en PDF (T078 / decisión 13).
 *
 * Coordenadas (`str`, `x`, `y`) con el PDF.js empaquetado de `unpdf`. Las reglas
 * de columnas viven aquí. No hay LLM: códigos y precios no pueden alucinarse.
 *
 * No usamos `extractTextItems`: abre todas las páginas en paralelo (`Promise.all`)
 * y en Cloud Run (512–1024 MiB) eso tumba el proceso. La lista SICO ronda 150
 * páginas. El import explícito de `unpdf/pdfjs` es para que Nitro lo tracee en
 * el bundle de producción (dentro de `node_modules` el dinámico no siempre entra).
 */

const TOLERANCIA_Y = 3
const X_FIN_CODIGO = 130
const X_FIN_PRODUCTO = 470
const X_FIN_UM = 540
const X_FIN_PRECIO = 612

const MAPA_UNIDAD: Readonly<Record<string, string>> = {
  UND: 'NIU',
  UNID: 'NIU',
  UNIDAD: 'NIU',
  JUEGO: 'NIU',
  KIT: 'NIU',
  PAR: 'NIU',
  PAQUT: 'BX',
  PQT: 'BX',
  PAQ: 'BX',
  MIL: 'BX',
  BX100: 'BX',
  KGM: 'KGM',
  KG: 'KGM',
  MTR: 'MTR',
  LTR: 'LTR',
  BJ: 'BJ',
  BX: 'BX',
  NIU: 'NIU',
  ZZ: 'ZZ',
}

const PRECIO = /^\d{1,6}\.\d{2,4}$/
const LINEA = /^LINEA:\s*\d+\s*-\s*(.+)$/i
const TIPO = /^TIPO:/i

export interface ResultadoDeInterpretarDocumento {
  readonly filas: readonly ProductoDeCatalogo[]
  readonly reconocidos: number
  readonly omitidos: number
}

interface ItemDeTexto {
  readonly str: string
  readonly x: number
  readonly y: number
}

export function mapearUnidadDeLista(um: string): string {
  const clave = um.trim().toUpperCase()
  return MAPA_UNIDAD[clave] ?? clave
}

export function precioListaACentimos(texto: string): number {
  const n = Number.parseFloat(texto.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

export function bytesDesdeBase64(texto: string): Uint8Array {
  const coma = texto.indexOf(',')
  const limpio = coma >= 0 ? texto.slice(coma + 1) : texto
  const buf = Buffer.from(limpio, 'base64')
  if (buf.byteLength < 8) {
    fallar('archivo_no_interpretable', { motivo: 'pdf_vacio' })
  }
  return new Uint8Array(buf)
}

export async function interpretarDocumentoDeCatalogo(
  bytes: Uint8Array,
): Promise<ResultadoDeInterpretarDocumento> {
  if (bytes.byteLength < 8) {
    fallar('archivo_no_interpretable', { motivo: 'pdf_vacio' })
  }

  let itemsPorPagina: readonly (readonly ItemDeTexto[])[]
  try {
    itemsPorPagina = await extraerItemsPorPagina(bytes)
  } catch {
    fallar('archivo_no_interpretable', { motivo: 'pdf_ilegible' })
  }

  const productos: ProductoDeCatalogo[] = []
  let omitidos = 0
  let marca = ''

  for (const items of itemsPorPagina) {
    for (const fila of agruparPorFila(items)) {
      const texto = fila.map((i) => i.str).join(' ')
      const linea = texto.match(LINEA)
      if (linea) {
        marca = (linea[1] ?? '').trim()
        omitidos += 1
        continue
      }
      if (TIPO.test(texto) || esCabeceraORuido(texto)) {
        omitidos += 1
        continue
      }

      const producto = filaAProducto(fila, marca)
      if (producto === null) {
        omitidos += 1
        continue
      }
      productos.push(producto)
    }
  }

  if (productos.length === 0) {
    fallar('archivo_no_interpretable', { motivo: 'sin_columnas_reconocibles' })
  }

  return {
    filas: productos,
    reconocidos: productos.length,
    omitidos,
  }
}

function esItemDeTexto(item: unknown): item is {
  readonly str: string
  readonly transform: readonly number[]
} {
  if (typeof item !== 'object' || item === null) return false
  if (!('str' in item) || typeof item.str !== 'string') return false
  if (!('transform' in item) || !Array.isArray(item.transform)) return false
  return true
}

/**
 * Una página tras otra. `extractTextItems` de unpdf hace fan-out de todas.
 */
async function extraerItemsPorPagina(
  bytes: Uint8Array,
): Promise<readonly (readonly ItemDeTexto[])[]> {
  await definePDFJSModule(() => import('unpdf/pdfjs'))
  const pdf = await getDocumentProxy(bytes)
  try {
    const paginas: ItemDeTexto[][] = []
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const pagina = await pdf.getPage(n)
      try {
        const contenido = await pagina.getTextContent()
        const items: ItemDeTexto[] = []
        for (const crudo of contenido.items) {
          if (!esItemDeTexto(crudo)) continue
          const str = crudo.str.trim()
          if (str.length === 0) continue
          const x = crudo.transform[4]
          const y = crudo.transform[5]
          items.push({
            str,
            x: typeof x === 'number' ? x : 0,
            y: typeof y === 'number' ? y : 0,
          })
        }
        paginas.push(items)
      } finally {
        pagina.cleanup()
      }
    }
    return paginas
  } finally {
    await pdf.loadingTask.destroy()
  }
}

function agruparPorFila(items: readonly ItemDeTexto[]): ItemDeTexto[][] {
  const ordenados = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const filas: ItemDeTexto[][] = []
  for (const item of ordenados) {
    const ultima = filas[filas.length - 1]
    const ancla = ultima?.[0]
    if (
      ultima !== undefined &&
      ancla !== undefined &&
      Math.abs(ancla.y - item.y) <= TOLERANCIA_Y
    ) {
      ultima.push(item)
    } else {
      filas.push([item])
    }
  }
  for (const fila of filas) {
    fila.sort((a, b) => a.x - b.x)
  }
  return filas
}

function esCabeceraORuido(texto: string): boolean {
  const t = texto.toUpperCase()
  if (t.includes('CODIGO') && t.includes('U.M.')) return true
  if (t.includes('LISTA DE PRECIOS')) return true
  if (t.startsWith('FECHA:') || t.startsWith('HORA:') || t.startsWith('PAGINA:')) {
    return true
  }
  if (t.startsWith('R.U.C.') || t.startsWith('DISTRIBUIDORA')) return true
  if (t === 'PUBLICO' || t === 'SOLES' || t === 'PRECIO' || t === 'S/') return true
  return false
}

function textoEnBanda(
  fila: readonly ItemDeTexto[],
  desde: number,
  hasta: number,
): string {
  return fila
    .filter((i) => i.x >= desde && i.x < hasta)
    .map((i) => i.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function filaAProducto(
  fila: readonly ItemDeTexto[],
  marca: string,
): ProductoDeCatalogo | null {
  const codigo = textoEnBanda(fila, 0, X_FIN_CODIGO)
  const descripcion = textoEnBanda(fila, X_FIN_CODIGO, X_FIN_PRODUCTO)
  const umCruda = textoEnBanda(fila, X_FIN_PRODUCTO, X_FIN_UM)
  const precioCrudo = textoEnBanda(fila, X_FIN_UM, X_FIN_PRECIO)

  if (!PRECIO.test(precioCrudo) || codigo.length === 0 || descripcion.length === 0) {
    return null
  }
  if (LINEA.test(codigo) || TIPO.test(codigo)) return null

  return {
    codigo: codigo.slice(0, 40),
    descripcion: descripcion.slice(0, 300),
    unidad: mapearUnidadDeLista(umCruda),
    precio: precioListaACentimos(precioCrudo),
    activo: true,
    marca: marca.slice(0, 120),
  }
}
