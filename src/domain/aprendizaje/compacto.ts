/**
 * Catálogo compacto para asistencia (constitución IV v1.3.0).
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
  readonly marca?: string
  readonly familia?: string
}

export interface ItemCatalogoCompacto {
  readonly id: string
  readonly n: string
  readonly m: string
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
        m: (p.marca ?? '').trim(),
        a: entrada?.aliases ?? [],
        e: entrada?.etiquetas ?? [],
      }
    })
}

export function anonimizarNotas(
  notas: readonly string[],
): readonly string[] {
  return notas
    .map((nota) => anonimizarTexto(nota))
    .filter((nota) => nota.length > 0)
}

/** Quita dígitos de documento (8–11) de un texto suelto. */
export function anonimizarTexto(valor: string): string {
  return valor.replace(/\b\d{8,11}\b/g, '[doc]').trim()
}
