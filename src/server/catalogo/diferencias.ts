import type {
  DiferenciasDeCatalogo,
  ProductoDeCatalogo,
} from './tipos.ts'

/**
 * Compara la carga propuesta contra el catálogo ya publicado (FR-011).
 *
 * Distingue productos nuevos, cambios (precio, descripción, unidad, activo) y
 * desapariciones. No aplica nada: solo informa para la revisión previa.
 */

export function compararContraPublicado(
  propuesto: readonly ProductoDeCatalogo[],
  publicado: readonly ProductoDeCatalogo[] | null,
): DiferenciasDeCatalogo | null {
  if (publicado === null) return null

  const porCodigo = new Map(publicado.map((p) => [p.codigo, p]))
  const vistos = new Set<string>()

  const nuevos: ProductoDeCatalogo[] = []
  const cambiados: DiferenciasDeCatalogo['cambiados'][number][] = []

  for (const siguiente of propuesto) {
    vistos.add(siguiente.codigo)
    const anterior = porCodigo.get(siguiente.codigo)
    if (anterior === undefined) {
      nuevos.push(siguiente)
      continue
    }
    if (cambioRelevante(anterior, siguiente)) {
      cambiados.push({ anterior, siguiente })
    }
  }

  const desaparecidos = publicado.filter((p) => !vistos.has(p.codigo))

  return { nuevos, cambiados, desaparecidos }
}

function cambioRelevante(
  anterior: ProductoDeCatalogo,
  siguiente: ProductoDeCatalogo,
): boolean {
  return (
    anterior.precio !== siguiente.precio ||
    anterior.descripcion !== siguiente.descripcion ||
    anterior.unidad !== siguiente.unidad ||
    anterior.activo !== siguiente.activo
  )
}
