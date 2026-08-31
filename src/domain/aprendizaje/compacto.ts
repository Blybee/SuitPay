/**
 * Catálogo compacto para asistencia (constitución IV v1.2.0).
 * Sin precio, stock ni ficha de cliente.
 */

export interface EntradaDeMemoria {
  readonly aliases: readonly string[]
  readonly etiquetas: readonly string[]
}

export interface ProductoParaCompacto {
  readonly codigo: string
  readonly descripcion: string
  readonly activo?: boolean
}

export interface ItemCatalogoCompacto {
  readonly id: string
  readonly n: string
  readonly a: readonly string[]
  readonly e: readonly string[]
}

export function compactarCatalogo(
  productos: readonly ProductoParaCompacto[],
  memoria: Readonly<Record<string, EntradaDeMemoria>>,
): readonly ItemCatalogoCompacto[] {
  return productos
    .filter((p) => p.activo !== false)
    .map((p) => {
      const entrada = memoria[p.codigo]
      return {
        id: p.codigo,
        n: p.descripcion,
        a: entrada?.aliases ?? [],
        e: entrada?.etiquetas ?? [],
      }
    })
}

export function anonimizarNotas(
  notas: readonly string[],
): readonly string[] {
  return notas
    .map((nota) => nota.replace(/\b\d{8,11}\b/g, '[doc]').trim())
    .filter((nota) => nota.length > 0)
}
