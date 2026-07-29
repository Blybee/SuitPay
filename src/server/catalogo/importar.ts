import { fallar } from '../errores.ts'
import type { AlmacenDeCatalogo } from './almacen.ts'
import {
  detectarConflictos,
  hayConflictosBloqueantes,
} from './conflictos.ts'
import { compararContraPublicado } from './diferencias.ts'
import { interpretarJsonDeTienda } from './lector-json.ts'
import type {
  ModoDeImportacion,
  ResumenDeImportacion,
} from './tipos.ts'

/**
 * `importarCatalogo`: validar o publicar el catálogo desde un archivo.
 *
 * En `validar` no escribe nada. En `publicar` exige que no haya conflictos
 * bloqueantes y escribe el catálogo completo en una sola operación.
 */

export interface PeticionDeImportar {
  readonly contenido: string
  readonly formato: 'json_tienda' | 'json' | 'documento'
  readonly modo: ModoDeImportacion
  readonly administradorId: string
  readonly momento?: Date
}

export async function importarCatalogo(
  almacen: AlmacenDeCatalogo,
  peticion: PeticionDeImportar,
): Promise<ResumenDeImportacion> {
  const productos = interpretarArchivo(peticion.contenido, peticion.formato)
  const conflictos = detectarConflictos(productos)
  const publicado = await almacen.leerPublicado()
  const diferencias = compararContraPublicado(
    productos,
    publicado?.productos ?? null,
  )

  if (peticion.modo === 'validar') {
    return {
      reconocidos: productos.length,
      conflictos,
      diferencias,
      version: null,
      publicado: false,
    }
  }

  if (hayConflictosBloqueantes(conflictos)) {
    fallar('codigos_duplicados', {
      cantidad: conflictos.length,
      primerTipo: conflictos[0]?.tipo ?? 'codigo_duplicado',
    })
  }

  const resultado = await almacen.publicar({
    productos,
    publicadoPor: peticion.administradorId,
    momento: peticion.momento ?? new Date(),
  })

  return {
    reconocidos: productos.length,
    conflictos,
    diferencias,
    version: resultado.version,
    publicado: true,
  }
}

function interpretarArchivo(
  contenido: string,
  formato: PeticionDeImportar['formato'],
): ReturnType<typeof interpretarJsonDeTienda> {
  if (formato === 'documento') {
    fallar('archivo_no_interpretable', {
      motivo: 'importacion_pdf_pendiente',
    })
  }
  // `json` y `json_tienda` comparten el lector de la tienda virtual.
  return interpretarJsonDeTienda(contenido)
}
