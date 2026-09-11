import { compactarCatalogo } from '../../domain/aprendizaje/compacto.ts'
import type { ItemCatalogoCompacto } from '../../domain/aprendizaje/compacto.ts'
import {
  familiaDeProducto,
  textoDePrioresParaPrompt,
} from '../../domain/aprendizaje/priores.ts'
import type { MapaDeMarcas } from '../../domain/aprendizaje/priores.ts'
import type { CandidatoDeAsistencia } from '../asistencia/tipos.ts'
import { AlmacenDeCatalogoFirestore } from '../catalogo/almacen-firestore.ts'
import type { ProductoDeCatalogo } from '../catalogo/tipos.ts'
import {
  leerMarcasDeAprendizaje,
  leerMemoriaDeAprendizaje,
} from './almacen.ts'

export function compactoACandidatos(
  items: readonly ItemCatalogoCompacto[],
): CandidatoDeAsistencia[] {
  return items.map((item) => ({
    codigo: item.id,
    descripcion: item.n,
    unidad: 'NIU',
    ...(item.m !== '' ? { marca: item.m } : {}),
    aliases: item.a,
    etiquetas: item.e,
  }))
}

export function productosParaCompacto(
  productos: readonly ProductoDeCatalogo[],
  categorias: readonly { readonly id: string; readonly nombre: string }[],
): {
  readonly codigo: string
  readonly descripcion: string
  readonly activo?: boolean
  readonly marca?: string
  readonly familia: string
}[] {
  const nombrePorId = new Map(categorias.map((c) => [c.id, c.nombre]))
  return productos.map((p) => {
    const categoriaNombre =
      p.categoriaId !== undefined
        ? (nombrePorId.get(p.categoriaId) ?? null)
        : null
    return {
      codigo: p.codigo,
      descripcion: p.descripcion,
      activo: p.activo,
      marca: p.marca,
      familia: familiaDeProducto({
        descripcion: p.descripcion,
        categoriaNombre,
      }),
    }
  })
}

export async function leerCatalogoCompactoComoCandidatos(): Promise<
  CandidatoDeAsistencia[]
> {
  const contexto = await leerContextoDeAsistencia()
  return contexto.candidatos
}

export async function leerContextoDeAsistencia(): Promise<{
  readonly candidatos: CandidatoDeAsistencia[]
  readonly prioresJson: string
  readonly marcas: MapaDeMarcas
  readonly porCodigo: Readonly<
    Record<string, { readonly marca: string; readonly familia: string }>
  >
}> {
  const publicado = await new AlmacenDeCatalogoFirestore().leerPublicado()
  if (publicado === null) {
    return { candidatos: [], prioresJson: '{}', marcas: {}, porCodigo: {} }
  }
  const [memoria, marcas] = await Promise.all([
    leerMemoriaDeAprendizaje(),
    leerMarcasDeAprendizaje(),
  ])
  const preparados = productosParaCompacto(
    publicado.productos,
    publicado.categorias,
  )
  const compacto = compactarCatalogo(preparados, memoria)
  const porCodigo: Record<string, { marca: string; familia: string }> = {}
  for (const p of preparados) {
    porCodigo[p.codigo] = { marca: p.marca ?? '', familia: p.familia }
  }
  return {
    candidatos: compactoACandidatos(compacto),
    prioresJson: textoDePrioresParaPrompt(marcas),
    marcas,
    porCodigo,
  }
}
