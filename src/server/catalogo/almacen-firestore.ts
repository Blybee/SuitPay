import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import {
  esquemaDeCategoria,
  esquemaDeProducto,
} from '../../domain/esquemas/comunes.ts'
import { COLECCIONES, bd } from '../firebase/admin.ts'
import type { AlmacenDeCatalogo } from './almacen.ts'
import type {
  CatalogoPublicado,
  CategoriaDeCatalogo,
  ProductoDeCatalogo,
} from './tipos.ts'

/**
 * Una sola escritura sobre `catalogo/actual`. No hay una escritura por producto.
 */

export class AlmacenDeCatalogoFirestore implements AlmacenDeCatalogo {
  constructor(private readonly base = bd()) {}

  async leerPublicado(): Promise<CatalogoPublicado | null> {
    const instantanea = await this.base
      .collection(COLECCIONES.catalogo)
      .doc('actual')
      .get()

    if (!instantanea.exists) return null
    const datos = instantanea.data() ?? {}
    const productos = hidratarProductos(datos['productos'])
    const categorias = hidratarCategorias(datos['categorias'])
    const publicadoEn = datos['publicadoEn']
    return {
      version: typeof datos['version'] === 'number' ? datos['version'] : 0,
      publicadoEn:
        publicadoEn instanceof Timestamp
          ? publicadoEn.toDate()
          : new Date(0),
      publicadoPor:
        typeof datos['publicadoPor'] === 'string' ? datos['publicadoPor'] : '',
      totalProductos:
        typeof datos['totalProductos'] === 'number'
          ? datos['totalProductos']
          : productos.length,
      productos,
      categorias,
    }
  }

  async publicar(entrada: {
    readonly productos: readonly ProductoDeCatalogo[]
    readonly categorias: readonly CategoriaDeCatalogo[]
    readonly publicadoPor: string
    readonly momento: Date
  }): Promise<CatalogoPublicado> {
    const referencia = this.base.collection(COLECCIONES.catalogo).doc('actual')

    const publicado = await this.base.runTransaction(async (tx) => {
      const actual = await tx.get(referencia)
      const versionPrevia =
        typeof actual.data()?.['version'] === 'number'
          ? (actual.data()?.['version'] as number)
          : 0
      const version = versionPrevia + 1
      const documento: CatalogoPublicado = {
        version,
        publicadoEn: entrada.momento,
        publicadoPor: entrada.publicadoPor,
        totalProductos: entrada.productos.length,
        productos: [...entrada.productos],
        categorias: [...entrada.categorias],
      }
      tx.set(referencia, {
        version: documento.version,
        publicadoEn: Timestamp.fromDate(entrada.momento),
        publicadoPor: documento.publicadoPor,
        totalProductos: documento.totalProductos,
        productos: documento.productos,
        categorias: documento.categorias,
        actualizadoEn: FieldValue.serverTimestamp(),
      })
      return documento
    })

    return publicado
  }
}

function hidratarProductos(bruto: unknown): ProductoDeCatalogo[] {
  if (!Array.isArray(bruto)) return []
  const productos: ProductoDeCatalogo[] = []
  for (const entrada of bruto) {
    const parseado = esquemaDeProducto.safeParse(entrada)
    if (parseado.success) productos.push(parseado.data)
  }
  return productos
}

function hidratarCategorias(bruto: unknown): CategoriaDeCatalogo[] {
  if (!Array.isArray(bruto)) return []
  const categorias: CategoriaDeCatalogo[] = []
  for (const entrada of bruto) {
    const parseado = esquemaDeCategoria.safeParse(entrada)
    if (parseado.success) categorias.push(parseado.data)
  }
  return categorias
}
