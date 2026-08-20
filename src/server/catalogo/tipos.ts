import type {
  CategoriaDeCatalogo,
  Producto,
} from '../../domain/esquemas/comunes.ts'

/**
 * Tipos del catálogo en el servidor. El producto publicado es el mismo esquema
 * del dominio: código, descripción, unidad, precio, activo, marca, categoriaId.
 */

export type ProductoDeCatalogo = Producto
export type { CategoriaDeCatalogo }

export type ModoDeImportacion = 'validar' | 'publicar'

export type TipoDeConflicto =
  | 'codigo_duplicado'
  | 'descripcion_ausente'
  | 'unidad_desconocida'

export interface ConflictoDeImportacion {
  readonly tipo: TipoDeConflicto
  readonly codigo: string
  readonly detalle: string
}

export interface DiferenciasDeCatalogo {
  readonly nuevos: readonly ProductoDeCatalogo[]
  readonly cambiados: readonly {
    readonly anterior: ProductoDeCatalogo
    readonly siguiente: ProductoDeCatalogo
  }[]
  readonly desaparecidos: readonly ProductoDeCatalogo[]
}

export interface ResumenDeImportacion {
  readonly reconocidos: number
  readonly conflictos: readonly ConflictoDeImportacion[]
  readonly diferencias: DiferenciasDeCatalogo | null
  /** Presente solo tras `publicar`. */
  readonly version: number | null
  readonly publicado: boolean
  /** Filas propuestas (para la grilla de revisión; no se escriben en validar). */
  readonly propuestos: readonly ProductoDeCatalogo[]
  readonly categorias: readonly CategoriaDeCatalogo[]
}

export interface CatalogoPublicado {
  readonly version: number
  readonly publicadoEn: Date
  readonly publicadoPor: string
  readonly totalProductos: number
  readonly productos: readonly ProductoDeCatalogo[]
  readonly categorias: readonly CategoriaDeCatalogo[]
}
