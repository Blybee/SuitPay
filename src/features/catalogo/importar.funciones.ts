import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import { AlmacenDeCatalogoFirestore } from '../../server/catalogo/almacen-firestore.ts'
import { importarCatalogo } from '../../server/catalogo/importar.ts'
import {
  bytesDesdeBase64,
  interpretarDocumentoDeCatalogo,
} from '../../server/catalogo/lector-documento.ts'
import type { ResumenDeImportacion } from '../../server/catalogo/tipos.ts'
import type { Producto } from '../../domain/esquemas/comunes.ts'

/**
 * Puerta del cliente hacia `importarCatalogo`. Solo administrador.
 */

export type { ResumenDeImportacion } from '../../server/catalogo/tipos.ts'

const esquema = z.object({
  contenido: z.string().min(2),
  formato: z.enum(['json_tienda', 'json', 'documento', 'productos_revisados']),
  modo: z.enum(['validar', 'publicar']),
})

export interface RespuestaDeImportacion {
  readonly ok: boolean
  readonly resumen?: ResumenDeImportacion
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

export const importarCatalogoFn = createServerFn({ method: 'POST' })
  .validator(esquema)
  .handler(async ({ data }): Promise<RespuestaDeImportacion> => {
    try {
      const identidad = await exigirIdentidad(getRequestHeaders(), [
        'administrador',
      ])
      const resumen = await importarCatalogo(new AlmacenDeCatalogoFirestore(), {
        contenido: data.contenido,
        formato: data.formato,
        modo: data.modo,
        administradorId: identidad.uid,
      })
      return { ok: true, resumen }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo inesperado al importar catálogo', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

export interface RespuestaDeInterpretarDocumento {
  readonly ok: boolean
  readonly filas?: readonly Producto[]
  readonly reconocidos?: number
  readonly omitidos?: number
  readonly error?: ReturnType<ErrorDeSuitPay['aRespuesta']>
}

const esquemaInterpretar = z.object({
  contenidoBase64: z.string().min(8),
  nombreArchivo: z.string().max(200).optional(),
})

/** Interpreta el PDF sin escribir Firestore (T078c / FR-009b). */
export const interpretarCatalogoDocumentoFn = createServerFn({ method: 'POST' })
  .validator(esquemaInterpretar)
  .handler(async ({ data }): Promise<RespuestaDeInterpretarDocumento> => {
    try {
      await exigirIdentidad(getRequestHeaders(), ['administrador'])
      const resultado = await interpretarDocumentoDeCatalogo(
        bytesDesdeBase64(data.contenidoBase64),
      )
      return {
        ok: true,
        filas: resultado.filas,
        reconocidos: resultado.reconocidos,
        omitidos: resultado.omitidos,
      }
    } catch (error) {
      if (esErrorDeSuitPay(error)) {
        return { ok: false, error: error.aRespuesta() }
      }
      console.error('[SuitPay] fallo inesperado al interpretar PDF', error)
      return {
        ok: false,
        error: new ErrorDeSuitPay('fallo_inesperado').aRespuesta(),
      }
    }
  })

