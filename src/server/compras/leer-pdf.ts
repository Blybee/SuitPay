import { definePDFJSModule, getDocumentProxy } from 'unpdf'
import {
  crudoDesdeOrdenes,
  leerOrdenDeItems,
} from '../../domain/compras/leer-orden.ts'
import type {
  ItemDeOrden,
  OrdenLeida,
} from '../../domain/compras/leer-orden.ts'

export async function ordenesDeMedios(
  medios: readonly { readonly mimeType: string; readonly dataBase64: string }[],
): Promise<readonly OrdenLeida[]> {
  const ordenes: OrdenLeida[] = []
  for (let indice = 0; indice < medios.length; indice += 1) {
    const medio = medios[indice]
    if (medio === undefined || medio.mimeType !== 'application/pdf') continue
    const leida = await ordenDePdf(bytesDeBase64(medio.dataBase64))
    if (leida !== null) ordenes.push({ ...leida, grupo: indice })
  }
  return ordenes
}

export function crudoDeOrdenes(ordenes: readonly OrdenLeida[]) {
  return crudoDesdeOrdenes(ordenes)
}

async function ordenDePdf(bytes: Uint8Array): Promise<OrdenLeida | null> {
  const items = await itemsDePdf(bytes)
  if (items.length === 0) return null
  return leerOrdenDeItems(items)
}

function bytesDeBase64(data: string): Uint8Array {
  const limpio = data.replace(/\s/g, '')
  return new Uint8Array(Buffer.from(limpio, 'base64'))
}

async function itemsDePdf(bytes: Uint8Array): Promise<ItemDeOrden[]> {
  await definePDFJSModule(() => import('unpdf/pdfjs'))
  const pdf = await getDocumentProxy(bytes)
  try {
    const items: ItemDeOrden[] = []
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const pagina = await pdf.getPage(n)
      try {
        const contenido = await pagina.getTextContent()
        for (const crudo of contenido.items) {
          if (!esItem(crudo)) continue
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
      } finally {
        pagina.cleanup()
      }
    }
    return items
  } finally {
    await pdf.loadingTask.destroy()
  }
}

function esItem(item: unknown): item is {
  readonly str: string
  readonly transform: readonly number[]
} {
  if (typeof item !== 'object' || item === null) return false
  if (!('str' in item) || typeof item.str !== 'string') return false
  if (!('transform' in item) || !Array.isArray(item.transform)) return false
  return true
}
