import type { ClienteEnIndice } from '../../infra/local/catalogo.ts'

/**
 * Coincidencias parciales de razón social sobre el índice en caché (FR-025).
 * Cero lecturas adicionales.
 */

export function buscarCoincidenciasDeCliente(
  consulta: string,
  indice: readonly ClienteEnIndice[],
  limite = 8,
): readonly ClienteEnIndice[] {
  const terminos = consulta
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0)

  if (terminos.length === 0) return []

  return indice
    .filter((cliente) => {
      const haystack = `${cliente.denominacion} ${cliente.numeroDocumento}`.toLowerCase()
      return terminos.every((termino) => haystack.includes(termino))
    })
    .slice(0, limite)
}
