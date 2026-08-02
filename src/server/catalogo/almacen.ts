import type { CatalogoPublicado, ProductoDeCatalogo } from './tipos.ts'

/**
 * Persistencia del catálogo publicado. Una sola escritura por publicación
 * (decisión 2 de research.md / data-model.md).
 */

export interface AlmacenDeCatalogo {
  leerPublicado: () => Promise<CatalogoPublicado | null>
  publicar: (entrada: {
    readonly productos: readonly ProductoDeCatalogo[]
    readonly publicadoPor: string
    readonly momento: Date
  }) => Promise<CatalogoPublicado>
}
