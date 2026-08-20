import type { AlmacenDeCatalogo } from './almacen.ts'
import type {
  CatalogoPublicado,
  CategoriaDeCatalogo,
  ProductoDeCatalogo,
} from './tipos.ts'

/** Almacén en memoria para pruebas unitarias de importación. */
export class AlmacenDeCatalogoEnMemoria implements AlmacenDeCatalogo {
  private publicado: CatalogoPublicado | null = null

  constructor(inicial: CatalogoPublicado | null = null) {
    this.publicado = inicial
  }

  async leerPublicado(): Promise<CatalogoPublicado | null> {
    return this.publicado
  }

  async publicar(entrada: {
    readonly productos: readonly ProductoDeCatalogo[]
    readonly categorias: readonly CategoriaDeCatalogo[]
    readonly publicadoPor: string
    readonly momento: Date
  }): Promise<CatalogoPublicado> {
    const version = (this.publicado?.version ?? 0) + 1
    this.publicado = {
      version,
      publicadoEn: entrada.momento,
      publicadoPor: entrada.publicadoPor,
      totalProductos: entrada.productos.length,
      productos: [...entrada.productos],
      categorias: [...entrada.categorias],
    }
    return this.publicado
  }

  /** Solo para aserciones en pruebas. */
  get actual(): CatalogoPublicado | null {
    return this.publicado
  }
}
