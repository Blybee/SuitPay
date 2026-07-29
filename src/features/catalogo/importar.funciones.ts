import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { exigirIdentidad } from '../../server/auth/verificar.ts'
import { ErrorDeSuitPay, esErrorDeSuitPay } from '../../server/errores.ts'
import { AlmacenDeCatalogoFirestore } from '../../server/catalogo/almacen-firestore.ts'
import { importarCatalogo } from '../../server/catalogo/importar.ts'
import type { ResumenDeImportacion } from '../../server/catalogo/tipos.ts'

/**
 * Puerta del cliente hacia `importarCatalogo`. Solo administrador.
 */

export type { ResumenDeImportacion } from '../../server/catalogo/tipos.ts'

const esquema = z.object({
  contenido: z.string().min(2),
  formato: z.enum(['json_tienda', 'json', 'documento']),
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
