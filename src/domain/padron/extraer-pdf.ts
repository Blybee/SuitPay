import { definePDFJSModule, getDocumentProxy } from 'unpdf'
import type { ItemDeTexto, PaginaDeTexto } from './tipos.ts'

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
 * Una página tras otra. `extractTextItems` de unpdf abre todas a la vez y
 * en un PDF de cientos de páginas eso agota la memoria.
 */
export async function extraerPaginas(
  bytes: Uint8Array,
  alPagina?: (pagina: number, total: number) => Promise<void> | void,
): Promise<readonly PaginaDeTexto[]> {
  if (bytes.byteLength < 8) {
    throw new Error('pdf_ilegible')
  }

  // pdf.js puede desprender el ArrayBuffer. La copia deja el original reusable.
  const copia = new Uint8Array(bytes)

  await definePDFJSModule(() => import('unpdf/pdfjs'))

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>
  try {
    pdf = await getDocumentProxy(copia)
  } catch {
    throw new Error('pdf_ilegible')
  }

  try {
    const total = pdf.numPages
    const paginas: PaginaDeTexto[] = []
    for (let n = 1; n <= total; n += 1) {
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
        paginas.push({ items })
      } finally {
        pagina.cleanup()
      }
      if (alPagina !== undefined) await alPagina(n, total)
    }
    return paginas
  } finally {
    await pdf.loadingTask.destroy()
  }
}
