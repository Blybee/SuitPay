import {
  esquemaDeCategoria,
  esquemaDeProducto,
} from '../../domain/esquemas/comunes.ts'
import { fallar } from '../errores.ts'
import type { AlmacenDeCatalogo } from './almacen.ts'
import {
  detectarConflictos,
  hayConflictosBloqueantes,
} from './conflictos.ts'
import { compararContraPublicado } from './diferencias.ts'
import { interpretarJsonDeTienda } from './lector-json.ts'
import type {
  CategoriaDeCatalogo,
  ModoDeImportacion,
  ProductoDeCatalogo,
  ResumenDeImportacion,
} from './tipos.ts'

/**
 * `importarCatalogo`: validar o publicar el catálogo desde un archivo.
 *
 * En `validar` no escribe nada. En `publicar` exige que no haya conflictos
 * bloqueantes y escribe el catálogo completo en una sola operación.
 */

export type FormatoDeImportacion =
  | 'json_tienda'
  | 'json'
  | 'documento'
  | 'productos_revisados'

export interface PeticionDeImportar {
  readonly contenido: string
  readonly formato: FormatoDeImportacion
  readonly modo: ModoDeImportacion
  readonly administradorId: string
  readonly momento?: Date
}

export async function importarCatalogo(
  almacen: AlmacenDeCatalogo,
  peticion: PeticionDeImportar,
): Promise<ResumenDeImportacion> {
  const publicado = await almacen.leerPublicado()
  const interpretado = interpretarCarga(
    peticion.contenido,
    peticion.formato,
    publicado?.categorias ?? [],
  )
  const conflictos = detectarConflictos(interpretado.productos)
  const diferencias = compararContraPublicado(
    interpretado.productos,
    publicado?.productos ?? null,
  )

  if (peticion.modo === 'validar') {
    return {
      reconocidos: interpretado.productos.length,
      conflictos,
      diferencias,
      version: null,
      publicado: false,
      propuestos: interpretado.productos,
      categorias: interpretado.categorias,
    }
  }

  if (hayConflictosBloqueantes(conflictos)) {
    fallar('codigos_duplicados', {
      cantidad: conflictos.length,
      primerTipo: conflictos[0]?.tipo ?? 'codigo_duplicado',
    })
  }

  const resultado = await almacen.publicar({
    productos: interpretado.productos,
    categorias: interpretado.categorias,
    publicadoPor: peticion.administradorId,
    momento: peticion.momento ?? new Date(),
  })

  return {
    reconocidos: interpretado.productos.length,
    conflictos,
    diferencias,
    version: resultado.version,
    publicado: true,
    propuestos: interpretado.productos,
    categorias: interpretado.categorias,
  }
}

function interpretarCarga(
  contenido: string,
  formato: FormatoDeImportacion,
  categoriasPublicadas: readonly CategoriaDeCatalogo[],
): {
  readonly productos: readonly ProductoDeCatalogo[]
  readonly categorias: readonly CategoriaDeCatalogo[]
} {
  if (formato === 'documento') {
    fallar('archivo_no_interpretable', {
      motivo: 'usar_interpretar_catalogo_documento',
    })
  }

  if (formato === 'productos_revisados') {
    return interpretarProductosRevisados(contenido)
  }

  return {
    productos: interpretarJsonDeTienda(contenido),
    categorias: categoriasPublicadas,
  }
}

function interpretarProductosRevisados(contenido: string): {
  readonly productos: readonly ProductoDeCatalogo[]
  readonly categorias: readonly CategoriaDeCatalogo[]
} {
  let bruto: unknown
  try {
    bruto = JSON.parse(contenido) as unknown
  } catch {
    fallar('archivo_no_interpretable', { motivo: 'json_invalido' })
  }

  if (bruto === null || typeof bruto !== 'object' || Array.isArray(bruto)) {
    fallar('archivo_no_interpretable', { motivo: 'se_esperaba_objeto' })
  }

  const cuerpo = bruto as { productos?: unknown; categorias?: unknown }
  if (!Array.isArray(cuerpo.productos)) {
    fallar('archivo_no_interpretable', { motivo: 'se_esperaba_arreglo' })
  }

  const productos: ProductoDeCatalogo[] = []
  for (const entrada of cuerpo.productos) {
    const parseado = esquemaDeProducto.safeParse(entrada)
    if (!parseado.success) {
      fallar('archivo_no_interpretable', { motivo: 'producto_invalido' })
    }
    productos.push(parseado.data)
  }

  const categoriasBruto = Array.isArray(cuerpo.categorias)
    ? cuerpo.categorias
    : []
  const categorias: CategoriaDeCatalogo[] = []
  for (const entrada of categoriasBruto) {
    const parseado = esquemaDeCategoria.safeParse(entrada)
    if (!parseado.success) {
      fallar('archivo_no_interpretable', { motivo: 'categoria_invalida' })
    }
    categorias.push(parseado.data)
  }

  return { productos, categorias }
}
