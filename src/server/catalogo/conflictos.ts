import type {
  ConflictoDeImportacion,
  ProductoDeCatalogo,
} from './tipos.ts'

/**
 * Detecta conflictos de una carga **sin resolverlos** (FR-010).
 *
 * Los códigos duplicados se informan; no se elige el “mejor” precio ni se
 * fusionan filas. El administrador decide fuera del sistema.
 *
 * Precio 0 no es conflicto bloqueante: la tienda a veces no trae wholesale y
 * se guarda en cero a propósito (el vendedor lo corrige al vender).
 */

const UNIDADES_CONOCIDAS = new Set(['NIU', 'ZZ', 'KGM', 'MTR', 'LTR', 'BJ', 'BX'])

export function detectarConflictos(
  productos: readonly ProductoDeCatalogo[],
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
  return conflictos.some(
    (c) =>
      c.tipo === 'codigo_duplicado' ||
      c.tipo === 'descripcion_ausente' ||
      c.tipo === 'unidad_desconocida',
  )
}
