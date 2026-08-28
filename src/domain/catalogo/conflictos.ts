/**
 * Conflictos de una carga de catálogo. El parser mapea alias de unidad; lo que
 * queda aquí no se resuelve solo (FR-010). Vive en dominio para que la grilla
 * lo recalcule al editar, sin importar `src/server`.
 */

export type TipoDeConflicto =
  | 'codigo_duplicado'
  | 'descripcion_ausente'
  | 'unidad_desconocida'

export interface ConflictoDeImportacion {
  readonly tipo: TipoDeConflicto
  readonly codigo: string
  readonly detalle: string
}

export interface ProductoParaConflictos {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
}

export const UNIDADES_CONOCIDAS = new Set([
  'NIU',
  'ZZ',
  'KGM',
  'MTR',
  'LTR',
  'BJ',
  'BX',
])

export function detectarConflictos(
  productos: readonly ProductoParaConflictos[],
): readonly ConflictoDeImportacion[] {
  const conflictos: ConflictoDeImportacion[] = []
  const vistos = new Map<string, number>()

  for (const producto of productos) {
    const previos = vistos.get(producto.codigo) ?? 0
    vistos.set(producto.codigo, previos + 1)

    if (producto.descripcion.trim().length === 0) {
      conflictos.push({
        tipo: 'descripcion_ausente',
        codigo: producto.codigo,
        detalle: 'La descripción quedó vacía tras interpretar el archivo.',
      })
    }

    if (!UNIDADES_CONOCIDAS.has(producto.unidad)) {
      conflictos.push({
        tipo: 'unidad_desconocida',
        codigo: producto.codigo,
        detalle: `Unidad «${producto.unidad}» no reconocida.`,
      })
    }
  }

  for (const [codigo, veces] of vistos) {
    if (veces > 1) {
      conflictos.push({
        tipo: 'codigo_duplicado',
        codigo,
        detalle: `El código aparece ${veces} veces en la carga.`,
      })
    }
  }

  return conflictos
}

export function hayConflictosBloqueantes(
  conflictos: readonly ConflictoDeImportacion[],
): boolean {
  // Hoy todo TipoDeConflicto bloquea la publicación (FR-010).
  return conflictos.length > 0
}

export function agruparConflictosPorCodigo(
  conflictos: readonly ConflictoDeImportacion[],
): ReadonlyMap<string, readonly ConflictoDeImportacion[]> {
  const mapa = new Map<string, ConflictoDeImportacion[]>()
  for (const conflicto of conflictos) {
    const lista = mapa.get(conflicto.codigo) ?? []
    lista.push(conflicto)
    mapa.set(conflicto.codigo, lista)
  }
  return mapa
}

export function textoDeConflictos(
  conflictos: readonly ConflictoDeImportacion[],
): string {
  return conflictos.map((conflicto) => conflicto.detalle).join(' · ')
}
