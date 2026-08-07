import {
  loteDeCandidatos,
  type IndiceDeProductos,
  type ProductoBuscable,
} from '../../domain/busqueda/productos.ts'

export interface CandidatoParaAsistencia {
  readonly codigo: string
  readonly descripcion: string
  readonly unidad: string
}

function tokensDe(termino: string): string[] {
  return termino
    .split(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
}

function aCandidato(p: ProductoBuscable): CandidatoParaAsistencia {
  return {
    codigo: p.codigo,
    descripcion: p.descripcion,
    unidad: p.unidad,
  }
}

/**
 * Construye el lote que viaja a interpretarCaptura.
 *
 * Con texto en Entrada: Fuse reduce a candidatos (Decisión 7).
 * Sin texto (dictado/foto típico): catálogo activo compacto completo —
 * sin semillas no hay forma de filtrar; un techo arbitrario dejaría fuera
 * el producto dictado.
 */
export function construirLoteDeCandidatos(
  indice: IndiceDeProductos,
  termino: string,
): CandidatoParaAsistencia[] {
  const semillas = tokensDe(termino)
  if (semillas.length > 0) {
    return loteDeCandidatos(indice, semillas, 8).map(aCandidato)
  }

  return [...indice.porDescripcionNormalizada.values()].map(aCandidato)
}
