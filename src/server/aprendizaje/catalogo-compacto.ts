import { compactarCatalogo } from '../../domain/aprendizaje/compacto.ts'
import type { ItemCatalogoCompacto } from '../../domain/aprendizaje/compacto.ts'
import type { CandidatoDeAsistencia } from '../asistencia/tipos.ts'
import { AlmacenDeCatalogoFirestore } from '../catalogo/almacen-firestore.ts'
import { leerMemoriaDeAprendizaje } from './almacen.ts'

export function compactoACandidatos(
  items: readonly ItemCatalogoCompacto[],
): CandidatoDeAsistencia[] {
  return items.map((item) => ({
    codigo: item.id,
    descripcion: item.n,
    unidad: 'NIU',
    aliases: item.a,
    etiquetas: item.e,
  }))
}

export async function leerCatalogoCompactoComoCandidatos(): Promise<
  CandidatoDeAsistencia[]
> {
  const publicado = await new AlmacenDeCatalogoFirestore().leerPublicado()
  if (publicado === null) return []
  const memoria = await leerMemoriaDeAprendizaje()
  const compacto = compactarCatalogo(publicado.productos, memoria)
  return compactoACandidatos(compacto)
}
